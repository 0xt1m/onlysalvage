from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, permissions, status
from rest_framework.generics import get_object_or_404
from rest_framework.throttling import SimpleRateThrottle

import email.policy
import html
import re
import requests

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMessage, send_mail
from django.db.models import Avg, Count, Q
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils import timezone
from users.models import SellerReview, VerificationRequest, ApiKey, SiteFeedback, ContactMessage
from users.utils.phone import (
  phone_to_e164, send_phone_code, check_phone_code, clear_phone_verified,
)
from users.utils.telegram import send_telegram_message
from inventory.models import Report, Listing
from inventory.api.serializers import ReportSerializer
from .serializers import (
  PublicUserSerializer, UserListSerializer, UserSerializer,
  SellerReviewSerializer, TopRatedSellerSerializer, SellerListSerializer,
  ApiKeyStatusSerializer, SiteFeedbackSerializer, ContactMessageSerializer,
)

User = get_user_model()

COOKIE_KWARGS = {
  "httponly": True,
  "secure": not settings.DEBUG,
  "samesite": "Lax" if settings.DEBUG else "None",
}

class LinkFriendlyEmailMessage(EmailMessage):
  # Python's default email policy soft-wraps any line over 78 characters and
  # switches to quoted-printable encoding, which escapes literal "=" as "=3D"
  # and can split a long line mid-URL. Reset links (with a query string full
  # of "="s) are almost always past 78 chars, so without this override the
  # raw link -- as printed by the console backend or received in a real
  # email client's "view source" -- comes out corrupted if copied verbatim.
  def message(self, *, policy=email.policy.default):
    return super().message(policy=policy.clone(max_line_length=998))

class AddressAutocompleteView(APIView):
  # Public/no-auth -- same reasoning as the VIN decode lookup on the
  # inventory side, this is just a lookup helper, not account data.
  permission_classes = [permissions.AllowAny]

  def get(self, request):
    query = request.query_params.get("input", "").strip()
    if not query or not settings.GOOGLE_PLACES_API_KEY:
      return Response({"suggestions": []})

    request_body = {"input": query, "includedRegionCodes": ["us"]}
    if request.query_params.get("types") == "city":
      # Restricts predictions to city-level places (no street addresses),
      # for the "just pick a city" autocomplete on signup/profile forms.
      request_body["includedPrimaryTypes"] = ["locality"]

    try:
      res = requests.post(
        "https://places.googleapis.com/v1/places:autocomplete",
        json=request_body,
        headers={
          "Content-Type": "application/json",
          "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
        },
        timeout=5,
      )
      res.raise_for_status()
    except requests.RequestException:
      return Response({"suggestions": []})

    suggestions = [
      {
        "place_id": s["placePrediction"]["placeId"],
        "description": s["placePrediction"]["text"]["text"],
      }
      for s in res.json().get("suggestions", [])
      if "placePrediction" in s
    ]
    return Response({"suggestions": suggestions})


