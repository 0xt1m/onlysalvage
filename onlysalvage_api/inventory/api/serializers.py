from rest_framework import serializers
from inventory.models import Listing, ListingImage, VehicleOption, ListingReview, Make, VehicleModel, TestDriveRequest, Report, MakeModelRequest, generalize_vehicle_type
from users.api.serializers import PublicUserSerializer, SmallUserSerializer
from users.utils.phone import phone_to_e164


class MakeSerializer(serializers.ModelSerializer):
	class Meta:
		model = Make
		fields = ("id", "name")

class VehicleModelSerializer(serializers.ModelSerializer):
	class Meta:
		model = VehicleModel
		fields = ("id", "name", "make")

class MakeModelRequestSerializer(serializers.ModelSerializer):
	class Meta:
		model = MakeModelRequest
		fields = ("id", "kind", "name", "make", "status", "created_at")
		read_only_fields = ("id", "status", "created_at")

	def validate(self, data):
		kind = data.get("kind")
		name = (data.get("name") or "").strip()
		make = data.get("make")

		if not name:
			raise serializers.ValidationError({"name": "This field is required."})
		data["name"] = name

		if kind == MakeModelRequest.Kind.MODEL:
			if not make:
				raise serializers.ValidationError({"make": "Required when requesting a new model."})
			if VehicleModel.objects.filter(make=make, name__iexact=name).exists():
				raise serializers.ValidationError({"name": "This model already exists for that make."})
		elif kind == MakeModelRequest.Kind.MAKE:
			if make:
				raise serializers.ValidationError({"make": "Not used when requesting a new make."})
			if Make.objects.filter(name__iexact=name).exists():
				raise serializers.ValidationError({"name": "This make already exists."})

		return data

class ListingImageSerializer(serializers.ModelSerializer):
	class Meta:
		model = ListingImage
		fields = ("id", "image_url", "large_url", "medium_url", "thumb_url", "order", "photo_type",)

class ListingThumbnailSerializer(serializers.ModelSerializer):
	class Meta:
		model = ListingImage
		fields = ("id", "thumb_url", "medium_url", "large_url", "image_url")

class ListingImageCreateSerializer(serializers.ModelSerializer):
	class Meta:
		model = ListingImage
		fields = ("original_s3_key", "order", "photo_type")

	def validate(self, attrs):
		listing = self.context["listing"]
		MAX_IMAGES = 50

		if listing.images.count() >= MAX_IMAGES:
			raise serializers.ValidationError(
				f"Maximum of {MAX_IMAGES} images per listing."
			)

		return attrs

class VehicleOptionSerializer(serializers.ModelSerializer):
	class Meta:
		model = VehicleOption
		fields = ("id", "label", "icon", "category")

class ListingReviewSerializer(serializers.ModelSerializer):
	class Meta:
		model = ListingReview
		fields = ("id", "reviewer", "rating", "comment", "created_at")


class TestDriveRequestSerializer(serializers.ModelSerializer):
	class Meta:
		model = TestDriveRequest
		fields = (
			"id", "requester_name", "requester_email", "requester_phone",
			"preferred_datetime", "message", "created_at",
		)
		read_only_fields = ("id", "created_at")

	def validate(self, attrs):
		if not attrs.get("requester_email") and not attrs.get("requester_phone"):
			raise serializers.ValidationError({
				"requester_email": "Provide an email or phone number so the seller can reach you.",
			})
		return attrs


class ReportSerializer(serializers.ModelSerializer):
	# reporter/listing/seller are all set server-side from the request/URL
	# (see ListingViewSet.report and users' ReportSellerView), never taken
	# from client input, so only reason/details are actually writable here.
	class Meta:
		model = Report
		fields = ("id", "reason", "details", "status", "created_at")
		read_only_fields = ("id", "status", "created_at")


