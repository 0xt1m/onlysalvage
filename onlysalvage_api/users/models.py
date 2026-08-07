import hashlib
import secrets

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.contrib.gis.db import models
from localflavor.us.models import USStateField, USZipCodeField
from django.conf import settings
from django.utils import timezone

class User(AbstractUser):
  is_dealer = models.BooleanField(default=False)
  offers_financing = models.BooleanField(
    default=False,
    help_text="Dealer offers in-house (buy here, pay here) financing."
  )
  offers_warranty = models.BooleanField(
    default=False,
    help_text="Dealer offers a warranty on their vehicles."
  )
  # Free text rather than a structured duration -- dealers phrase this in
  # all kinds of ways ("12 months / 12,000 miles", "90 days", "3yr/36k"),
  # and none of it needs to be queried/filtered on, just displayed.
  warranty_duration = models.CharField(max_length=255, blank=True, null=True)
  warranty_description = models.TextField(blank=True, null=True)

  # null=True (not just blank=True) so multiple accounts with no phone don't
  # collide under the unique constraint below -- Postgres treats each NULL as
  # distinct, but two empty strings '' would count as a duplicate. Blank
  # phones are normalized to None in save() so this holds regardless of what
  # a caller actually passes in.
  phone = models.CharField(max_length=20, blank=True, null=True, unique=True)
  # Set only by CheckPhoneVerificationView once Twilio Verify confirms the
  # code -- never directly editable, and reset back to False (see
  # UserSerializer.update) the moment the phone number itself changes, so
  # this can never end up describing a different number than the one on file.
  phone_verified = models.BooleanField(default=False, editable=False)

  street_address = models.CharField(max_length=255, blank=True, null=True)
  # Blank for accounts created via a social login (e.g. Google) that hasn't
  # gone through the "complete your profile" step yet -- see profile_complete.
  city = models.CharField(max_length=100, blank=True)
  state = USStateField(blank=True)
  zip_code = USZipCodeField(blank=True)

  google_sub = models.CharField(max_length=255, blank=True, null=True, unique=True)
  profile_complete = models.BooleanField(default=True)

  location = models.PointField(geography=True, srid=4326, blank=True, null=True)

  website = models.URLField(blank=True, null=True)
  profile_picture = models.ImageField(
    upload_to="profiles/",
    blank=True,
    null=True
  )
  business_name = models.CharField(max_length=255, blank=True, null=True)
  description = models.TextField(blank=True, null=True)

  show_email = models.BooleanField(default=True)

  is_verified = models.BooleanField(default=False, editable=False)

  # Set automatically whenever the user picks a language from the
  # LanguageSwitcher while logged in (see UserSerializer) -- lets their
  # preference follow them to a new device/browser instead of only living in
  # that browser's NEXT_LOCALE cookie. Null means "no account-level
  # preference yet", not "English" -- an anonymous/logged-out visitor (or one
  # who's never switched) still falls back to that cookie.
  class PreferredLocale(models.TextChoices):
    ENGLISH = "en", "English"
    UKRAINIAN = "uk", "Українська"
    RUSSIAN = "ru", "Русский"
    SPANISH = "es", "Español"
    ROMANIAN = "ro", "Română (Moldova)"

  preferred_locale = models.CharField(max_length=5, choices=PreferredLocale.choices, blank=True, null=True)

  REQUIRED_FIELDS = ["email", "city", "state", "zip_code"]

  def __str__(self):
    return self.username

  def clean(self):
    if self.is_dealer and not self.business_name:
      raise ValidationError({
        "business_name": "Business name is required for dealers."
      })

    if self.is_dealer and not self.street_address:
      raise ValidationError({
        "street_address": "Street address is required for dealers."
      })

    if self.offers_financing and not self.is_dealer:
      raise ValidationError({
        "offers_financing": "Only dealers can offer financing."
      })

    if self.offers_warranty and not self.is_dealer:
      raise ValidationError({
        "offers_warranty": "Only dealers can offer a warranty."
      })

  def save(self, *args, **kwargs):
    # Normalized to None (not '') so the unique constraint on phone never
    # sees two blank accounts as a collision -- see the field's own comment.
    self.phone = self.phone.strip() if self.phone else None

    # Derived rather than trusted from callers, so it can't drift from the
    # actual data: a fresh Google sign-up starts without a location, and
    # flips to complete the moment they fill in city/state/zip.
    self.profile_complete = bool(self.city and self.state and self.zip_code)

    # Only dealers show an exact street address on their page -- private
    # sellers are only ever shown at city/state granularity. Clearing it here
    # (rather than only validating it) means a private seller can never end
    # up with a stale address left over from before they were a dealer, or
    # from before this rule existed.
    if not self.is_dealer:
      self.street_address = ""
      self.offers_warranty = False
      self.warranty_duration = ""
      self.warranty_description = ""

    self.full_clean()
    super().save(*args, **kwargs)