class AddressDetailsView(APIView):
  permission_classes = [permissions.AllowAny]

  def get(self, request):
    place_id = request.query_params.get("place_id", "").strip()
    if not place_id or not settings.GOOGLE_PLACES_API_KEY:
      return Response({"detail": "place_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
      res = requests.get(
        f"https://places.googleapis.com/v1/places/{place_id}",
        headers={
          "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "addressComponents",
        },
        timeout=5,
      )
      res.raise_for_status()
    except requests.RequestException:
      return Response({"detail": "Failed to fetch address details."}, status=status.HTTP_502_BAD_GATEWAY)

    components = res.json().get("addressComponents", [])

    def find(type_name, use_short=False):
      for component in components:
        if type_name in component.get("types", []):
          return component.get("shortText" if use_short else "longText", "")
      return ""

    street_address = f"{find('street_number')} {find('route')}".strip()

    return Response({
      "street_address": street_address,
      "city": find("locality") or find("sublocality") or find("postal_town"),
      "state": find("administrative_area_level_1", use_short=True),
      "zip_code": find("postal_code"),
    })


class _TranslateThrottle(SimpleRateThrottle):
  # Always keyed on IP regardless of auth state (unlike DRF's built-in
  # Anon/UserRateThrottle, which only cover one or the other) -- every call
  # here costs real money against the Google Translate API, and this
  # endpoint is intentionally open to anonymous visitors too.
  scope = "translate"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class TranslateView(APIView):
  # Public -- translating a listing/profile description shouldn't require an
  # account, same reasoning as AddressAutocompleteView above.
  permission_classes = [permissions.AllowAny]
  throttle_classes = [_TranslateThrottle]

  SUPPORTED_TARGETS = {"en", "es", "ru", "uk"}

  def post(self, request):
    text = (request.data.get("text") or "").strip()
    target = request.data.get("target")

    if not text:
      return Response({"detail": "text is required."}, status=status.HTTP_400_BAD_REQUEST)
    if target not in self.SUPPORTED_TARGETS:
      return Response({"detail": "Unsupported target language."}, status=status.HTTP_400_BAD_REQUEST)
    if not settings.GOOGLE_TRANSLATE_API_KEY:
      return Response({"detail": "Translation is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Longer text costs proportionally more against the API's per-character
    # billing -- cap well above any real listing/profile description so this
    # can't be used as a way to translate arbitrary large amounts of text.
    text = text[:5000]

    try:
      res = requests.post(
        "https://translation.googleapis.com/language/translate/v2",
        params={"key": settings.GOOGLE_TRANSLATE_API_KEY},
        json={"q": text, "target": target, "format": "text"},
        timeout=10,
      )
      res.raise_for_status()
      translation = res.json()["data"]["translations"][0]
    except (requests.RequestException, KeyError, IndexError):
      return Response({"detail": "Translation failed."}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
      "translated_text": html.unescape(translation["translatedText"]),
      "detected_source_language": translation.get("detectedSourceLanguage"),
    })


class UserDetailView(generics.RetrieveAPIView):
  queryset = User.objects.all()
  serializer_class = PublicUserSerializer
  lookup_field = "username"
  lookup_url_kwarg = "username"


class UserListView(generics.ListAPIView):
  queryset = User.objects.all()
  serializer_class = UserListSerializer


class UserCreateView(generics.CreateAPIView):
  queryset = User.objects.all()
  serializer_class = UserSerializer
  permission_classes = [permissions.AllowAny]


class UserMeView(generics.RetrieveUpdateDestroyAPIView):
  queryset = User.objects.all()
  serializer_class = UserSerializer
  permission_classes = [permissions.IsAuthenticated]

  def get_object(self):
    return self.request.user

  def perform_destroy(self, instance):
    # Full, permanent delete -- not a deactivation. Every listing this user
    # owns cascades on User.delete() regardless, but going through
    # hard_delete_with_s3_images per listing first means their S3-backed
    # photos/documents actually get cleaned up instead of silently
    # orphaned (a plain cascade only removes the DB rows, never the S3
    # objects -- see that method's own docstring).
    for listing in instance.inventory.all():
      listing.hard_delete_with_s3_images()

    if instance.profile_picture:
      instance.profile_picture.delete(save=False)

    instance.delete()


class RequestVerificationView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request):
    user = request.user

    if user.is_verified:
      return Response({"detail": "You're already verified."}, status=status.HTTP_400_BAD_REQUEST)

    existing_pending = user.verification_requests.filter(status=VerificationRequest.Status.PENDING).exists()
    if not existing_pending:
      VerificationRequest.objects.create(user=user)

    return Response({"verification_status": "pending"}, status=status.HTTP_201_CREATED)


class ApiKeyStatusView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def get(self, request):
    api_key = getattr(request.user, "api_key", None)
    if api_key is None:
      return Response({
        "status": "none", "status_display": "None", "has_token": False, "key_prefix": "",
        "note": "", "denial_reason": "", "requested_at": None, "reviewed_at": None,
        "issued_at": None, "last_used_at": None,
      })
    return Response(ApiKeyStatusSerializer(api_key).data)


class ApiKeyRequestView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request):
    user = request.user
    api_key, created = ApiKey.objects.get_or_create(user=user)

    # get_or_create's own default status is PENDING (a brand new row *is* a
    # fresh pending request, nothing more to do) -- the "already have one"
    # guard only makes sense for a row that already existed before this call.
    if not created and api_key.status in (ApiKey.Status.PENDING, ApiKey.Status.APPROVED):
      return Response(
        {"detail": "You already have a pending or active API access request."},
        status=status.HTTP_400_BAD_REQUEST,
      )

    api_key.note = (request.data.get("note") or "").strip()
    api_key.denial_reason = ""
    api_key.requested_at = timezone.now()

    # A verified seller (User.is_verified) has already been through one
    # round of manual review -- see VerificationRequest -- so this skips
    # straight to APPROVED instead of sitting in PENDING for a second one.
    if user.is_verified:
      api_key.status = ApiKey.Status.APPROVED
      api_key.reviewed_at = timezone.now()
    else:
      api_key.status = ApiKey.Status.PENDING
      api_key.reviewed_at = None

    api_key.save(update_fields=["status", "note", "denial_reason", "requested_at", "reviewed_at"])

    return Response(ApiKeyStatusSerializer(api_key).data, status=status.HTTP_201_CREATED)


class ApiKeyGenerateView(APIView):
  # Also doubles as "regenerate" -- see ApiKey.issue_token -- since re-POSTing
  # here on an already-issued key just overwrites its hash, immediately
  # invalidating whatever token was issued before.
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request):
    api_key = getattr(request.user, "api_key", None)
    if api_key is None or api_key.status != ApiKey.Status.APPROVED:
      return Response(
        {"detail": "Your API access request hasn't been approved yet."},
        status=status.HTTP_400_BAD_REQUEST,
      )

    raw_token = api_key.issue_token()

    return Response({
      "token": raw_token,
      "key_prefix": api_key.key_prefix,
      "issued_at": api_key.issued_at,
    })


