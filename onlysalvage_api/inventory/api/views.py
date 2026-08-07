import logging
import mimetypes
import uuid
import boto3

from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import SimpleRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import F, Q, Count, Exists, Max, OuterRef
from django.db.models.functions import Lower, Coalesce
from django.utils import timezone
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.http import HttpResponse

from inventory.filters import ListingFilter
from inventory.tasks import process_listing_image, build_image_key
from inventory.api.bulk_import import run_bulk_import, generate_template_csv
from inventory.models import (
	Make, VehicleModel, VehicleOption, Like, SearchLog, ListingView, TestDriveRequest, Report, MakeModelRequest, DamagePhotoRequest,
	get_active_featured_listings, get_most_liked_listings, get_most_viewed_listings,
	get_recommended_listings, get_similar_listings, recommendation_interest_filter,
)

from users.utils.geocoding import zip_to_coordinates
from users.utils.telegram import send_telegram_message

from .serializers import *
from .permissions import IsListingOwner, IsListingImageOwner

logger = logging.getLogger(__name__)


def _send_test_drive_request_email(test_drive_request):
	listing = test_drive_request.listing
	seller_email = listing.seller.email
	if not seller_email:
		return

	listing_url = f"{settings.FRONTEND_URL}/inventory/{listing.slug}"
	send_mail(
		subject=f"New test drive request for {listing.title}",
		message=(
			f"{test_drive_request.requester_name} would like to schedule a test drive "
			f"for your listing \"{listing.title}\".\n\n"
			f"Preferred date/time: {test_drive_request.preferred_datetime.strftime('%B %d, %Y at %I:%M %p')}\n"
			f"Email: {test_drive_request.requester_email or '-'}\n"
			f"Phone: {test_drive_request.requester_phone or '-'}\n"
			f"Message: {test_drive_request.message or '(no additional message)'}\n\n"
			f"View listing: {listing_url}"
		),
		from_email=settings.DEFAULT_FROM_EMAIL,
		recipient_list=[seller_email],
		fail_silently=True,
	)


def _send_damage_photo_request_email(damage_photo_request):
	listing = damage_photo_request.listing
	seller_email = listing.seller.email
	if not seller_email:
		return

	listing_url = f"{settings.FRONTEND_URL}/inventory/{listing.slug}"
	send_mail(
		subject=f"New damage photo request for {listing.title}",
		message=(
			f"{damage_photo_request.requester_name} would like to see the damage photos "
			f"for your listing \"{listing.title}\".\n\n"
			f"Email: {damage_photo_request.requester_email or '-'}\n"
			f"Phone: {damage_photo_request.requester_phone or '-'}\n"
			f"Message: {damage_photo_request.message or '(no additional message)'}\n\n"
			f"Reply to them directly and send your damage photos link -- copy it from "
			f"the listing's right-click menu or its Actions section:\n{listing_url}"
		),
		from_email=settings.DEFAULT_FROM_EMAIL,
		recipient_list=[seller_email],
		fail_silently=True,
	)


class MakeViewSet(ReadOnlyModelViewSet):
	queryset = Make.objects.all()
	serializer_class = MakeSerializer
	permission_classes = [AllowAny]
	pagination_class = None

class VehicleModelViewSet(ReadOnlyModelViewSet):
	queryset = VehicleModel.objects.all()
	serializer_class = VehicleModelSerializer
	permission_classes = [AllowAny]
	pagination_class = None

	def get_queryset(self):
		qs = super().get_queryset()
		make_ids = self.request.query_params.get("make")
		if make_ids:
			# Accepts a single id or a comma-separated list, so the inventory
			# filter's Model dropdown can show the union of models across
			# however many makes are currently checked, not just one.
			ids = [v.strip() for v in make_ids.split(",") if v.strip().isdigit()]
			qs = qs.filter(make_id__in=ids)
		return qs


