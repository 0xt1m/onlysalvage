from rest_framework.routers import SimpleRouter
from django.urls import path, include

from .views import (
	PublicListingViewSet, PublicListingImageViewSet,
	PublicMeView, PublicChoicesView, PublicApiRootView,
)

router = SimpleRouter()
router.register("listings", PublicListingViewSet, basename="public-listing")

listing_image_list = PublicListingImageViewSet.as_view({"get": "list", "post": "create"})
listing_image_detail = PublicListingImageViewSet.as_view({"delete": "destroy"})

urlpatterns = [
	path("", PublicApiRootView.as_view()),
	path("me/", PublicMeView.as_view()),
	path("schema/choices/", PublicChoicesView.as_view()),

	# Ahead of the router include below -- otherwise "images" would be
	# swallowed by PublicListingViewSet's own listings/<pk>/ detail route.
	path("listings/<int:listing_id>/images/", listing_image_list),
	path("listings/<int:listing_id>/images/<int:pk>/", listing_image_detail),

	path("", include(router.urls)),
]