class ApiKeyRevokeView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request):
    api_key = getattr(request.user, "api_key", None)
    if api_key is None or api_key.status != ApiKey.Status.APPROVED:
      return Response({"detail": "You don't have an active API key."}, status=status.HTTP_400_BAD_REQUEST)

    api_key.status = ApiKey.Status.REVOKED
    api_key.key_prefix = ""
    api_key.hashed_key = ""
    api_key.save(update_fields=["status", "key_prefix", "hashed_key"])

    return Response(ApiKeyStatusSerializer(api_key).data)


class _FeedbackThrottle(SimpleRateThrottle):
  # Always keyed on IP regardless of auth state, same reasoning as
  # _TranslateThrottle above -- this is open to anonymous visitors, so a
  # logged-in-only UserRateThrottle wouldn't actually bound anonymous spam.
  scope = "feedback"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _send_feedback_notification(feedback):
  send_mail(
    subject=f"[{feedback.get_category_display()}] {feedback.subject}",
    message=(
      f"From: {feedback.user.username if feedback.user_id else (feedback.email or 'anonymous')}\n"
      f"Category: {feedback.get_category_display()}\n"
      f"Context: {feedback.context or '-'}\n\n"
      f"{feedback.message}"
    ),
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=[settings.SUPPORT_EMAIL],
    fail_silently=True,
  )


class SiteFeedbackView(APIView):
  # Public -- reporting a bug or suggesting a feature shouldn't require an
  # account, same reasoning as TestDriveRequest on the inventory side. Still
  # associated with the account when one is logged in (see perform below),
  # just never required.
  permission_classes = [permissions.AllowAny]
  throttle_classes = [_FeedbackThrottle]

  def post(self, request):
    serializer = SiteFeedbackSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    feedback = serializer.save(
      user=request.user if request.user.is_authenticated else None,
    )

    _send_feedback_notification(feedback)

    return Response(serializer.data, status=status.HTTP_201_CREATED)


