from rest_framework.routers import SimpleRouter

from django.urls import path, include

from .views import ListingViewSet, ListingImageViewSet, PresignUploadView, MakeViewSet, VehicleModelViewSet, VehicleOptionViewSet, ListingLikeView, ListingCallView, CityListView, VehicleTypeListView, ListingBulkImportView, ListingBulkImportTemplateView

router = SimpleRouter()
router.register("listings", ListingViewSet, basename="listing")
router.register("makes", MakeViewSet, basename="make")
router.register("models", VehicleModelViewSet, basename="vehicle-model")
router.register("options", VehicleOptionViewSet, basename="vehicle-option")

listing_image_list = ListingImageViewSet.as_view({
  "get": "list",
  "post": "create",
})
listing_image_detail = ListingImageViewSet.as_view({
  "get": "retrieve",
  "put": "update",
  "patch": "partial_update",
  "delete": "destroy",
})

urlpatterns = [
  path(
    "listings/<int:listing_id>/images/presign/",
    PresignUploadView.as_view(),
    name="listing-image-presign",
  ),

  # Images are addressed by the listing's numeric id (not slug) so this
  # sub-resource stays decoupled from ListingViewSet's own lookup_field.
  path("listings/<int:listing_id>/images/", listing_image_list, name="listing-image-list"),
  path("listings/<int:listing_id>/images/<int:pk>/", listing_image_detail, name="listing-image-detail"),

  path("listings/<int:listing_id>/like/", ListingLikeView.as_view(), name="listing-like"),
  path("listings/<int:listing_id>/call/", ListingCallView.as_view(), name="listing-call"),

  # Ahead of the router include below -- otherwise "bulk-import" would be
  # swallowed by ListingViewSet's own listings/<slug>/ detail route.
  path("listings/bulk-import/", ListingBulkImportView.as_view(), name="listing-bulk-import"),
  path("listings/bulk-import/template/", ListingBulkImportTemplateView.as_view(), name="listing-bulk-import-template"),

  path("cities/", CityListView.as_view(), name="city-list"),
  path("vehicle-types/", VehicleTypeListView.as_view(), name="vehicle-type-list"),

  path("", include(router.urls)),
]