class _MakeModelRequestThrottle(SimpleRateThrottle):
	# Keyed by user id, not IP -- this endpoint is already IsAuthenticated,
	# same reasoning as _PhoneVerifyThrottle (users/api/views.py): what needs
	# bounding is how many requests one *account* can file, not raw traffic.
	scope = "make-model-request"

	def get_cache_key(self, request, view):
		return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class MakeModelRequestView(APIView):
	# Sell form only, so this is login-gated -- no anonymous submissions.
	permission_classes = [IsAuthenticated]
	throttle_classes = [_MakeModelRequestThrottle]

	def post(self, request):
		serializer = MakeModelRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		req = serializer.save(requested_by=request.user)

		if req.kind == MakeModelRequest.Kind.MAKE:
			text = f"New make request from @{request.user.username}: \"{req.name}\""
		else:
			text = f"New model request from @{request.user.username}: \"{req.name}\" (make: {req.make.name})"
		delivered = send_telegram_message(text)
		if delivered:
			req.delivered = True
			req.save(update_fields=["delivered"])

		return Response(MakeModelRequestSerializer(req).data, status=status.HTTP_201_CREATED)

class VehicleOptionViewSet(ReadOnlyModelViewSet):
	queryset = VehicleOption.objects.all()
	serializer_class = VehicleOptionSerializer
	permission_classes = [AllowAny]
	pagination_class = None


class CityListView(APIView):
	# Powers the SEO city-category pages (see /cities/<slug> on the frontend) --
	# a city only gets its own page once it has more than MIN_LISTINGS active
	# listings, so this is computed live from current data rather than a fixed
	# list, and pages come and go automatically as inventory changes.
	permission_classes = [AllowAny]

	MIN_LISTINGS = 10

	def get(self, request):
		# Sellers can enter their city in any casing ("Asheville" vs.
		# "asheville"), so grouping on the raw column would silently split one
		# city's count across two rows -- group on the lowercased value instead
		# and use Max() to still get a presentable display casing back out.
		rows = (
			Listing.objects.filter(is_active=True)
			.exclude(status=Listing.Status.DRAFT)
			.exclude(seller__city="")
			.annotate(city_key=Lower("seller__city"), state_key=Lower("seller__state"))
			.values("city_key", "state_key")
			.annotate(count=Count("id"), city=Max("seller__city"), state=Max("seller__state"))
			.filter(count__gt=self.MIN_LISTINGS)
			.order_by("-count")
		)
		cities = [
			{"city": row["city"], "state": row["state"], "count": row["count"]}
			for row in rows
		]
		return Response(cities)


class VehicleTypeListView(APIView):
	# Powers the home page's "Shop by Body Style" section -- unlike cities,
	# vehicle_type is a fixed enum rather than free text, so no MIN_LISTINGS
	# threshold or casing/grouping concerns here, just: does at least one
	# listing of this body style actually exist right now.
	permission_classes = [AllowAny]

	def get(self, request):
		types = list(
			Listing.objects.filter(is_active=True)
			.exclude(status=Listing.Status.DRAFT)
			.values_list("vehicle_type", flat=True)
			.distinct()
		)
		return Response(types)


class PresignUploadView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, listing_id):
		listing = get_object_or_404(
			Listing,
			id=listing_id,
			seller=request.user,
		)

		s3 = boto3.client("s3")

		content_type = request.data.get("content_type", "image/jpeg")
		ext = mimetypes.guess_extension(content_type) or ""
		key = build_image_key(listing, "original", ext)

		presign = s3.generate_presigned_post(
			Bucket=settings.AWS_STORAGE_BUCKET_NAME,
			Key=key,
			Conditions=[
				["starts-with", "$Content-Type", "image/"],
				["content-length-range", 0, 10 * 1024 * 1024],
			],
			Fields={
				"Content-Type": content_type,
			},
			ExpiresIn=60,
		)

		return Response({
			"upload": presign,
			"s3_key": key,
		})

class ListingBulkImportTemplateView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		response = HttpResponse(generate_template_csv(), content_type="text/csv")
		response["Content-Disposition"] = 'attachment; filename="listing-import-template.csv"'
		return response