class LikeInfoMixin(serializers.Serializer):
	likes_count = serializers.SerializerMethodField()
	is_liked = serializers.SerializerMethodField()

	def get_likes_count(self, obj):
		# ListingViewSet annotates this so it's one query for the whole page
		# instead of one query per row -- fall back for any caller that didn't.
		annotated = getattr(obj, "annotated_likes_count", None)
		return annotated if annotated is not None else obj.likes.count()

	def get_is_liked(self, obj):
		annotated = getattr(obj, "annotated_is_liked", None)
		if annotated is not None:
			return annotated

		request = self.context.get("request")
		if not request or not request.user.is_authenticated:
			return False
		return obj.likes.filter(user=request.user).exists()


class ListingListSerializer(LikeInfoMixin, serializers.ModelSerializer):
	seller = SmallUserSerializer(read_only=True)
	thumbnails = serializers.SerializerMethodField()
	distance = serializers.SerializerMethodField()

	def get_distance(self, obj):
		# Only actually annotated when the request resolved a location (see
		# ListingViewSet.get_queryset) -- everything else just never has a
		# `.distance` attribute at all, rather than it being None.
		d = getattr(obj, "distance", None)
		return round(d.mi, 1) if d is not None else None

	def get_thumbnails(self, obj):
		# Gallery and "before repair" photos are reordered independently in
		# the sell/edit forms (each its own drag-to-reorder list starting at
		# 0), so their `order` values routinely collide across the two
		# types. A plain `source="images"` field would serialize whatever
		# order the DB happens to return, which could just as easily put a
		# before/after comparison photo first as the actual cover photo --
		# filtering here is what keeps listing cards (which only ever show
		# thumbnails[0]) showing an actual gallery photo.
		# Filtered/sorted in Python rather than via .filter()/.order_by(),
		# since obj.images is prefetched on the list queryset (see
		# ListingViewSet) and a fresh queryset call here would defeat that.
		gallery_images = [img for img in obj.images.all() if img.photo_type == ListingImage.PhotoType.GALLERY]
		gallery_images.sort(key=lambda img: (img.order if img.order is not None else float("inf"), img.id))
		return ListingThumbnailSerializer(gallery_images, many=True, context=self.context).data

	class Meta:
		model = Listing
		fields = (
			"id",
			"slug",
			"title",
			"price",
			"is_promoted",
			"is_active",
			"thumbnails",
			"seller",
			"vin",
			"status",
			"year",
			"mileage",
			"transmission",
			"fuel_type",
			"created_at",
			"likes_count",
			"is_liked",
			"call_count",
			"views_count",
			"has_warranty",
			"distance",
		)

class ListingSellerSerializer(PublicUserSerializer):
	# The seller's phone number is fetched separately (see ListingCallView) so
	# it isn't sitting in the page's initial payload for anyone to read --
	# that fetch is what increments call_count. has_phone just lets the
	# frontend decide whether to show the Call button at all, without
	# leaking the number itself. phone_area_code leaks just the first 3
	# digits up front (see ContactSellerCard's masked "+1 (XXX) •••-••••"),
	# same "area code only" disclosure the /support and /guide pages already
	# describe -- not sensitive enough on its own to identify or reach anyone.
	has_phone = serializers.SerializerMethodField()
	phone_area_code = serializers.SerializerMethodField()

	class Meta(PublicUserSerializer.Meta):
		fields = tuple(f for f in PublicUserSerializer.Meta.fields if f != "phone") + ("has_phone", "phone_area_code")

	def get_has_phone(self, obj):
		return bool(obj.phone)

	def get_phone_area_code(self, obj):
		e164 = phone_to_e164(obj.phone)
		return e164[2:5] if e164 else None


class ListingDetailSerializer(LikeInfoMixin, serializers.ModelSerializer):
	seller = ListingSellerSerializer(read_only=True)
	images = ListingImageSerializer(many=True, read_only=True)
	options = VehicleOptionSerializer(many=True, read_only=True)
	reviews = ListingReviewSerializer(many=True, read_only=True)
	make = MakeSerializer(read_only=True)
	model = VehicleModelSerializer(read_only=True)
	# Both derived from Listing.renewed_at/renewal_count (see the model) --
	# exposed here rather than left for the frontend to compute so the 7-day
	# cooldown and 3-renewal cap only ever live in one place.
	can_renew = serializers.BooleanField(read_only=True)
	renewal_available_at = serializers.DateTimeField(read_only=True)

	class Meta:
		model = Listing
		fields = "__all__"