class SellerReview(models.Model):
  reviewer = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.CASCADE,
    related_name="seller_reviews_given"
  )

  seller = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.CASCADE,
    related_name="seller_reviews_received"
  )

  rating = models.PositiveSmallIntegerField()
  comment = models.TextField(blank=True)

  created_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    unique_together = ("reviewer", "seller")

  def clean(self):
    if self.reviewer == self.seller:
      raise ValidationError("You cannot review yourself.")

    if not 1 <= self.rating <= 5:
      raise ValidationError("Rating must be between 1 and 5.")

  def save(self, *args, **kwargs):
    self.full_clean()
    super().save(*args, **kwargs)


class VerificationRequest(models.Model):
  """A seller's request to have their account marked as verified. Reviewed
  from the Django admin (see users/admin.py) -- approving/rejecting there
  keeps User.is_verified in sync rather than editing it directly, so the
  badge's state always traces back to an actual reviewed request.
  """
  class Status(models.TextChoices):
    PENDING = "PE", "Pending"
    APPROVED = "AP", "Approved"
    REJECTED = "RE", "Rejected"

  user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.CASCADE,
    related_name="verification_requests",
  )
  status = models.CharField(max_length=2, choices=Status.choices, default=Status.PENDING)
  requested_at = models.DateTimeField(auto_now_add=True)
  reviewed_at = models.DateTimeField(null=True, blank=True)

  class Meta:
    ordering = ["-requested_at"]

  def __str__(self):
    return f"{self.user.username} ({self.get_status_display()})"


class ApiKey(models.Model):
  """One row per user, gating access to the public v1 API (see the
  `publicapi` app). Reviewed from the Django admin like VerificationRequest
  above -- except a verified seller (User.is_verified, itself already an
  admin-reviewed signal) skips straight to APPROVED on request instead of
  sitting in PENDING (see ApiKeyRequestView).

  Only ever one active key per user for now -- if per-integration keys are
  ever needed, this can become a ForeignKey instead without disturbing
  anything that reads request.user off ApiKeyAuthentication.
  """
  class Status(models.TextChoices):
    PENDING = "PE", "Pending"
    APPROVED = "AP", "Approved"
    DENIED = "DE", "Denied"
    REVOKED = "RE", "Revoked"

  user = models.OneToOneField(
    settings.AUTH_USER_MODEL,
    on_delete=models.CASCADE,
    related_name="api_key",
  )
  status = models.CharField(max_length=2, choices=Status.choices, default=Status.PENDING)

  # Only the hash is ever persisted -- the plaintext token is generated and
  # returned exactly once (see issue_token below) and can never be read back,
  # same convention as GitHub/Stripe API keys. key_prefix is just enough of
  # the plaintext (never secret on its own) to let the owner recognize which
  # token is which in the UI without exposing the rest of it.
  key_prefix = models.CharField(max_length=12, blank=True, editable=False)
  hashed_key = models.CharField(max_length=64, blank=True, editable=False, db_index=True)

  note = models.TextField(blank=True, help_text="Why the user says they want API access.")
  denial_reason = models.TextField(blank=True)

  requested_at = models.DateTimeField(null=True, blank=True)
  reviewed_at = models.DateTimeField(null=True, blank=True)
  issued_at = models.DateTimeField(null=True, blank=True)
  last_used_at = models.DateTimeField(null=True, blank=True)

  def __str__(self):
    return f"{self.user.username} ({self.get_status_display()})"

  @staticmethod
  def hash_token(raw_token):
    return hashlib.sha256(raw_token.encode()).hexdigest()

  def issue_token(self):
    """Generates a brand-new plaintext token, stores only its hash, and
    returns the plaintext -- the only moment it's ever available. Also
    doubles as "regenerate": calling this again on an already-issued key
    immediately invalidates the old token, since only the latest hash is
    ever kept.
    """
    raw_token = f"osk_{secrets.token_urlsafe(32)}"
    self.key_prefix = raw_token[:12]
    self.hashed_key = self.hash_token(raw_token)
    self.issued_at = timezone.now()
    self.save(update_fields=["key_prefix", "hashed_key", "issued_at"])
    return raw_token


