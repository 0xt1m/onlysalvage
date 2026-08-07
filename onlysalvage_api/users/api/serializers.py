from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from inventory.models import Listing
from users.models import SellerReview, VerificationRequest, ApiKey, SiteFeedback, ContactMessage
from users.utils.geocoding import zip_to_coordinates
from users.utils.phone import is_phone_verified, clear_phone_verified

User = get_user_model()


class ApiKeyStatusSerializer(serializers.ModelSerializer):
  status_display = serializers.CharField(source="get_status_display", read_only=True)
  has_token = serializers.SerializerMethodField()

  class Meta:
    model = ApiKey
    fields = (
      "status", "status_display", "has_token", "key_prefix", "note", "denial_reason",
      "requested_at", "reviewed_at", "issued_at", "last_used_at",
    )
    read_only_fields = fields

  def get_has_token(self, obj):
    return bool(obj.hashed_key)


class SiteFeedbackSerializer(serializers.ModelSerializer):
  # user/status/admin_notes are all set server-side (see SiteFeedbackView) --
  # a submitter only ever supplies these five fields.
  class Meta:
    model = SiteFeedback
    fields = ("id", "category", "subject", "message", "email", "context", "created_at")
    read_only_fields = ("id", "created_at")

  def validate_subject(self, value):
    value = value.strip()
    if not value:
      raise serializers.ValidationError("Subject is required.")
    return value

  def validate_message(self, value):
    value = value.strip()
    if not value:
      raise serializers.ValidationError("Message is required.")
    return value


class ContactMessageSerializer(serializers.ModelSerializer):
  class Meta:
    model = ContactMessage
    fields = ("id", "name", "email", "message", "created_at")
    read_only_fields = ("id", "created_at")

  def validate_message(self, value):
    value = value.strip()
    if not value:
      raise serializers.ValidationError("Message is required.")
    return value

  def validate(self, attrs):
    # A logged-in sender's email is already on file (see ContactMessageView,
    # which fills in `user`) -- only an anonymous one actually needs to type
    # one in, since a reply has nowhere else to go.
    request = self.context.get("request")
    is_authenticated = bool(request and request.user.is_authenticated)
    if not is_authenticated and not attrs.get("email", "").strip():
      raise serializers.ValidationError({"email": "Provide an email so we can get back to you."})
    return attrs

class UserSerializer(serializers.ModelSerializer):
  password = serializers.CharField(write_only=True)
  # email/city/state/zip_code are all blank=True on the model so a fresh
  # Google sign-up can be created without them (see GoogleLoginView), but
  # both the regular sign-up flow and profile edits through this serializer
  # should still require them -- ModelSerializer would otherwise infer
  # required=False from blank=True, which let profile edits clear the email
  # entirely.
  email = serializers.EmailField(required=True)
  city = serializers.CharField(required=True)
  state = serializers.CharField(required=True)
  zip_code = serializers.CharField(required=True)
  # Declared explicitly (rather than left to ModelSerializer's auto-generated
  # field) so the model's unique=True doesn't attach DRF's default
  # UniqueValidator -- that validator runs on the raw submitted value, before
  # validate_phone below ever gets a chance to normalize '' to None, which
  # would incorrectly flag every blank submission as colliding with every
  # other blank account.
  phone = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=20)
  verification_status = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields = (
      "username",
      "password",
      "email",
      "business_name",
      "street_address",
      "city",
      "state",
      "zip_code",
      "location",
      "is_dealer",
      "offers_financing",
      "offers_warranty",
      "warranty_duration",
      "warranty_description",
      "phone",
      "phone_verified",
      "website",
      "profile_picture",
      "description",
      "show_email",
      "profile_complete",
      "is_verified",
      "verification_status",
      "preferred_locale",
    )
    read_only_fields = ("location", "profile_complete", "is_verified", "phone_verified")

  def get_verification_status(self, obj):
    # "verified" | "pending" | "rejected" | "none" -- lets the profile page
    # show the right call to action without a separate request. Only
    # meaningful for the owner viewing their own profile (see UserMeView),
    # so this isn't exposed on the public-facing serializers below.
    if obj.is_verified:
      return "verified"
    latest = obj.verification_requests.order_by("-requested_at").first()
    if latest and latest.status == VerificationRequest.Status.PENDING:
      return "pending"
    if latest and latest.status == VerificationRequest.Status.REJECTED:
      return "rejected"
    return "none"

  def validate_phone(self, value):
    value = value.strip() if value else None
    if not value:
      return None

    qs = User.objects.filter(phone=value)
    if self.instance:
      qs = qs.exclude(pk=self.instance.pk)
    if qs.exists():
      raise serializers.ValidationError("This phone number is already registered to another account.")

    return value

  def validate(self, attrs):
    # Mirrors User.clean(), but raised here as a DRF ValidationError so it
    # comes back as a normal 400 with field errors -- the model-level check
    # still exists as a safety net for saves that don't go through this
    # serializer (admin, shell), but relying on it alone means the Django
    # ValidationError it raises inside save() surfaces as an unhandled 500.
    is_dealer = attrs.get("is_dealer", getattr(self.instance, "is_dealer", False))
    business_name = attrs.get("business_name", getattr(self.instance, "business_name", None))
    street_address = attrs.get("street_address", getattr(self.instance, "street_address", None))
    if is_dealer and not business_name:
      raise serializers.ValidationError({"business_name": "Business name is required for dealers."})
    if is_dealer and not street_address:
      raise serializers.ValidationError({"street_address": "Street address is required for dealers."})

    # Only enforced at registration (self.instance is None means this is
    # UserCreateView, not a settings edit through UserMeView) -- existing
    # accounts created before this requirement, or via Google sign-up (which
    # never collects a phone at all, see GoogleLoginView), shouldn't get
    # blocked from saving unrelated profile changes just for lacking one.
    if self.instance is None:
      phone = attrs.get("phone")
      if not phone:
        raise serializers.ValidationError({"phone": "Phone number is required."})
      # Proves they actually completed SendRegistrationPhoneCodeView +
      # CheckRegistrationPhoneCodeView for this exact number first -- see
      # users/utils/phone.py for the shared send/check-code mechanism (also
      # used by the settings-page verify/change-number flows).
      if not is_phone_verified(phone):
        raise serializers.ValidationError({"phone": "Please verify this phone number first."})

    zip_code = attrs.get("zip_code")
    if zip_code:
      lng, lat = zip_to_coordinates(zip_code)
      attrs["location"] = Point(lng, lat, srid=4326)

    return attrs

  def create(self, validated_data):
    password = validated_data.pop("password")
    user = User(**validated_data)
    user.set_password(password)
    # validate() above already required is_phone_verified(user.phone) to be
    # true for this to have been reached at all -- this carries that
    # confirmation onto the actual field, same as every other verify flow
    # ends with. Without this, registration still correctly *gated* on
    # verification but never actually recorded that it happened.
    if user.phone:
      user.phone_verified = True
    user.save()

    # Single-use -- once this phone has actually been used to create an
    # account, that same verified code shouldn't still be redeemable for a
    # second one.
    if user.phone:
      clear_phone_verified(user.phone)

    return user

  def update(self, instance, validated_data):
    password = validated_data.pop("password", None)

    # A verification only ever confirmed the number on file at the time --
    # once that number changes, the old confirmation no longer means
    # anything about the new one.
    if "phone" in validated_data and validated_data["phone"] != instance.phone:
      instance.phone_verified = False

    for attr, value in validated_data.items():
      setattr(instance, attr, value)

    if password:
      instance.set_password(password)

    instance.save()
    return instance