class ListingBulkImportView(APIView):
	# Dealer-only (checked below, not via permission_classes) -- a private
	# seller with one or two cars has no use for this, and letting anyone
	# hit it would make it a cheap way to mass-create draft listings.
	permission_classes = [IsAuthenticated]

	def post(self, request):
		if not request.user.is_dealer:
			return Response(
				{"detail": "Bulk import is only available to dealer accounts."},
				status=status.HTTP_403_FORBIDDEN,
			)

		uploaded_file = request.FILES.get("file")
		if not uploaded_file:
			return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

		if not uploaded_file.name.lower().endswith(".csv"):
			return Response({"detail": "Please upload a .csv file."}, status=status.HTTP_400_BAD_REQUEST)

		error, results = run_bulk_import(request.user, uploaded_file)
		if error:
			return Response(error, status=status.HTTP_400_BAD_REQUEST)

		imported = sum(1 for r in results if r["success"])
		return Response({
			"total": len(results),
			"imported": imported,
			"failed": len(results) - imported,
			"results": results,
		})


class ListingLikeView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, listing_id):
		# A draft isn't a real listing yet -- excluded rather than routed
		# through get_queryset's owner-aware filter, since liking your own
		# unpublished draft isn't a real feature either.
		listing = get_object_or_404(Listing.objects.exclude(status=Listing.Status.DRAFT), id=listing_id)
		Like.objects.get_or_create(user=request.user, listing=listing)
		return Response({"liked": True, "likes_count": listing.likes.count()})

	def delete(self, request, listing_id):
		listing = get_object_or_404(Listing.objects.exclude(status=Listing.Status.DRAFT), id=listing_id)
		Like.objects.filter(user=request.user, listing=listing).delete()
		return Response({"liked": False, "likes_count": listing.likes.count()})


class ListingCallView(APIView):
	# Still fetches the phone number through a dedicated endpoint rather than
	# including it in the listing payload -- that keeps it out of the page's
	# initial HTML for scraping purposes, it just now doubles as "the user
	# clicked Call" rather than a separate "reveal" step before the real click.
	permission_classes = [AllowAny]

	def post(self, request, listing_id):
		# Excluded for the same reason as ListingLikeView above -- an
		# unpublished draft has no business being called about.
		listing = get_object_or_404(Listing.objects.exclude(status=Listing.Status.DRAFT), id=listing_id)

		Listing.objects.filter(id=listing.id).update(
			call_count=F("call_count") + 1
		)

		return Response({"phone": listing.seller.phone})


class ListingPagination(PageNumberPagination):
	page_size = 30
	page_size_query_param = "page_size"
	max_page_size = 100


# Query params worth remembering as a SearchLog row -- pagination/ordering
# and one-off things like `ids`/`liked`/`search` aren't a durable taste
# signal, so they're deliberately left out.
TRACKED_SEARCH_PARAMS = [
	"make", "model", "vehicle_type", "fuel_type", "drive", "transmission",
	"exterior_color", "interior_color", "title_document", "seller_type",
	"offers_financing", "verified_seller",
	"min_price", "max_price", "min_year", "max_year", "min_mileage", "max_mileage",
]