class ListingCreateSerializer(serializers.ModelSerializer):
	# Not required -- Listing.save() auto-generates it from year/make/model/
	# trim whenever it's left blank, which is exactly the case for a draft
	# created before the seller has necessarily settled on a trim. Without
	# this override, ModelSerializer marks it required=True purely because
	# the model field itself has no blank=True (a DB-level constraint, not a
	# statement that clients must always supply it).
	title = serializers.CharField(required=False, allow_blank=True)

	class Meta:
		model = Listing
		fields = [
			"id",
			"views_count",
			"call_count",
			"slug",
			"title",
			"vin",
			"vehicle_type",
			"year", 
			"make", 
			"model", 
			"trim",
			"mileage",
			"title_document",
			"fuel_type",
			"drive",
			"transmission",
			"engine",
			"description",
			"exterior_color",
			"interior_color",
			"video_url",
			"city_mpg",
			"hwy_mpg",
			"price",
			"retail_price",
			"carfax_pdf",
			"alignment_report",
			"inspection_report",
			"owners",
			"options",
			"is_active",
			"status",
			"has_warranty",
		]

	def to_internal_value(self, data):
		# The internal Sell form already normalizes vehicle_type client-side
		# (see SellForm.tsx's mapBodyClassToVehicleType, run at VIN-decode
		# time) before ever submitting, so this is a no-op for it. It's the
		# public API that can receive arbitrary free-text body styles from a
		# third-party client -- generalize_vehicle_type folds those onto one
		# of the real options (or OTHER) here, before DRF's auto ChoiceField
		# would otherwise flat-out reject anything not already an exact
		# match, since that happens before validate()/validate_<field> ever run.
		raw = data.get("vehicle_type") if hasattr(data, "get") else None
		if raw and raw not in Listing.VehicleType.values:
			data = data.copy()
			data["vehicle_type"] = generalize_vehicle_type(raw)

		return super().to_internal_value(data)

	def validate(self, data):
		vin = data.get("vin")
		status = data.get("status")

		# A VIN can only have one active (available or pending) listing at a
		# time -- a duplicate is only allowed once the other one has sold.
		if vin and status in ("AV", "PE"):
			qs = Listing.objects.filter(vin=vin, status__in=["AV", "PE"], is_active=True)

			if self.instance:
				qs = qs.exclude(pk=self.instance.pk)

			if qs.exists():
				raise serializers.ValidationError({
					"vin": "This VIN already has an active listing (available or pending)."
				})

		make = data.get("make")
		model = data.get("model")
		if make and model and model.make_id != make.id:
			raise serializers.ValidationError({
				"model": "Selected model does not belong to the selected make."
			})

		if data.get("has_warranty"):
			request = self.context.get("request")
			if not (request and request.user.offers_warranty):
				raise serializers.ValidationError({
					"has_warranty": "You don't currently offer a warranty -- enable it in your settings first."
				})

		return data


class ListingImageOrderSerializer(serializers.Serializer):
	# Deliberately not a ModelSerializer: reusing ListingImageSerializer here would
	# make "id" read-only (DRF auto-detects plain pk fields as read-only), so the
	# client-supplied id used to look up which image to reorder would be silently
	# stripped before update() ever saw it.
	id = serializers.IntegerField()
	order = serializers.IntegerField(required=False, allow_null=True)