class SiteFeedback(models.Model):
  """A suggestion or bug report submitted from the /feedback page. Works for
  anonymous visitors too (see SiteFeedbackView), same reasoning as
  TestDriveRequest on the inventory side -- reporting a bug shouldn't require
  an account. Triaged from the Django admin; `status` is the only field an
  admin is expected to change day-to-day (see users/admin.py), so it's
  list_editable there rather than needing a change-form visit per row.
  """
  class Category(models.TextChoices):
    BUG = "BUG", "Bug Report"
    SUGGESTION = "SUG", "Suggestion"
    OTHER = "OTH", "Other"

  class Status(models.TextChoices):
    NEW = "NEW", "New"
    IN_REVIEW = "REV", "In Review"
    PLANNED = "PLN", "Planned"
    RESOLVED = "RES", "Resolved"
    DECLINED = "DEC", "Declined"

  user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="feedback_submitted",
  )
  # Only actually needed for an anonymous submitter who wants a reply -- a
  # logged-in user's account email is already on file via `user` above, so
  # this is never required regardless of auth state.
  email = models.EmailField(blank=True)

  category = models.CharField(max_length=3, choices=Category.choices, default=Category.SUGGESTION)
  subject = models.CharField(max_length=200)
  message = models.TextField()
  # Freeform, not a real URL -- "which page/feature is this about", typed by
  # the reporter (e.g. "listing detail page" or an actual pasted link).
  context = models.CharField(max_length=500, blank=True)

  status = models.CharField(max_length=3, choices=Status.choices, default=Status.NEW)
  admin_notes = models.TextField(blank=True)

  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)

  class Meta:
    ordering = ["-created_at"]

  def __str__(self):
    return f"[{self.get_category_display()}] {self.subject}"


class ContactMessage(models.Model):
  """A message sent from the /support page's contact form. Always saved here
  regardless of delivery outcome (see ContactMessageView / send_telegram_message)
  -- so nothing is lost if TELEGRAM_BOT_API_TOKEN/TELEGRAM_CHAT_ID aren't
  configured yet, or a send fails.
  """
  user = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="contact_messages",
  )
  # A logged-in sender's name/email come from `user`; only required for an
  # anonymous one (see ContactMessageSerializer.validate).
  name = models.CharField(max_length=150, blank=True)
  email = models.EmailField(blank=True)
  message = models.TextField()

  delivered = models.BooleanField(default=False, editable=False)

  created_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    ordering = ["-created_at"]

  def __str__(self):
    return f"{self.name or (self.user.username if self.user_id else 'anonymous')}: {self.message[:50]}"