class ListingViewSet(ModelViewSet):
	# select_related covers the FKs every serializer touches (seller, make, model);
	# prefetch_related covers the reverse/M2M relations (images always, the rest
	# only actually walked by ListingDetailSerializer, but prefetching them on the
	# list endpoint too is harmless -- they just go unused).
	# Without these, DRF hits the DB once per row per relation while serializing,
	# e.g. 11 listings became 35 queries (~4s over a network DB) instead of ~4.
	queryset = Listing.objects.select_related("seller", "make", "model").prefetch_related(
		"images", "options", "reviews", "seller__seller_reviews_received",
	)
	lookup_field = "slug"
	pagination_class = ListingPagination

	filter_backends = [DjangoFilterBackend, OrderingFilter]
	filterset_class = ListingFilter
	ordering_fields = ["price", "created_at", "mileage", "year", "distance"]
	# `recency` (see get_queryset) is renewed_at falling back to created_at --
	# a listing that's never been renewed still sorts by age, but renewing
	# (see the `renew` action below) bumps it back to the top of this default
	# ordering exactly like a freshly-posted one would be.
	ordering = ["-recency"]

	def filter_queryset(self, queryset):
		queryset = super().filter_queryset(queryset)

		# OrderingFilter replaces the ordering wholesale with just ["distance"]
		# when ?ordering=distance is requested, which would otherwise drop the
		# renewal signal entirely for the one sort mode where "sorted first by
		# distance, second by renewed_at" (the actual ask) matters most --
		# nearby listings are exactly where a renewal should have visible effect.
		if self.action == "list" and self.request.query_params.get("ordering") == "distance":
			queryset = queryset.order_by("distance", "-recency")

		return queryset

	def list(self, request, *args, **kwargs):
		response = super().list(request, *args, **kwargs)

		if request.user.is_authenticated:
			tracked = {
				key: request.query_params[key]
				for key in TRACKED_SEARCH_PARAMS
				if request.query_params.get(key)
			}
			if tracked:
				SearchLog.objects.create(user=request.user, filters=tracked)

		return response

	def retrieve(self, request, *args, **kwargs):
		# Reimplements RetrieveModelMixin.retrieve() rather than calling
		# super() + self.get_object() again, so this only hits the DB for the
		# instance once instead of twice.
		instance = self.get_object()

		is_owner = request.user.is_authenticated and instance.seller_id == request.user.id
		if not is_owner:
			# Every real visitor counts (not just logged-in ones, unlike
			# ListingView below) -- an owner reloading/previewing their own
			# listing shouldn't inflate it. F() keeps this a single atomic
			# UPDATE rather than a read-modify-write race under concurrent
			# views; refresh_from_db picks the new value back up so the
			# response actually reflects it instead of the stale in-memory one.
			Listing.objects.filter(pk=instance.pk).update(views_count=F("views_count") + 1)
			instance.refresh_from_db(fields=["views_count"])

			if request.user.is_authenticated:
				ListingView.objects.create(user=request.user, listing=instance)

		serializer = self.get_serializer(instance)
		return Response(serializer.data)

	def get_queryset(self):
		qs = super().get_queryset()

		# A draft only exists so its owner can fill in the rest of the form
		# and attach photos/documents to a real listing_id before publishing
		# (see SellForm's auto-draft-creation effect) -- it must never be
		# visible to anyone else, and never show up in any browse/search
		# listing, not even the owner's own (there's no "resume this draft"
		# UI, so it would just render as a broken-looking card with no
		# price/year/etc). The owner *does* still need direct retrieve/
		# update/destroy access to their own draft by slug though -- that's
		# exactly how the sell flow fills it in and eventually publishes it.
		draft = Listing.Status.DRAFT
		if self.action == "list":
			if self.request.user.is_authenticated and self.request.query_params.get("status") == draft:
				# The one deliberate exception: a request explicitly asking for
				# drafts (see the profile page's Drafts section) gets back the
				# requesting user's own *saved* drafts -- never anyone else's,
				# and never the disposable auto-created-on-VIN-entry kind that
				# was never explicitly saved (see Listing.draft_saved). Scoped
				# to seller=self.request.user regardless of any seller_id/seller
				# param passed in, so this can never leak another user's drafts.
				qs = qs.filter(status=draft, seller=self.request.user, draft_saved=True)
			else:
				qs = qs.exclude(status=draft)

				# is_active is a private "pause this listing" toggle (see the
				# Published checkbox in EditListingForm) -- hidden from
				# search/browse/everyone else, but the owner still needs to see
				# their own paused listings on their profile page (see
				# ListingResultsGrid's Inactive badge). The frontend only ever
				# omits its own `is_active=true` param for that one request
				# (seller_id=<your own id>), but this is enforced here too
				# rather than trusted client-side, same reasoning as the draft
				# scoping above -- otherwise anyone could see any seller's
				# paused listings just by leaving is_active off their own query.
				seller_id_param = self.request.query_params.get("seller_id")
				is_own_seller_view = (
					self.request.user.is_authenticated
					and seller_id_param is not None
					and seller_id_param.isdigit()
					and int(seller_id_param) == self.request.user.id
				)
				if not is_own_seller_view:
					qs = qs.filter(is_active=True)
		elif self.request.user.is_authenticated:
			qs = qs.filter(Q(status=draft, seller=self.request.user) | ~Q(status=draft))
		else:
			qs = qs.exclude(status=draft)

		# See the `ordering` class attribute and filter_queryset above -- a
		# never-renewed listing sorts by created_at, a renewed one by its most
		# recent renewal.
		qs = qs.annotate(recency=Coalesce("renewed_at", "created_at"))

		# The "Recommended" quick filter -- same taste signal (recent
		# searches/views) as the home page's Recommended section (see
		# recommendation_interest_filter), just applied to the full,
		# paginated/filterable/orderable browse queryset instead of a fixed
		# teaser list. No signal yet (or logged out) means nothing matches,
		# same as that section only rendering once there's something to show.
		if self.action == "list" and self.request.query_params.get("recommended") == "true":
			signal = recommendation_interest_filter(self.request.user)
			if signal is None:
				qs = qs.none()
			else:
				interest, price_range, already_viewed_ids = signal
				qs = qs.exclude(seller=self.request.user).exclude(id__in=already_viewed_ids).filter(interest)
				if price_range:
					qs = qs.filter(price__gte=price_range[0], price__lte=price_range[1])

		# likes_count/is_liked were previously computed per-row in
		# LikeInfoMixin via obj.likes.count() / obj.likes.filter(...).exists(),
		# each a separate query. Annotating here folds them into the single
		# main query instead; LikeInfoMixin prefers these when present.
		qs = qs.annotate(annotated_likes_count=Count("likes", distinct=True))
		if self.request.user.is_authenticated:
			qs = qs.annotate(annotated_is_liked=Exists(
				Like.objects.filter(listing=OuterRef("pk"), user=self.request.user)
			))

		lat = self.request.query_params.get("lat")
		lng = self.request.query_params.get("lng")
		zip_code = self.request.query_params.get("zip_code")
		max_distance = self.request.query_params.get("max_distance")

		user_point = None
		if lat and lng:
			try:
				user_point = Point(float(lng), float(lat), srid=4326)
			except ValueError:
				pass
		elif zip_code:
			try:
				geo_lng, geo_lat = zip_to_coordinates(zip_code)
				user_point = Point(float(geo_lng), float(geo_lat), srid=4326)
			except (ValueError, TypeError):
				pass

		if user_point:
			qs = qs.annotate(distance=Distance("seller__location", user_point))
			if max_distance:
				try:
					qs = qs.filter(seller__location__distance_lte=(user_point, D(mi=float(max_distance))))
				except ValueError:
					pass
		else:
			# No location resolved this request, so there's no `distance`
			# annotation on the queryset -- OrderingFilter treats
			# `ordering_fields` as always-valid regardless of what's actually
			# annotated, so ?ordering=distance here would otherwise raise a
			# FieldError instead of just falling back to the default ordering.
			self.ordering_fields = [f for f in self.ordering_fields if f != "distance"]

		return qs

	def get_serializer_class(self):
		if self.action == "list":
			return ListingListSerializer

		if self.action == "retrieve":
			return ListingDetailSerializer

		if self.action == "create":
			return ListingCreateSerializer

		if self.action in ["update", "partial_update"]:
			return ListingUpdateSerializer

		return ListingDetailSerializer

	def get_permissions(self):
		if self.action == "create":
			return [IsAuthenticated()]

		if self.action in ["update", "partial_update"]:
			return [IsAuthenticated(), IsListingOwner()]

		if self.action == "destroy":
			return [IsAuthenticated(), IsListingOwner()]

		if self.action == "renew":
			return [IsAuthenticated(), IsListingOwner()]

		return []

	def perform_create(self, serializer):
		serializer.save(seller=self.request.user)

	def perform_destroy(self, instance):
		# Explicitly deleting a listing (as opposed to just hiding it -- see
		# the "hide" PATCH of is_active on ListingUpdateSerializer, which is
		# what the frontend's non-destructive "Hide" action uses instead)
		# always fully removes it, drafts and published listings alike --
		# there's no soft/reversible middle ground once this is called.
		instance.hard_delete_with_s3_images()

	@action(
		detail=False,
		methods=["get"],
		url_path="featured",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def featured(self, request):
		try:
			limit = int(request.query_params.get("limit", 6))
		except ValueError:
			limit = 6

		listings = get_active_featured_listings(user=request.user)[:limit]
		serializer = ListingListSerializer(listings, many=True, context={"request": request})
		return Response(serializer.data)

	@action(
		detail=False,
		methods=["get"],
		url_path="random",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def random(self, request):
		listing = (
			Listing.objects.filter(is_active=True, status=Listing.Status.AVAILABLE)
			.order_by("?")
			.first()
		)
		if not listing:
			return Response({"detail": "No listings available."}, status=status.HTTP_404_NOT_FOUND)

		return Response({"slug": listing.slug})

	@action(
		detail=False,
		methods=["get"],
		url_path="check-vin",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def check_vin(self, request):
		# Lets the frontend warn the user (with a link to the conflicting
		# listing) before they hit submit, rather than only finding out from a
		# generic 400 after the fact. The actual create/update validate() still
		# enforces this server-side, so this endpoint is purely advisory.
		vin = request.query_params.get("vin", "").strip().upper()
		if not vin:
			return Response({"detail": "vin query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

		# Available or pending both count as "taken" -- only a sold (or
		# inactive) listing frees a VIN up again.
		qs = Listing.objects.filter(vin=vin, status__in=[Listing.Status.AVAILABLE, Listing.Status.PENDING], is_active=True)

		exclude_slug = request.query_params.get("exclude")
		if exclude_slug:
			qs = qs.exclude(slug=exclude_slug)

		existing = qs.first()
		if not existing:
			return Response({"available": True})

		return Response({
			"available": False,
			"listing": {"id": existing.id, "slug": existing.slug, "title": existing.title},
		})

	@action(
		detail=False,
		methods=["get"],
		url_path="most-liked",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def most_liked(self, request):
		try:
			limit = int(request.query_params.get("limit", 6))
		except ValueError:
			limit = 6

		listings = get_most_liked_listings(user=request.user)[:limit]
		serializer = ListingListSerializer(listings, many=True, context={"request": request})
		return Response(serializer.data)

	@action(
		detail=False,
		methods=["get"],
		url_path="most-viewed",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def most_viewed(self, request):
		try:
			limit = int(request.query_params.get("limit", 6))
		except ValueError:
			limit = 6

		listings = get_most_viewed_listings(user=request.user)[:limit]
		serializer = ListingListSerializer(listings, many=True, context={"request": request})
		return Response(serializer.data)

	@action(
		detail=False,
		methods=["get"],
		url_path="recommended",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def recommended(self, request):
		# Empty (rather than an error) for anonymous users or anyone with no
		# search/view history yet -- the frontend just hides the section then.
		try:
			limit = int(request.query_params.get("limit", 8))
		except ValueError:
			limit = 8

		listings = get_recommended_listings(request.user, limit=limit)
		serializer = ListingListSerializer(listings, many=True, context={"request": request})
		return Response(serializer.data)

	@action(
		detail=True,
		methods=["get"],
		url_path="similar",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def similar(self, request, slug=None):
		try:
			limit = int(request.query_params.get("limit", 4))
		except ValueError:
			limit = 4

		listing = self.get_object()
		listings = get_similar_listings(listing, user=request.user, limit=limit)
		serializer = ListingListSerializer(listings, many=True, context={"request": request})
		return Response(serializer.data)

	@action(
		detail=True,
		methods=["post"],
		url_path="test-drive",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def schedule_test_drive(self, request, slug=None):
		listing = self.get_object()
		serializer = TestDriveRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		test_drive_request = serializer.save(
			listing=listing,
			requester=request.user if request.user.is_authenticated else None,
		)

		_send_test_drive_request_email(test_drive_request)

		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@action(
		detail=True,
		methods=["post"],
		url_path="request-damage-photos",
		permission_classes=[AllowAny],
		pagination_class=None,
		filter_backends=[],
	)
	def request_damage_photos(self, request, slug=None):
		listing = self.get_object()
		serializer = DamagePhotoRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		damage_photo_request = serializer.save(
			listing=listing,
			requester=request.user if request.user.is_authenticated else None,
		)

		_send_damage_photo_request_email(damage_photo_request)

		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@action(
		detail=True,
		methods=["get"],
		url_path="damage-photos-link",
		permission_classes=[IsAuthenticated],
		pagination_class=None,
		filter_backends=[],
	)
	def damage_photos_link(self, request, slug=None):
		listing = self.get_object()
		if listing.seller_id != request.user.id:
			return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

		if not listing.damage_photos_token:
			# Backfills a listing saved before this feature existed -- save()
			# is what actually generates the token (see Listing.save()).
			listing.save()

		return Response({
			"url": f"{settings.FRONTEND_URL}/inventory/{listing.slug}?damage_token={listing.damage_photos_token}",
		})

	@action(
		detail=True,
		methods=["post"],
		url_path="report",
		permission_classes=[IsAuthenticated],
		pagination_class=None,
		filter_backends=[],
	)
	def report(self, request, slug=None):
		listing = self.get_object()

		if listing.seller_id == request.user.id:
			return Response({"detail": "You cannot report your own listing."}, status=status.HTTP_400_BAD_REQUEST)

		reason = request.data.get("reason")
		if reason not in Report.LISTING_REASONS:
			return Response({"reason": "Not a valid reason for reporting a listing."}, status=status.HTTP_400_BAD_REQUEST)

		serializer = ReportSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		serializer.save(reporter=request.user, listing=listing)

		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@action(
		detail=True,
		methods=["post"],
		url_path="renew",
		permission_classes=[IsAuthenticated, IsListingOwner],
		pagination_class=None,
		filter_backends=[],
	)
	def renew(self, request, slug=None):
		listing = self.get_object()

		if not listing.can_renew:
			return Response({"detail": "This listing can't be renewed yet."}, status=status.HTTP_400_BAD_REQUEST)

		Listing.objects.filter(pk=listing.pk).update(renewed_at=timezone.now(), renewal_count=F("renewal_count") + 1)
		listing.refresh_from_db(fields=["renewed_at", "renewal_count"])

		serializer = self.get_serializer(listing)
		return Response(serializer.data)


class ListingImageViewSet(ModelViewSet):
	# A listing has at most 50 images (see ListingImageCreateSerializer.validate,
	# and MAX_IMAGE_URLS_PER_ROW for bulk import) -- small enough to always
	# return in full rather than paginating at the global default of 10,
	# which would otherwise hide anything past the first page from a client
	# just polling this list for newly-arrived images (see EditListingForm).
	pagination_class = None

	def get_listing(self, require_owner=False):
		qs = Listing.objects.filter(id=self.kwargs.get("listing_id"))

		if require_owner:
			qs = qs.filter(seller=self.request.user)

		return get_object_or_404(qs)

	def get_queryset(self):
		listing_id = self.kwargs.get("listing_id")

		if self.action in ["list", "retrieve"]:
			qs = ListingImage.objects.filter(listing_id=listing_id)
			# A draft's images are otherwise reachable by anyone who knows
			# (or guesses) its listing_id, since this action normally has no
			# owner check at all -- restrict to the owner whenever the
			# underlying listing hasn't been published yet.
			user = self.request.user
			if user.is_authenticated:
				qs = qs.exclude(Q(listing__status=Listing.Status.DRAFT) & ~Q(listing__seller=user))
			else:
				qs = qs.exclude(listing__status=Listing.Status.DRAFT)
			return qs

		return ListingImage.objects.filter(
			listing_id=listing_id,
			listing__seller=self.request.user
		)
	
	def get_permissions(self):
		if self.action in ["list", "retrieve"]:
			return [AllowAny()]
		
		return [IsAuthenticated(), IsListingImageOwner()]

	def get_serializer_class(self):
		if self.action == "create":
			return ListingImageCreateSerializer
		return ListingImageSerializer

	def get_serializer_context(self):
		context = super().get_serializer_context()

		if self.action == "create":
			context["listing"] = self.get_listing(require_owner=True)
		
		return context

	def perform_create(self, serializer):
		listing = self.get_listing(require_owner=True)
		image = serializer.save(
			listing=listing,
			status="pending",
		)

		# The image row above is already committed -- from here on this is
		# just kicking off best-effort thumbnail generation. Letting a broker
		# hiccup (Celery/Redis down or unreachable) propagate would 500 a
		# request that actually succeeded, telling the uploader their photo
		# failed when it didn't. Worst case here, the photo stays "pending"
		# without resized variants until it's reprocessed.
		try:
			process_listing_image.delay(image.id)
		except Exception:
			logger.exception("Failed to queue image processing for ListingImage %s", image.id)


