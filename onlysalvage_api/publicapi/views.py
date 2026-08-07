import logging

from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.throttling import UserRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db.models import F
from django.utils import timezone

from inventory.models import Listing, ListingImage
from inventory.api.serializers import ListingCreateSerializer, ListingUpdateSerializer, ListingImageSerializer
from inventory.tasks import process_listing_image, import_listing_image_from_url, store_original_image, MAX_IMPORTED_IMAGE_BYTES
from users.authentication import ApiKeyAuthentication

from .serializers import PublicListingSerializer
from .pagination import PublicApiPagination
from .filters import PublicListingFilter

logger = logging.getLogger(__name__)


class ApiKeyRateThrottle(UserRateThrottle):
	scope = "api-key"


class ApiKeyAuthMixin:
	# Strictly token-only -- deliberately not CookieJWTAuthentication (the
	# global default everywhere else), so a logged-in browser session never
	# incidentally has access here and every request must carry its own
	# Authorization: Bearer <token> header.
	authentication_classes = [ApiKeyAuthentication]
	permission_classes = [permissions.IsAuthenticated]
	throttle_classes = [ApiKeyRateThrottle]


class PublicListingViewSet(ApiKeyAuthMixin, ModelViewSet):
	"""The core of the public API: a dealer/seller's own inventory, scoped to
	whichever account the bearer token belongs to (see get_queryset) -- there
	is no way to reach another seller's listings through this API regardless
	of ID, by design (this isn't the public catalog; that's GET
	/api/inventory/listings/, which needs no token at all).
	"""
	pagination_class = PublicApiPagination
	filter_backends = [DjangoFilterBackend, OrderingFilter]
	filterset_class = PublicListingFilter
	ordering_fields = ["created_at", "updated_at", "price", "year", "mileage"]
	ordering = ["-created_at"]

	def get_queryset(self):
		return (
			Listing.objects.filter(seller=self.request.user)
			.select_related("make", "model")
			.prefetch_related("images")
		)

	def get_serializer_class(self):
		if self.action == "create":
			return ListingCreateSerializer
		if self.action in ("update", "partial_update", "change_status"):
			return ListingUpdateSerializer
		return PublicListingSerializer

	def perform_create(self, serializer):
		# Always lands as a draft, whatever status/is_active the request body
		# asked for -- this call can't carry a photo (see the images action
		# below, a separate follow-up call), and nothing may publish without
		# at least one (ListingUpdateSerializer.validate). draft_saved=True so
		# it shows up in the seller's own Drafts tab on the site itself, same
		# as a CSV bulk-import row (inventory/api/bulk_import.py) -- this API
		# and the site are two views onto the same inventory.
		serializer.save(seller=self.request.user, status=Listing.Status.DRAFT, draft_saved=True)

	def create(self, request, *args, **kwargs):
		response = super().create(request, *args, **kwargs)
		# ListingCreateSerializer's own representation doesn't include nested
		# make/model/images -- re-serialize with the richer read shape so a
		# client gets the same fields back from create() as from list/retrieve.
		listing = Listing.objects.select_related("make", "model").prefetch_related("images").get(pk=response.data["id"])
		response.data = PublicListingSerializer(listing, context=self.get_serializer_context()).data
		response.status_code = status.HTTP_201_CREATED
		return response

	def update(self, request, *args, **kwargs):
		response = super().update(request, *args, **kwargs)
		listing = self.get_object()
		response.data = PublicListingSerializer(listing, context=self.get_serializer_context()).data
		return response

	def perform_destroy(self, instance):
		instance.hard_delete_with_s3_images()

	@action(detail=True, methods=["post"], url_path="status")
	def change_status(self, request, pk=None):
		"""A narrower, single-purpose alternative to PATCH for the one field
		dealer inventory software changes constantly (mark sold/pending/
		available) -- same validation as a full edit (ListingUpdateSerializer),
		just without needing to resend the rest of the listing.
		"""
		listing = self.get_object()
		serializer = ListingUpdateSerializer(
			listing,
			data={"status": request.data.get("status")},
			partial=True,
			context=self.get_serializer_context(),
		)
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(PublicListingSerializer(listing, context=self.get_serializer_context()).data)

	@action(detail=True, methods=["post"])
	def renew(self, request, pk=None):
		listing = self.get_object()

		if not listing.can_renew:
			return Response({"detail": "This listing can't be renewed yet."}, status=status.HTTP_400_BAD_REQUEST)

		Listing.objects.filter(pk=listing.pk).update(renewed_at=timezone.now(), renewal_count=F("renewal_count") + 1)
		listing.refresh_from_db(fields=["renewed_at", "renewal_count"])

		return Response(PublicListingSerializer(listing, context=self.get_serializer_context()).data)


