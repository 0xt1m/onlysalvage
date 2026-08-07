from django.contrib import admin
from django.utils import timezone
from .models import Listing, ListingImage, VehicleOption, ListingReview, Make, VehicleModel, FeaturedListing, Report

class ListingImageInline(admin.TabularInline):
  model = ListingImage
  extra = 1

class ListingReviewInline(admin.TabularInline):
  model = ListingReview
  extra = 1

class VehicleModelInline(admin.TabularInline):
  model = VehicleModel
  extra = 1

@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
  inlines = [ListingImageInline, ListingReviewInline]
  exclude = ("seller",)
  search_fields = ["title", "vin", "seller__username"]
  list_display = (
    "title", "vin", "year", "make", "model", "price", "status",
    "is_active", "seller_username", "created_at",
  )
  list_filter = ("status", "is_active", "vehicle_type", "title_document")
  date_hierarchy = "created_at"
  # Avoids a separate query per row for each of these FK columns above.
  list_select_related = ("make", "model", "seller")

  def seller_username(self, obj):
    return obj.seller.username
  seller_username.short_description = "Seller"
  seller_username.admin_order_field = "seller__username"

  def save_model(self, request, obj, form, change):
    if not obj.pk:
      obj.seller = request.user

    super().save_model(request, obj, form, change)


class FeaturedListingActiveFilter(admin.SimpleListFilter):
  title = "active"
  parameter_name = "active"

  def lookups(self, request, model_admin):
    return (("1", "Active"), ("0", "Inactive"))

  def queryset(self, request, queryset):
    now = timezone.now()
    if self.value() == "1":
      return queryset.filter(start_date__lte=now, end_date__gte=now)
    if self.value() == "0":
      return queryset.exclude(start_date__lte=now, end_date__gte=now)
    return queryset


@admin.register(FeaturedListing)
class FeaturedListingAdmin(admin.ModelAdmin):
  list_display = ("listing_title", "start_date", "end_date", "source", "priority", "active_status")
  list_filter = ("source", FeaturedListingActiveFilter)
  search_fields = ("listing__title", "listing__vin")
  autocomplete_fields = ("listing",)

  def listing_title(self, obj):
    return obj.listing.title
  listing_title.short_description = "Listing"
  listing_title.admin_order_field = "listing__title"

  def active_status(self, obj):
    return obj.is_active()
  active_status.boolean = True
  active_status.short_description = "Active?"

  def save_model(self, request, obj, form, change):
    if not obj.pk and not obj.created_by:
      obj.created_by = request.user
    super().save_model(request, obj, form, change)

@admin.register(Make)
class MakeAdmin(admin.ModelAdmin):
  inlines = [VehicleModelInline]
  search_fields = ["name"]

@admin.register(VehicleModel)
class VehicleModelAdmin(admin.ModelAdmin):
  list_display = ["name", "make"]
  list_filter = ["make"]
  search_fields = ["name"]

@admin.register(VehicleOption)
class VehicleOptionAdmin(admin.ModelAdmin):
  list_display = ["label", "category", "icon"]
  list_filter = ["category"]
  search_fields = ["label"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
  list_display = ("target", "reason", "status", "reporter", "created_at", "reviewed_at")
  list_filter = ("status", "reason")
  search_fields = (
    "listing__title", "listing__vin", "seller__username",
    "reporter__username", "details",
  )
  readonly_fields = ("reporter", "listing", "seller", "reason", "details", "created_at")
  actions = ["mark_reviewed", "mark_dismissed"]

  def target(self, obj):
    return obj.listing.title if obj.listing_id else f"@{obj.seller.username}"

  def save_model(self, request, obj, form, change):
    if change and "status" in form.changed_data:
      obj.reviewed_at = timezone.now()
    super().save_model(request, obj, form, change)

  @admin.action(description="Mark selected reports as reviewed")
  def mark_reviewed(self, request, queryset):
    queryset.update(status=Report.Status.REVIEWED, reviewed_at=timezone.now())

  @admin.action(description="Dismiss selected reports")
  def mark_dismissed(self, request, queryset):
    queryset.update(status=Report.Status.DISMISSED, reviewed_at=timezone.now())