class SellerReviewSerializer(serializers.ModelSerializer):
  reviewer_username = serializers.CharField(source="reviewer.username", read_only=True)

  class Meta:
    model = SellerReview
    fields = ("id", "reviewer", "reviewer_username", "rating", "comment", "created_at")
    read_only_fields = ("reviewer",)


class TopRatedSellerSerializer(serializers.ModelSerializer):
  avg_rating = serializers.FloatField(read_only=True)
  review_count = serializers.IntegerField(read_only=True)
  # Real phone number is never sent in a list payload (same reasoning as
  # ListingSellerSerializer.has_phone) -- it's only fetched, on demand, via
  # the dedicated call endpoint. street_address/zip_code are safe to send
  # directly though: they're already unconditionally cleared to blank for
  # non-dealers at the model level (User.save()), same as PublicUserSerializer.
  has_phone = serializers.SerializerMethodField()
  email = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields = (
      "id",
      "username",
      "business_name",
      "is_dealer",
      "is_verified",
      "city",
      "state",
      "street_address",
      "zip_code",
      "profile_picture",
      "has_phone",
      "email",
      "avg_rating",
      "review_count",
    )

  def get_has_phone(self, obj):
    return bool(obj.phone)

  def get_email(self, obj):
    return obj.email if obj.show_email else None

class SellerListSerializer(serializers.ModelSerializer):
  avg_rating = serializers.FloatField(read_only=True)
  review_count = serializers.IntegerField(read_only=True)
  listings_count = serializers.IntegerField(read_only=True)
  has_phone = serializers.SerializerMethodField()
  email = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields = (
      "id",
      "username",
      "business_name",
      "is_dealer",
      "is_verified",
      "offers_financing",
      "city",
      "state",
      "street_address",
      "zip_code",
      "profile_picture",
      "has_phone",
      "email",
      "avg_rating",
      "review_count",
      "listings_count",
    )

  def get_has_phone(self, obj):
    return bool(obj.phone)

  def get_email(self, obj):
    return obj.email if obj.show_email else None


class SmallUserSerializer(serializers.ModelSerializer):
  # Used as Listing.seller in the listing list endpoint (see
  # ListingListSerializer) -- has_phone/email follow the same rule as
  # everywhere else the real phone number is kept out of a bulk/list
  # payload, only ever fetched on demand via the call endpoint.
  has_phone = serializers.SerializerMethodField()
  email = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields = (
      "id",
      "username",
      "business_name",
      "is_dealer",
      "is_verified",
      "city",
      "state",
      "profile_picture",
      "location",
      "has_phone",
      "email",
    )

  def get_has_phone(self, obj):
    return bool(obj.phone)

  def get_email(self, obj):
    return obj.email if obj.show_email else None

class PublicUserSerializer(serializers.ModelSerializer):
  seller_reviews_received = SellerReviewSerializer(many=True, read_only=True)
  email = serializers.SerializerMethodField()
  sold_listings_count = serializers.SerializerMethodField()

  class Meta:
    model = User
    fields = (
      "id",
      "username",
      "is_dealer",
      "is_verified",
      "offers_financing",
      "offers_warranty",
      "warranty_duration",
      "warranty_description",
      "email",
      "show_email",
      "phone",
      "phone_verified",
      "street_address",
      "city",
      "state",
      "zip_code",
      "website",
      "profile_picture",
      "business_name",
      "description",
      "seller_reviews_received",
      "location",
      "date_joined",
      "sold_listings_count",
    )

  def get_email(self, obj):
    return obj.email if obj.show_email else None

  def get_sold_listings_count(self, obj):
    return obj.inventory.filter(status=Listing.Status.SOLD).count()

class UserListSerializer(serializers.ModelSerializer):
  class Meta:
    model = User
    fields = (
      "id",
      "username",
      "business_name",
      "is_dealer",
      "city",
      "state",
      "profile_picture",
      "location",
    )