class PublicListingImageViewSet(ApiKeyAuthMixin, ModelViewSet):
	http_method_names = ["get", "post", "delete"]
	# A listing has at most 50 images (see ListingImageCreateSerializer.validate)
	# -- small enough to always return in full rather than making a client
	# page through its own photos.
	pagination_class = None

	def get_listing(self):
		return get_object_or_404(Listing, id=self.kwargs["listing_id"], seller=self.request.user)

	def get_queryset(self):
		return ListingImage.objects.filter(listing_id=self.kwargs["listing_id"], listing__seller=self.request.user)

	def get_serializer_class(self):
		return ListingImageSerializer

	def create(self, request, *args, **kwargs):
		listing = self.get_listing()

		order = request.data.get("order")
		order = int(order) if order not in (None, "") else None

		upload = request.FILES.get("file")
		if upload:
			if upload.size > MAX_IMPORTED_IMAGE_BYTES:
				return Response({"detail": "Image exceeds the 10MB limit."}, status=status.HTTP_400_BAD_REQUEST)

			content_type = upload.content_type or "application/octet-stream"
			if not content_type.startswith("image/"):
				return Response({"detail": "File must be an image."}, status=status.HTTP_400_BAD_REQUEST)

			image = store_original_image(listing, upload.read(), content_type, order=order)
			try:
				process_listing_image.delay(image.id)
			except Exception:
				logger.exception("Failed to queue image processing for ListingImage %s", image.id)

			return Response(ListingImageSerializer(image, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

		image_url = request.data.get("image_url")
		if image_url:
			try:
				import_listing_image_from_url.delay(listing.id, image_url, order)
			except Exception:
				logger.exception("Failed to queue image import for listing %s: %s", listing.id, image_url)
				return Response({"detail": "Couldn't queue this image for import -- try again shortly."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

			# 202, not 201 -- the ListingImage row doesn't exist yet (it's
			# created inside the task once the URL is actually fetched), so
			# there's nothing to hand back synchronously. Poll GET .../images/
			# to see it once it's ready.
			return Response({"detail": "Image queued for import."}, status=status.HTTP_202_ACCEPTED)

		return Response({"detail": "Provide either a 'file' upload or an 'image_url'."}, status=status.HTTP_400_BAD_REQUEST)


class PublicMeView(APIView):
	authentication_classes = [ApiKeyAuthentication]
	permission_classes = [permissions.IsAuthenticated]
	throttle_classes = [ApiKeyRateThrottle]

	def get(self, request):
		user = request.user
		return Response({
			"id": user.id,
			"username": user.username,
			"email": user.email,
			"business_name": user.business_name,
			"is_dealer": user.is_dealer,
			"is_verified": user.is_verified,
		})


class PublicChoicesView(APIView):
	# Static reference data, same openness as GET /api/inventory/makes/ --
	# no account-specific data involved, so no token needed to look these up
	# while building a request.
	permission_classes = [permissions.AllowAny]
	authentication_classes = []

	def get(self, request):
		def as_list(choices):
			return [{"value": value, "label": label} for value, label in choices]

		return Response({
			"status": as_list(Listing.Status.choices),
			"vehicle_type": as_list(Listing.VehicleType.choices),
			"title_document": as_list(Listing.TitleDocument.choices),
			"fuel_type": as_list(Listing.FuelType.choices),
			"drive": as_list(Listing.Drive.choices),
			"transmission": as_list(Listing.Transmission.choices),
			"exterior_color": as_list(Listing.ExteriorColor.choices),
			"interior_color": as_list(Listing.InteriorColor.choices),
		})


class PublicApiRootView(APIView):
	permission_classes = [permissions.AllowAny]
	authentication_classes = []

	def get(self, request):
		return Response({
			"documentation": "/developers",
			"authentication": "Authorization: Bearer <token>, issued from your Settings > API Access page.",
			"endpoints": {
				"me": "GET /api/v1/me/",
				"choices": "GET /api/v1/schema/choices/",
				"makes": "GET /api/inventory/makes/",
				"models": "GET /api/inventory/models/?make=<id>",
				"listings": "GET/POST /api/v1/listings/",
				"listing_detail": "GET/PATCH/DELETE /api/v1/listings/{id}/",
				"listing_status": "POST /api/v1/listings/{id}/status/",
				"listing_renew": "POST /api/v1/listings/{id}/renew/",
				"listing_images": "GET/POST /api/v1/listings/{id}/images/",
				"listing_image_delete": "DELETE /api/v1/listings/{id}/images/{image_id}/",
			},
		})