class _ContactThrottle(SimpleRateThrottle):
  # Same IP-keyed-regardless-of-auth reasoning as _FeedbackThrottle above.
  scope = "contact"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ContactMessageView(APIView):
  # Public -- same reasoning as SiteFeedbackView. Delivered to Telegram
  # (see users/utils/telegram.py) rather than email; the row is saved either
  # way so nothing's lost before TELEGRAM_BOT_API_TOKEN/TELEGRAM_CHAT_ID are
  # configured, or if a send ever fails.
  permission_classes = [permissions.AllowAny]
  throttle_classes = [_ContactThrottle]

  def post(self, request):
    serializer = ContactMessageSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    user = request.user if request.user.is_authenticated else None
    contact_message = serializer.save(
      user=user,
      name=serializer.validated_data.get("name") or (user.username if user else ""),
      email=serializer.validated_data.get("email") or (user.email if user else ""),
    )

    delivered = send_telegram_message(
      f"New contact message from {contact_message.name or contact_message.email or 'anonymous'}"
      f" ({contact_message.email or 'no email'}):\n\n{contact_message.message}"
    )
    if delivered:
      contact_message.delivered = True
      contact_message.save(update_fields=["delivered"])

    return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChangePasswordView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request):
    current_password = request.data.get("current_password")
    new_password = request.data.get("new_password")

    if not current_password or not new_password:
      return Response({"detail": "current_password and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.check_password(current_password):
      return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
      return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save()

    return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)


class _LoginThrottle(SimpleRateThrottle):
  # IP-keyed regardless of auth state (there's no account yet at login) --
  # bounds password-brute-force attempts against a single account, which
  # nothing else in the app protects against otherwise.
  scope = "login"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class CookieTokenObtainPairView(TokenObtainPairView):
  throttle_classes = [_LoginThrottle]

  def post(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    response = Response({"detail": "logged in"}, status=status.HTTP_200_OK)
    response.set_cookie(
      "access", str(data["access"]),
      max_age=10 * 60, path="/", **COOKIE_KWARGS,
    )
    response.set_cookie(
      "refresh_token", str(data["refresh"]),
      max_age=7 * 24 * 60 * 60, path="/", **COOKIE_KWARGS,
    )

    return response


class GoogleLoginView(APIView):
  permission_classes = [permissions.AllowAny]

  def _unique_username_from(self, seed):
    base = re.sub(r"[^a-z0-9_]", "", seed.lower()) or "user"
    username = base
    suffix = 1
    while User.objects.filter(username__iexact=username).exists():
      suffix += 1
      username = f"{base}{suffix}"
    return username

  def post(self, request):
    credential = request.data.get("credential")
    if not credential:
      return Response({"detail": "Missing Google credential."}, status=status.HTTP_400_BAD_REQUEST)

    try:
      idinfo = google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
      )
    except ValueError:
      return Response({"detail": "Invalid Google credential."}, status=status.HTTP_400_BAD_REQUEST)

    email_address = idinfo.get("email")
    google_sub = idinfo.get("sub")
    if not email_address or not google_sub:
      return Response({"detail": "Google account is missing required info."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(google_sub=google_sub).first()

    if not user:
      user = User.objects.filter(email__iexact=email_address).first()
      if user and not user.google_sub:
        user.google_sub = google_sub
        user.save(update_fields=["google_sub"])

    if not user:
      username_seed = idinfo.get("given_name") or email_address.split("@")[0]
      user = User(
        username=self._unique_username_from(username_seed),
        email=email_address,
        google_sub=google_sub,
      )
      user.set_unusable_password()
      user.save()

    refresh = RefreshToken.for_user(user)
    response = Response(
      {"detail": "logged in", "profile_complete": user.profile_complete},
      status=status.HTTP_200_OK,
    )
    response.set_cookie(
      "access", str(refresh.access_token),
      max_age=10 * 60, path="/", **COOKIE_KWARGS,
    )
    response.set_cookie(
      "refresh_token", str(refresh),
      max_age=7 * 24 * 60 * 60, path="/", **COOKIE_KWARGS,
    )
    return response


class CookieTokenRefreshView(APIView):
  permissions = [permissions.AllowAny]

  def post(self, request):
    print("Trying to refresh")
    raw_refresh = request.COOKIES.get("refresh_token")
    if raw_refresh is None:
      return Response({"detail": "no refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      refresh = RefreshToken(raw_refresh)
      new_access = str(refresh.access_token)

    except TokenError:
      return Response({"detail": "invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

    response = Response({"detail": "refreshed"}, status=status.HTTP_200_OK)
    response.set_cookie(
      "access", new_access,
      max_age=5 * 60, path="/", **COOKIE_KWARGS,
    )

    return response


class LogoutView(APIView):
  permission_classes = [permissions.AllowAny]

  def post(self, request):
    response = Response({"detail": "logged out"}, status=status.HTTP_200_OK)
    response.delete_cookie("access", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response


class PasswordResetRequestView(APIView):
  permission_classes = [permissions.AllowAny]

  def post(self, request):
    identifier = (request.data.get("username") or "").strip()
    if not identifier:
      return Response({"detail": "Username or email is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()

    if user and user.email:
      uid = urlsafe_base64_encode(force_bytes(user.pk))
      token = default_token_generator.make_token(user)
      reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

      LinkFriendlyEmailMessage(
        subject="Reset your OnlySalvage password",
        body=(
          "You (or someone else) requested a password reset for your OnlySalvage account.\n\n"
          f"Reset it here: {reset_url}\n\n"
          "If you didn't request this, you can safely ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
      ).send(fail_silently=True)

    # Always respond the same way, whether or not a matching user was found,
    # so this endpoint can't be used to enumerate registered usernames/emails.
    return Response({"detail": "If an account exists, a reset link has been sent."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
  permission_classes = [permissions.AllowAny]

  def post(self, request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    new_password = request.data.get("new_password")

    if not uid or not token or not new_password:
      return Response({"detail": "uid, token, and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
      return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

    try:
      user_id = force_str(urlsafe_base64_decode(uid))
      user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
      return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
      return Response({"detail": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()

    return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)


class SellerReviewView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def get(self, request, username):
    seller = get_object_or_404(User, username=username)
    review = SellerReview.objects.filter(seller=seller, reviewer=request.user).first()
    return Response({"review": SellerReviewSerializer(review).data if review else None})

  def post(self, request, username):
    seller = get_object_or_404(User, username=username)

    if seller == request.user:
      return Response({"detail": "You cannot review yourself."}, status=status.HTTP_400_BAD_REQUEST)

    rating = request.data.get("rating")
    try:
      rating = int(rating)
    except (TypeError, ValueError):
      return Response({"detail": "Rating must be a number from 1 to 5."}, status=status.HTTP_400_BAD_REQUEST)

    if not 1 <= rating <= 5:
      return Response({"detail": "Rating must be between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

    review, _ = SellerReview.objects.update_or_create(
      seller=seller, reviewer=request.user,
      defaults={"rating": rating, "comment": request.data.get("comment", "")},
    )

    return Response(SellerReviewSerializer(review).data, status=status.HTTP_200_OK)


class ReportSellerView(APIView):
  permission_classes = [permissions.IsAuthenticated]

  def post(self, request, username):
    seller = get_object_or_404(User, username=username)

    if seller == request.user:
      return Response({"detail": "You cannot report yourself."}, status=status.HTTP_400_BAD_REQUEST)

    reason = request.data.get("reason")
    if reason not in Report.SELLER_REASONS:
      return Response({"reason": "Not a valid reason for reporting a seller."}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(reporter=request.user, seller=seller)

    return Response(serializer.data, status=status.HTTP_201_CREATED)


class SellerCallView(APIView):
  # Same reasoning as ListingCallView: the real number is only ever fetched
  # through this dedicated endpoint, not sent in the seller list/card
  # payload, so it can't be scraped in bulk off /sellers or the home page.
  # No call_count here (unlike ListingCallView) -- there's no listing to
  # attribute the call to when it's dialed straight from a seller card.
  permission_classes = [permissions.AllowAny]

  def post(self, request, username):
    seller = get_object_or_404(User, username=username)
    return Response({"phone": seller.phone})


class SellerListView(generics.ListAPIView):
  serializer_class = SellerListSerializer
  permission_classes = [permissions.AllowAny]

  def get_queryset(self):
    # A draft listing shouldn't make its seller appear in the public
    # directory, or count toward their visible listings total, before
    # they've actually published it.
    visible_listing = Q(inventory__is_active=True) & ~Q(inventory__status=Listing.Status.DRAFT)
    qs = (
      User.objects.filter(visible_listing)
      .annotate(
        avg_rating=Avg("seller_reviews_received__rating"),
        review_count=Count("seller_reviews_received", distinct=True),
        listings_count=Count("inventory", filter=visible_listing, distinct=True),
      )
      .distinct()
      .order_by("-avg_rating", "-listings_count")
    )

    search = self.request.query_params.get("search")
    if search:
      qs = qs.filter(Q(username__icontains=search) | Q(business_name__icontains=search))

    return qs


class TopRatedSellersView(generics.ListAPIView):
  serializer_class = TopRatedSellerSerializer
  permission_classes = [permissions.AllowAny]
  pagination_class = None

  def get_queryset(self):
    limit = int(self.request.query_params.get("limit", 6))
    return (
      User.objects.annotate(
        avg_rating=Avg("seller_reviews_received__rating"),
        review_count=Count("seller_reviews_received"),
      )
      .filter(review_count__gt=0)
      .order_by("-avg_rating", "-review_count")[:limit]
    )


class VerifiedSellersView(generics.ListAPIView):
  serializer_class = TopRatedSellerSerializer
  permission_classes = [permissions.AllowAny]
  pagination_class = None

  def get_queryset(self):
    limit = int(self.request.query_params.get("limit", 6))
    return (
      User.objects.filter(is_verified=True)
      .annotate(
        avg_rating=Avg("seller_reviews_received__rating"),
        review_count=Count("seller_reviews_received"),
      )
      .order_by("-avg_rating", "-review_count")[:limit]
    )


class _PhoneVerifyThrottle(SimpleRateThrottle):
  # Keyed by user id, not IP -- these endpoints are already IsAuthenticated,
  # and what actually needs bounding is how many texts one *account* can
  # trigger (each one costs money once this is on real Twilio).
  scope = "phone-verify"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class SendPhoneCodeView(APIView):
  # Covers both "verify the phone number already on my account" (frontend
  # sends request.user.phone back) and "change to a new number" (frontend
  # sends the new number instead) -- same operation either way: prove they
  # can receive a code at this number. See CheckPhoneCodeView for what
  # actually happens once it's confirmed.
  permission_classes = [permissions.IsAuthenticated]
  throttle_classes = [_PhoneVerifyThrottle]

  def post(self, request):
    phone = request.data.get("phone", "")
    if not phone_to_e164(phone):
      return Response({"detail": "Enter a valid phone number."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.exclude(pk=request.user.pk).filter(phone=phone.strip()).exists():
      return Response({"detail": "This phone number is already registered to another account."}, status=status.HTTP_400_BAD_REQUEST)

    if not send_phone_code(phone):
      return Response({"detail": "Failed to send verification code. Check the number and try again."}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({"status": "sent"})


class CheckPhoneCodeView(APIView):
  permission_classes = [permissions.IsAuthenticated]
  throttle_classes = [_PhoneVerifyThrottle]

  def post(self, request):
    phone = (request.data.get("phone") or "").strip()
    code = (request.data.get("code") or "").strip()
    if not phone or not code:
      return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not check_phone_code(phone, code):
      return Response({"detail": "Incorrect or expired code."}, status=status.HTTP_400_BAD_REQUEST)

    # Re-checked right before committing -- there's a real (if small) race
    # between send-code and now where someone else could have taken this
    # number, and this is the point where it actually gets written down.
    if User.objects.exclude(pk=request.user.pk).filter(phone=phone).exists():
      return Response({"detail": "This phone number is already registered to another account."}, status=status.HTTP_400_BAD_REQUEST)

    clear_phone_verified(phone)
    request.user.phone = phone
    request.user.phone_verified = True
    request.user.save(update_fields=["phone", "phone_verified"])
    return Response({"status": "approved", "phone": request.user.phone})


class _RegistrationPhoneThrottle(SimpleRateThrottle):
  # No account exists yet at this point, so this is necessarily keyed by IP
  # rather than user id (unlike _PhoneVerifyThrottle above) -- same reasoning
  # as _TranslateThrottle.
  scope = "registration-phone"

  def get_cache_key(self, request, view):
    return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class SendRegistrationPhoneCodeView(APIView):
  # Public by necessity -- this runs before an account exists at all, gating
  # UserSerializer.create() (see is_phone_verified there).
  permission_classes = [permissions.AllowAny]
  throttle_classes = [_RegistrationPhoneThrottle]

  def post(self, request):
    raw_phone = request.data.get("phone", "")
    if not phone_to_e164(raw_phone):
      return Response({"detail": "Enter a valid phone number."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(phone=(raw_phone or "").strip()).exists():
      return Response({"detail": "This phone number is already registered."}, status=status.HTTP_400_BAD_REQUEST)

    if not send_phone_code(raw_phone):
      return Response({"detail": "Failed to send verification code. Check the number and try again."}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({"status": "sent"})


class CheckRegistrationPhoneCodeView(APIView):
  permission_classes = [permissions.AllowAny]
  throttle_classes = [_RegistrationPhoneThrottle]

  def post(self, request):
    phone = request.data.get("phone")
    code = (request.data.get("code") or "").strip()
    if not phone_to_e164(phone) or not code:
      return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not check_phone_code(phone, code):
      return Response({"detail": "Incorrect or expired code."}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"status": "approved"})

