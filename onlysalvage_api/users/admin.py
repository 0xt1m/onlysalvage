from django import forms
from django.contrib import admin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.utils import timezone
from .models import User, SellerReview, VerificationRequest, ApiKey, SiteFeedback, ContactMessage
from inventory.models import Listing

class SellerReviewInline(admin.TabularInline):
  model = SellerReview
  fk_name = "seller"
  extra = 0
  readonly_fields = ("reviewer", "rating", "comment")

class UserAdminForm(forms.ModelForm):
  # Without this, a plain ModelAdmin form renders `password` as a normal
  # editable text box holding the raw hash -- harmless to view (hashes
  # aren't reversible), but a real footgun to edit: saving whatever text an
  # admin typed there would write it in as the literal password hash,
  # unhashed, silently breaking that account's login. This mirrors what
  # django.contrib.auth.admin.UserAdmin does for the stock User model --
  # read-only display, actual password changes go through set_password()
  # (the forgot-password flow, or `user.set_password(...); user.save()` in
  # a shell) instead of this form.
  password = ReadOnlyPasswordHashField(
    label="Password",
    help_text="Raw passwords aren't stored, so there's no way to see this user's actual password. To change it, use the forgot-password flow, or set_password() from a Django shell.",
  )

  class Meta:
    model = User
    fields = "__all__"

  def clean_password(self):
    return self.initial.get("password")

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
  form = UserAdminForm
  inlines = [SellerReviewInline]
  list_display = ("username", "email", "is_dealer", "is_verified", "is_active", "date_joined")
  list_filter = ("is_active", "is_dealer", "is_verified")
  search_fields = ("username", "email", "business_name")
  actions = ["block_users", "unblock_users"]

  def save_model(self, request, obj, form, change):
    # is_active also gates login (simplejwt rejects inactive users' tokens),
    # so unchecking it here already blocks the account -- this just makes
    # sure their listings come down too, same as the bulk action below,
    # instead of staying live under a login-blocked seller.
    if change and "is_active" in form.changed_data and not obj.is_active:
      Listing.objects.filter(seller=obj).update(is_active=False)
    super().save_model(request, obj, form, change)

  @admin.action(description="Block selected users (disable login and unpublish their listings)")
  def block_users(self, request, queryset):
    queryset.update(is_active=False)
    Listing.objects.filter(seller__in=queryset).update(is_active=False)

  @admin.action(description="Unblock selected users (re-enable login; listings stay unpublished)")
  def unblock_users(self, request, queryset):
    queryset.update(is_active=True)


@admin.register(VerificationRequest)
class VerificationRequestAdmin(admin.ModelAdmin):
  list_display = ("user", "status", "requested_at", "reviewed_at")
  list_filter = ("status",)
  search_fields = ("user__username", "user__email", "user__business_name")
  readonly_fields = ("user", "requested_at")
  actions = ["mark_verified", "mark_rejected"]

  def save_model(self, request, obj, form, change):
    # Also keep User.is_verified in sync when the status is changed directly
    # on the change form, not just via the bulk actions below.
    if change and "status" in form.changed_data:
      obj.reviewed_at = timezone.now()
      obj.user.is_verified = obj.status == VerificationRequest.Status.APPROVED
      obj.user.save(update_fields=["is_verified"])
    super().save_model(request, obj, form, change)

  @admin.action(description="Mark selected requests as verified")
  def mark_verified(self, request, queryset):
    now = timezone.now()
    for verification_request in queryset:
      verification_request.status = VerificationRequest.Status.APPROVED
      verification_request.reviewed_at = now
      verification_request.save(update_fields=["status", "reviewed_at"])
      verification_request.user.is_verified = True
      verification_request.user.save(update_fields=["is_verified"])

  @admin.action(description="Reject selected requests")
  def mark_rejected(self, request, queryset):
    now = timezone.now()
    for verification_request in queryset:
      verification_request.status = VerificationRequest.Status.REJECTED
      verification_request.reviewed_at = now
      verification_request.save(update_fields=["status", "reviewed_at"])
      verification_request.user.is_verified = False
      verification_request.user.save(update_fields=["is_verified"])


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
  # Approving here only unlocks self-service token generation (see
  # ApiKeyGenerateView) -- the plaintext token itself is never generated or
  # seen here, only by the account owner, once, from their own settings page.
  list_display = ("user", "status", "requested_at", "reviewed_at", "issued_at", "last_used_at")
  list_filter = ("status",)
  search_fields = ("user__username", "user__email", "user__business_name")
  readonly_fields = ("user", "key_prefix", "requested_at", "issued_at", "last_used_at", "note")
  fields = ("user", "status", "note", "denial_reason", "key_prefix", "requested_at", "reviewed_at", "issued_at", "last_used_at")
  actions = ["approve_requests", "deny_requests"]

  def save_model(self, request, obj, form, change):
    # Also keep reviewed_at in sync when status is changed directly on the
    # change form, not just via the bulk actions below.
    if change and "status" in form.changed_data:
      obj.reviewed_at = timezone.now()
    super().save_model(request, obj, form, change)

  @admin.action(description="Approve selected requests")
  def approve_requests(self, request, queryset):
    now = timezone.now()
    queryset.filter(status=ApiKey.Status.PENDING).update(status=ApiKey.Status.APPROVED, reviewed_at=now)

  @admin.action(description="Deny selected requests")
  def deny_requests(self, request, queryset):
    now = timezone.now()
    queryset.filter(status=ApiKey.Status.PENDING).update(status=ApiKey.Status.DENIED, reviewed_at=now)


@admin.register(SiteFeedback)
class SiteFeedbackAdmin(admin.ModelAdmin):
  list_display = ("subject", "category", "status", "user", "email", "created_at")
  list_filter = ("category", "status")
  list_editable = ("status",)
  search_fields = ("subject", "message", "email", "user__username", "user__email")
  readonly_fields = ("user", "email", "category", "subject", "message", "context", "created_at", "updated_at")
  fields = ("user", "email", "category", "subject", "message", "context", "status", "admin_notes", "created_at", "updated_at")


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
  list_display = ("__str__", "email", "delivered", "created_at")
  list_filter = ("delivered",)
  search_fields = ("name", "email", "message", "user__username", "user__email")
  readonly_fields = ("user", "name", "email", "message", "delivered", "created_at")