class ListingUpdateSerializer(serializers.ModelSerializer):
	images = ListingImageOrderSerializer(many=True, required=False)

	class Meta:
		model = Listing
		fields = (
			"slug",
			"title",
			"vin",
			"vehicle_type",
			"year",
			"make",
			"model",
			"trim",
			"mileage",
			"title_document",
			"fuel_type",
			"drive",
			"transmission",
			"engine",
			"description",
			"exterior_color",
			"interior_color",
			"video_url",
			"city_mpg",
			"hwy_mpg",
			"price",
			"retail_price",
			"carfax_pdf",
			"alignment_report",
			"inspection_report",
			"owners",
			"options",
			"is_active",
			"status",
			"has_warranty",
			"images"
		)
		# The model auto-regenerates the slug the moment the title moves off
		# its "Draft {vin}" placeholder (see Listing.save()) -- exactly what
		# happens the first time a draft is published, since the real title
		# is only ever set here. A client redirecting to the pre-publish slug
		# it already had cached would 404, so this needs to be readable in
		# the response; it was never meant to be client-settable regardless.
		read_only_fields = ("slug",)

	def validate(self, data):
		vin = data.get("vin", getattr(self.instance, "vin", None))
		status = data.get("status", getattr(self.instance, "status", None))
		is_active = data.get("is_active", getattr(self.instance, "is_active", True))

		# Same rule as ListingCreateSerializer.validate: a VIN can only have
		# one active (available or pending) listing at a time.
		if vin and status in ("AV", "PE") and is_active:
			qs = Listing.objects.filter(vin=vin, status__in=["AV", "PE"], is_active=True)

			if self.instance:
				qs = qs.exclude(pk=self.instance.pk)

			if qs.exists():
				raise serializers.ValidationError({
					"vin": "This VIN already has an active listing (available or pending)."
				})

		make = data.get("make", getattr(self.instance, "make", None))
		model = data.get("model", getattr(self.instance, "model", None))
		if make and model and model.make_id != make.id:
			raise serializers.ValidationError({
				"model": "Selected model does not belong to the selected make."
			})

		# year/make/model/price are nullable at the model level purely so a
		# DRAFT can exist off just a VIN (see Listing.year's comment) -- but
		# once it's leaving DRAFT (publishing, or any other real status), it
		# has to actually be a usable listing again, same as before drafts
		# existed at all.
		if status and status != "DR":
			year = data.get("year", getattr(self.instance, "year", None))
			price = data.get("price", getattr(self.instance, "price", None))
			missing = {}
			if not year:
				missing["year"] = "Year is required."
			if not make:
				missing["make"] = "Make is required."
			if not model:
				missing["model"] = "Model is required."
			if not price:
				missing["price"] = "Price is required."
			# Photos are uploaded to the draft as a separate step (see
			# ListingImageViewSet), never through this serializer's `images`
			# field (that one only reorders what's already there) -- so
			# self.instance.images already reflects whatever's actually been
			# uploaded/removed by the time this validate() runs. "Before
			# repair" photos don't count -- they're supplementary damage
			# documentation, not photos of the car as it's being sold.
			if not self.instance.images.filter(photo_type=ListingImage.PhotoType.GALLERY).exists():
				missing["images"] = "Add at least one photo before publishing."
			if missing:
				raise serializers.ValidationError(missing)

		has_warranty = data.get("has_warranty", getattr(self.instance, "has_warranty", False))
		if has_warranty:
			request = self.context.get("request")
			if not (request and request.user.offers_warranty):
				raise serializers.ValidationError({
					"has_warranty": "You don't currently offer a warranty -- enable it in your settings first."
				})

		return data

	def update(self, instance, validated_data):
		images_data = validated_data.pop("images", [])

		instance = super().update(instance, validated_data)

		# Any explicit edit to a still-draft listing (a "Save Draft" click, a
		# document upload, etc.) means the seller is actually building this
		# one out rather than having just typed a VIN and wandered off -- see
		# Listing.draft_saved. Once true this never needs to flip back; it's
		# a one-way "this draft is worth keeping" signal.
		if instance.status == Listing.Status.DRAFT and not instance.draft_saved:
			instance.draft_saved = True
			instance.save(update_fields=["draft_saved"])

		for img_data in images_data:
			img_id = img_data.get("id")
			if not img_id:
				continue

			img = instance.images.get(id=img_id)

			img.order = img_data.get("order", img.order)
			img.save(update_fields=["order"])

		return instance