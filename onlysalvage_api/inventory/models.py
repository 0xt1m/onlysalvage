from collections import Counter
from datetime import timedelta

from django.contrib.gis.db import models
from django.contrib.gis.db.models import Q, Exists, OuterRef, Subquery, Count, Case, When, IntegerField
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

class VehicleOption(models.Model):
	class Category(models.TextChoices):
		COMFORT = "CMF", "Comfort & Interior"
		TECHNOLOGY = "TEC", "Technology & Infotainment"
		SAFETY = "SAF", "Safety & Driver Assistance"
		EXTERIOR = "EXT", "Exterior & Convenience"
		PERFORMANCE = "PRF", "Performance & Towing"

	label = models.CharField(max_length=100)
	icon = models.CharField(max_length=100, blank=True)
	category = models.CharField(max_length=3, choices=Category.choices, default=Category.COMFORT)

	class Meta:
		ordering = ["category", "label"]

	def __str__(self):
		return self.label


class Make(models.Model):
	name = models.CharField(max_length=50, unique=True)

	class Meta:
		ordering = ["name"]

	def __str__(self):
		return self.name


class VehicleModel(models.Model):
	make = models.ForeignKey(Make, on_delete=models.PROTECT, related_name="models")
	name = models.CharField(max_length=100)

	class Meta:
		ordering = ["name"]
		unique_together = ("make", "name")

	def __str__(self):
		return self.name


class MakeModelRequest(models.Model):
	"""A seller-submitted request to add a make or model that isn't in the
	dropdown yet (see the Sell form's "Request a make/model" modal) --
	reviewed from the Django admin, same shape as Report's moderation queue.
	Approving one actually creates the Make/VehicleModel (see approve()
	below); nothing is created just by a request existing.
	"""
	class Kind(models.TextChoices):
		MAKE = "MAKE", "Make"
		MODEL = "MODEL", "Model"

	class Status(models.TextChoices):
		PENDING = "PE", "Pending"
		APPROVED = "AP", "Approved"
		REJECTED = "RE", "Rejected"

	kind = models.CharField(max_length=5, choices=Kind.choices)
	name = models.CharField(max_length=100)
	# Only set (and only meaningful) for a MODEL request -- the existing make
	# the requested model should be added under. Null for a MAKE request.
	make = models.ForeignKey(Make, on_delete=models.CASCADE, null=True, blank=True, related_name="model_requests")
	requested_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="make_model_requests",
	)
	status = models.CharField(max_length=2, choices=Status.choices, default=Status.PENDING)
	admin_notes = models.TextField(blank=True)
	# Whether the Telegram notification (see users/utils/telegram.py) actually
	# went out -- best-effort, same as ContactMessage/SiteFeedback: the
	# request itself is never lost even if this stays False.
	delivered = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"[{self.get_kind_display()}] {self.name}"

	def approve(self):
		"""Safe to call again on an already-approved request (e.g. re-saving
		in the admin) -- get_or_create below never creates a duplicate
		Make/VehicleModel, and this always persists status itself regardless
		of what self.status already held in memory (needed since the admin's
		save_model calls this with obj.status already set to APPROVED from
		the submitted form, before anything's actually hit the database)."""
		if self.kind == self.Kind.MAKE:
			Make.objects.get_or_create(name=self.name.strip())
		elif self.make_id:
			VehicleModel.objects.get_or_create(make=self.make, name=self.name.strip())

		self.status = self.Status.APPROVED
		self.save(update_fields=["status", "updated_at"])

	def reject(self):
		self.status = self.Status.REJECTED
		self.save(update_fields=["status", "updated_at"])


class Listing(models.Model):
	class VehicleType(models.TextChoices):
		# Deliberately just these four (plus OTHER as a catch-all) --
		# Wagon/Coupe/Hatchback used to be their own values but every listing
		# (and every new VIN decode, see the frontend's
		# mapBodyClassToVehicleType, and generalize_vehicle_type below for the
		# public API's equivalent) now folds onto whichever of these it's
		# closest to instead. See migrations/0029_squash_body_styles.py for
		# the one-time data fixup that moved every existing WGN/CPE/HBK
		# listing onto SDN.
		SEDAN = "SDN", "Sedan"
		TRUCK = "TK", "Truck"
		SUV = "SUV", "SUV"
		VAN = "VAN", "Van"
		OTHER = "OTH", "Other"

	class Status(models.TextChoices):
		# Exists only long enough for a seller to fill in the rest of the
		# form and attach photos/documents to a real listing_id -- never
		# returned to anyone but the owner (see ListingViewSet.get_queryset
		# and every other query site that reads Listing), and the unique
		# VIN constraint below deliberately doesn't apply to it.
		DRAFT = "DR", "Draft"
		AVAILABLE = "AV", "Available"
		PENDING = "PE", "Pending"
		SOLD = "SO", "Sold"

	class TitleDocument(models.TextChoices):
		# No plain CLEAN option -- every car on a salvage marketplace has a
		# branded title or a total-loss history by definition, so an
		# unqualified "clean" was never a valid state here. CLEAN_TOTAL_LOSS is
		# the one exception: a total-loss vehicle (insurance-declared) whose
		# title was never actually branded (state didn't require it, or the
		# loss reason -- e.g. theft recovery -- doesn't trigger branding).
		REBUILT = "RE", "Rebuilt"
		SALVAGE = "SA", "Salvage"
		CLEAN_TOTAL_LOSS = "CT", "Clean (Total Loss)"

	class FuelType(models.TextChoices):
		GASOLINE = "GAS", "Gasoline"
		DIESEL = "DIS", "Diesel"
		HYBRID = "HYB", "Hybrid"
		ELECTRIC = "ELC", "Electric"

	vin_validator = RegexValidator(
		regex=r'^[A-HJ-NPR-Z0-9]{17}$',
		message='VIN must be 17 characters long and contain only allowed characters (A-H, J-N, P-R, S-Z, 0-9).'
	)

	class Drive(models.TextChoices):
		FWD = "FWD", "Front Wheel Drive"
		RWD = "RWD", "Rear Wheel Drive"
		AWD = "AWD", "All Wheel Drive"
		FOUR_WD = "4WD", "Four Wheel Drive"
		AWD_ELECTRIC = "EAWD", "Electric All Wheel Drive"
		OTHER = "OTH", "Other"

	class Transmission(models.TextChoices):
		AUTOMATIC = "ATM", "Automatic"
		MANUAL = "MAN", "Manual"
		CVT = "CVT", "CVT"
		DTC = "DTC", "DTC"
		ECVT = "ECVT", "ECVT"

	class ExteriorColor(models.TextChoices):
		BLACK = "BLK", "Black"
		WHITE = "WHT", "White"
		SILVER = "SIL", "Silver"
		GREY = "GRY", "Grey"
		RED = "RED", "Red"
		BLUE = "BLU", "Blue"
		BROWN = "BRW", "Brown"
		TAN = "TAN", "Beige/Tan"
		GREEN = "GRN", "Green"
		ORANGE = "ORG", "Orange"
		YELLOW = "YEL", "Yellow"
		GOLD = "GLD", "Gold"
		MAROON = "MAR", "Maroon"
		PURPLE = "PUR", "Purple"

	class InteriorColor(models.TextChoices):
		BLACK = "BLK", "Black"
		WHITE = "WHT", "White"
		SILVER = "SIL", "Silver"
		GREY = "GRY", "Grey"
		RED = "RED", "Red"
		BLUE = "BLU", "Blue"
		BROWN = "BRW", "Brown"
		TAN = "TAN", "Beige/Tan"
		GREEN = "GRN", "Green"
		ORANGE = "ORG", "Orange"
		YELLOW = "YEL", "Yellow"
		GOLD = "GLD", "Gold"
		MAROON = "MAR", "Maroon"
		PURPLE = "PUR", "Purple"

	seller = models.ForeignKey(
		settings.AUTH_USER_MODEL, 
		on_delete=models.CASCADE,
		editable=False,
		related_name="inventory"
	)

	views_count = models.IntegerField(default=0, editable=False)
	call_count = models.IntegerField(default=0, editable=False)

	slug = models.SlugField(max_length=255, unique=True, blank=True)
	
	title = models.CharField(max_length=255)
	vin = models.CharField(max_length=17, validators=[vin_validator])
	vehicle_type = models.CharField(max_length=3, choices=VehicleType.choices, default=VehicleType.SEDAN)
	# Nullable (unlike almost everything else required here) specifically so
	# a DRAFT can exist off just a VIN -- a seller fills these in as a
	# separate step, and nothing but the VIN is needed yet to get a real
	# listing_id to attach photos/documents to. A non-draft listing must
	# still have all three (see ListingUpdateSerializer.validate), so this
	# relaxation is only ever actually exercised while status == DRAFT.
	year = models.PositiveSmallIntegerField(null=True, blank=True)
	make = models.ForeignKey(Make, on_delete=models.PROTECT, related_name="listings", null=True, blank=True)
	model = models.ForeignKey(VehicleModel, on_delete=models.PROTECT, related_name="listings", null=True, blank=True)
	trim = models.CharField(max_length=255, blank=True, null=True)

	mileage = models.PositiveIntegerField(blank=True, null=True)
	title_document = models.CharField(max_length=2, choices=TitleDocument.choices, default=TitleDocument.SALVAGE)
	fuel_type = models.CharField(max_length=3, choices=FuelType.choices, default=FuelType.GASOLINE, null=True)
	drive = models.CharField(max_length=4, choices=Drive.choices, default=Drive.FWD)
	transmission = models.CharField(max_length=4, choices=Transmission.choices, default=Transmission.AUTOMATIC)
	engine = models.CharField(max_length=255, null=True, blank=True)
	description = models.TextField(blank=True, null=True)
	exterior_color = models.CharField(max_length=3, choices=ExteriorColor.choices, blank=True, null=True)
	interior_color = models.CharField(max_length=3, choices=InteriorColor.choices, blank=True, null=True)
	video_url = models.URLField(blank=True, null=True)

	city_mpg = models.PositiveSmallIntegerField(blank=True, null=True)
	hwy_mpg = models.PositiveSmallIntegerField(blank=True, null=True)

	price = models.PositiveIntegerField(blank=True, null=True)
	sale_price = models.PositiveIntegerField(blank=True, null=True)
	retail_price = models.PositiveIntegerField(blank=True, null=True)

	carfax_pdf = models.FileField(upload_to='carfax_pdfs/', blank=True, null=True)
	alignment_report = models.FileField(upload_to='alignment_reports/', blank=True, null=True)
	inspection_report = models.FileField(upload_to='inspection_reports/', blank=True, null=True)
	owners = models.PositiveSmallIntegerField(blank=True, null=True)

	# Only ever True for a listing whose seller currently has User.offers_warranty
	# set -- see save() below, which silently clears it otherwise (mirrors
	# how User.save() clears its own dealer-only fields for non-dealers)
	# since a dealer can turn their own warranty program off after already
	# flagging some listings with it, and that shouldn't block unrelated
	# edits to those listings.
	has_warranty = models.BooleanField(default=False)

	is_active = models.BooleanField(default=True)
	status = models.CharField(max_length=2, choices=Status.choices, default=Status.AVAILABLE)
	# False for the disposable draft SellForm silently creates the moment a
	# valid VIN is typed (see ListingCreateSerializer) -- that one is meant to
	# vanish if the seller never comes back to it (see the pagehide/unmount
	# handler and delete_stale_drafts). Flips to True the first time the
	# seller explicitly saves progress on it (see ListingUpdateSerializer.update),
	# which is what makes it a real, resumable draft: visible in the owner's
	# profile Drafts section and exempt from the stale-draft sweep.
	draft_saved = models.BooleanField(default=False, editable=False)

	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	sold_at = models.DateTimeField(blank=True, null=True)

	is_promoted = models.BooleanField(default=False)
	promoted_until = models.DateTimeField(null=True, blank=True)
	promotion_priority = models.PositiveSmallIntegerField(default=0)

	# A listing that hasn't sold can be bumped back to the top of inventory
	# (see ListingViewSet.renew) instead of staying buried under everything
	# posted since -- null until the first renewal, at which point it becomes
	# the new reference point for both the next cooldown and inventory
	# ordering (see `recency` in ListingViewSet.get_queryset, which coalesces
	# this with created_at so a never-renewed listing still sorts by age).
	renewed_at = models.DateTimeField(null=True, blank=True)
	renewal_count = models.PositiveSmallIntegerField(default=0)

	RENEWAL_COOLDOWN_DAYS = 7
	MAX_RENEWALS = 3

	options = models.ManyToManyField(VehicleOption, blank=True)

	@property
	def location(self):
		return self.seller.location

	@property
	def renewal_available_at(self):
		return (self.renewed_at or self.created_at) + timedelta(days=self.RENEWAL_COOLDOWN_DAYS)

	@property
	def can_renew(self):
		return (
			self.status == self.Status.AVAILABLE
			and self.is_active
			and self.renewal_count < self.MAX_RENEWALS
			and timezone.now() >= self.renewal_available_at
		)

	def hard_delete_with_s3_images(self):
		# Used both for an abandoned DRAFT (see the delete_stale_drafts
		# command) and for an owner explicitly choosing to fully delete a
		# published listing (see ListingViewSet.perform_destroy) -- unlike
		# is_active=False (soft, keeps the row for records), this actually
		# removes the row, and since nothing else would ever clean them up,
		# also removes every real S3 object the listing owns (photos plus
		# carfax/alignment/inspection documents) rather than leaving them
		# orphaned.
		from .tasks import delete_s3_keys

		keys = []
		for image in self.images.all():
			keys += [image.original_s3_key, image.large_s3_key, image.medium_s3_key, image.thumb_s3_key]
		delete_s3_keys(keys)

		for doc_field in ("carfax_pdf", "alignment_report", "inspection_report"):
			doc = getattr(self, doc_field)
			if doc:
				doc.delete(save=False)

		self.delete()

	def clean(self):
		# A VIN can only have one "live" (available or pending) listing at a
		# time -- a second one is only allowed once the first has actually
		# sold (or been deactivated). Both statuses are checked together,
		# not just AVAILABLE, so someone can't dodge the duplicate-VIN check
		# by leaving a listing marked PENDING instead of AVAILABLE.
		if self.status in ('AV', 'PE') and self.is_active:
			if Listing.objects.filter(vin=self.vin, status__in=['AV', 'PE'], is_active=True).exclude(pk=self.pk).exists():
				raise ValidationError({'vin': 'This VIN already has an active listing (available or pending).'})

		if self.model_id and self.make_id and self.model.make_id != self.make_id:
			raise ValidationError({'model': 'Selected model does not belong to the selected make.'})

	def save(self, *args, **kwargs):
		if self.has_warranty and not (self.seller_id and self.seller.offers_warranty):
			self.has_warranty = False

		placeholder_title = f"Draft {self.vin}"
		if not self.title:
			# A draft can exist with none of year/make/model/trim set yet (see
			# their null=True above) -- falls back to something slug-able off
			# just the VIN rather than crashing on self.make.name/self.model.name
			# being None.
			parts = [str(self.year) if self.year else None, self.make.name if self.make_id else None, self.model.name if self.model_id else None, self.trim]
			self.title = " ".join(p for p in parts if p).strip() or placeholder_title

		# The slug block below only ever runs once (`if not self.slug`), so a
		# draft slugged off this placeholder title before year/make/model were
		# known would otherwise stay stuck on it (e.g. "draft-jf2sjahc1fh...")
		# forever, even after the seller fills in real details and publishes.
		# Clearing it here -- exactly this one time, the moment the title
		# stops being the placeholder -- lets the block below re-slug it off
		# the real title instead.
		placeholder_slug_base = slugify(placeholder_title)
		if self.slug and self.title != placeholder_title and (
			self.slug == placeholder_slug_base or self.slug.startswith(f"{placeholder_slug_base}-")
		):
			self.slug = ""

		if not self.slug:
			base = slugify(self.title)
			slug = base
			i = 1
			while Listing.objects.filter(slug=slug).exclude(pk=self.pk).exists():
				slug = f"{base}-{i}"
				i+=1
			self.slug = slug

		self.full_clean()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"{self.title}"

	class Meta:
		constraints = [
			# Same rule as clean() above, enforced at the DB level too (clean()
			# alone only catches it when a save() actually goes through
			# full_clean() -- e.g. not a queryset .update()) -- a VIN gets at
			# most one row that's AVAILABLE or PENDING at a time; a second one
			# is only possible once the first is SOLD (or deactivated).
			models.UniqueConstraint(
				fields=['vin'],
				condition=Q(status__in=['AV', 'PE'], is_active=True),
				name='unique_active_vin'
			)
		]


def generalize_vehicle_type(raw):
	"""Folds an arbitrary/free-text body style string onto one of
	Listing.VehicleType's real options, or OTHER if nothing matches.
	Mirrors the frontend's mapBodyClassToVehicleType (see SellForm.tsx),
	which does the same folding client-side for VIN-decoded body styles --
	but this one never gives up: an unrecognized value becomes OTHER
	instead of null, so a public-API client posting an out-of-vocabulary
	body style (see ListingCreateSerializer.to_internal_value) still gets
	a listing created instead of a flat 400 rejection.
	"""
	if not raw:
		return Listing.VehicleType.OTHER

	raw = str(raw).strip()

	# Already a valid code, any casing -- e.g. "SDN", "sdn".
	upper = raw.upper()
	if upper in Listing.VehicleType.values:
		return upper

	# Already a valid label, any casing -- e.g. "Sedan", "suv".
	lower = raw.lower()
	for code, label in Listing.VehicleType.choices:
		if label.lower() == lower:
			return code

	# Keyword-match against NHTSA's finer-grained BodyClass vocabulary --
	# same mapping as mapBodyClassToVehicleType, so a body style folds onto
	# the same bucket regardless of which of the two ever handles it.
	if "pickup" in lower:
		return Listing.VehicleType.TRUCK
	if "van" in lower or "minivan" in lower:
		return Listing.VehicleType.VAN
	if any(k in lower for k in ("sport utility", "suv", "crossover", "mpv", "multi-purpose", "multipurpose")):
		return Listing.VehicleType.SUV
	if any(k in lower for k in ("sedan", "coupe", "hatchback", "convertible", "wagon")):
		return Listing.VehicleType.SEDAN

	return Listing.VehicleType.OTHER


class ListingImage(models.Model):
	class PhotoType(models.TextChoices):
		GALLERY = "gallery", "Gallery"
		BEFORE_REPAIR = "before_repair", "Before Repair"

	listing = models.ForeignKey(
		Listing,
		on_delete=models.CASCADE,
		related_name='images',
		db_index=True
	)

	photo_type = models.CharField(max_length=20, choices=PhotoType.choices, default=PhotoType.GALLERY)

	original_s3_key = models.CharField(max_length=500)
	large_s3_key = models.CharField(max_length=500, blank=True, null=True)
	medium_s3_key = models.CharField(max_length=500, blank=True, null=True)
	thumb_s3_key = models.CharField(max_length=500, blank=True, null=True)

	status = models.CharField(
		max_length=20,
		choices=[
			("pending", "Pending"),
			("ready", "Ready"),
			("failed", "Failed"),
		],
		default="pending",
	)
	created_at = models.DateTimeField(auto_now_add=True)

	order = models.PositiveIntegerField(null=True, blank=True)

	@property
	def image_url(self):
		return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{self.original_s3_key}"

	@property
	def large_url(self):
		return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{self.large_s3_key}"

	@property
	def medium_url(self):
		return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{self.medium_s3_key}"

	@property
	def thumb_url(self):
		return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{self.thumb_s3_key}"

	def __str__(self):
		return f"Image for {self.listing.vin}"

	class Meta:
		ordering = ["order", "id"]


class ListingReview(models.Model):
	listing = models.ForeignKey(
		Listing,
		related_name="reviews",
		on_delete=models.CASCADE,
	)

	reviewer = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
	)

	rating = models.PositiveSmallIntegerField()
	comment = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("reviewer", "listing")

	def clean(self):
		if self.reviewer == self.listing.seller:
			raise ValidationError("You cannot review your own listing.")

		if not 1 <= self.rating <= 5:
			raise ValidationError("Rating must be between 1 and 5.")

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)


class Like(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="likes")
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="likes")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("user", "listing")


class SearchLog(models.Model):
	"""One row per meaningful inventory search a logged-in user runs (see
	ListingViewSet.list -- pure pagination/ordering isn't logged, only
	searches that actually narrow things down by make/type/price/etc).

	`filters` stores the raw subset of query params as sent by the frontend
	(same label-based format the browse filters already use, e.g.
	{"vehicle_type": "SUV", "max_price": "8000"}) rather than a fixed set of
	columns, so new filterable fields don't need a migration to be tracked.
	"""
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="search_logs",
	)
	filters = models.JSONField(default=dict)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]


class ListingView(models.Model):
	"""One row per time a logged-in user opens a listing's detail page (the
	seller viewing their own listing doesn't count). Along with SearchLog,
	this is the raw signal get_recommended_listings() aggregates.
	"""
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="listing_views",
	)
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="detail_views")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]


class TestDriveRequest(models.Model):
	"""A buyer's request to schedule a test drive for a listing. Works for
	anonymous visitors too (see ListingViewSet.schedule_test_drive), so the
	requester's contact details are captured as plain fields rather than
	assumed to come from a logged-in user's profile.
	"""
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="test_drive_requests")
	requester = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="test_drive_requests",
	)
	requester_name = models.CharField(max_length=150)
	requester_email = models.EmailField(blank=True)
	requester_phone = models.CharField(max_length=20, blank=True)
	preferred_datetime = models.DateTimeField()
	message = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def clean(self):
		if not self.requester_email and not self.requester_phone:
			raise ValidationError({
				"requester_email": "Provide an email or phone number so the seller can reach you.",
			})


class Report(models.Model):
	"""A user-filed complaint about a listing or a seller, reviewed from the
	Django admin (see inventory/admin.py). Targets exactly one of `listing`
	or `seller` -- rather than two separate models -- so both kinds of report
	share one moderation queue, while `clean()` still keeps each report's
	`reason` scoped to whichever kind of target it is.
	"""
	class Reason(models.TextChoices):
		FAKE_VIN = "FAKE_VIN", "VIN doesn't match the vehicle"
		DUPLICATE_VIN = "DUP_VIN", "VIN is already listed on another ad"
		MISLEADING = "MISLEADING", "Listing details are misleading or inaccurate"
		ALREADY_SOLD = "SOLD", "Vehicle has already been sold elsewhere"
		SCAM = "SCAM", "Suspected scam or fraud"
		HARASSMENT = "HARASSMENT", "Harassment or abusive behavior"
		FAKE_PROFILE = "FAKE_PROFILE", "Fake or impersonating profile"
		INAPPROPRIATE = "INAPPROPRIATE", "Inappropriate content"
		SPAM = "SPAM", "Spam"
		OTHER = "OTHER", "Other"

	# Reasons offered to the client for each target type -- also enforced
	# server-side in clean() so a listing report can't be filed with a
	# seller-only reason (like HARASSMENT) or vice versa.
	LISTING_REASONS = (Reason.FAKE_VIN, Reason.DUPLICATE_VIN, Reason.MISLEADING, Reason.ALREADY_SOLD, Reason.SCAM, Reason.INAPPROPRIATE, Reason.SPAM, Reason.OTHER)
	SELLER_REASONS = (Reason.SCAM, Reason.HARASSMENT, Reason.FAKE_PROFILE, Reason.INAPPROPRIATE, Reason.SPAM, Reason.OTHER)

	class Status(models.TextChoices):
		PENDING = "PE", "Pending"
		REVIEWED = "RE", "Reviewed"
		DISMISSED = "DI", "Dismissed"

	reporter = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="reports_filed",
	)
	listing = models.ForeignKey(Listing, on_delete=models.CASCADE, null=True, blank=True, related_name="reports")
	seller = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		null=True,
		blank=True,
		related_name="reports_received",
	)

	reason = models.CharField(max_length=20, choices=Reason.choices)
	details = models.TextField(blank=True)

	status = models.CharField(max_length=2, choices=Status.choices, default=Status.PENDING)
	created_at = models.DateTimeField(auto_now_add=True)
	reviewed_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.CheckConstraint(
				condition=(
					Q(listing__isnull=False, seller__isnull=True) |
					Q(listing__isnull=True, seller__isnull=False)
				),
				name="report_targets_exactly_one",
			)
		]

	def clean(self):
		if bool(self.listing_id) == bool(self.seller_id):
			raise ValidationError("A report must target exactly one of listing or seller.")

		if self.listing_id:
			if self.listing.seller_id == self.reporter_id:
				raise ValidationError("You cannot report your own listing.")
			if self.reason not in self.LISTING_REASONS:
				raise ValidationError({"reason": "Not a valid reason for reporting a listing."})

		if self.seller_id:
			if self.seller_id == self.reporter_id:
				raise ValidationError("You cannot report yourself.")
			if self.reason not in self.SELLER_REASONS:
				raise ValidationError({"reason": "Not a valid reason for reporting a seller."})

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)

	def __str__(self):
		target = self.listing.title if self.listing_id else self.seller.username
		return f"Report on {target} ({self.get_reason_display()})"


# How many recent SearchLog/ListingView rows to look at when building a
# preference profile -- recent enough to track a change in taste, generous
# enough that one-off searches don't dominate.
RECOMMENDATION_HISTORY_SIZE = 25


def recommendation_interest_filter(user):
	"""Builds a (interest_q, price_range, already_viewed_ids) signal from what
	`user` has recently searched for and viewed, or None if there's no usable
	signal yet (anonymous, or no search/view history at all).

	Signal weighting is intentionally simple: a viewed listing's make/type
	counts for more than a make/type mentioned in a search filter, since
	actually opening a listing is a stronger sign of interest than typing a
	filter. Shared by get_recommended_listings (the home page's teaser
	section) and ListingViewSet.get_queryset's ?recommended=true (the
	"Recommended" quick filter on the full inventory browse page) so both
	mean exactly the same thing by "recommended".
	"""
	from .filters import codes_from_labels

	if user is None or not user.is_authenticated:
		return None

	recent_views = list(
		ListingView.objects.filter(user=user)
		.select_related("listing")
		.order_by("-created_at")[:RECOMMENDATION_HISTORY_SIZE]
	)
	recent_searches = list(
		SearchLog.objects.filter(user=user).order_by("-created_at")[:RECOMMENDATION_HISTORY_SIZE]
	)

	make_ids = Counter()
	vehicle_types = Counter()
	prices = []

	for view in recent_views:
		make_ids[view.listing.make_id] += 2
		vehicle_types[view.listing.vehicle_type] += 2
		if view.listing.price:
			prices.append(view.listing.price)

	make_name_to_id = {name.lower(): mid for mid, name in Make.objects.values_list("id", "name")}

	for log in recent_searches:
		filters = log.filters or {}

		if filters.get("make"):
			for name in str(filters["make"]).split(","):
				make_id = make_name_to_id.get(name.strip().lower())
				if make_id:
					make_ids[make_id] += 1

		if filters.get("vehicle_type"):
			for code in codes_from_labels(str(filters["vehicle_type"]), Listing.VehicleType.choices):
				vehicle_types[code] += 1

		for price_key in ("min_price", "max_price"):
			if filters.get(price_key):
				try:
					prices.append(float(filters[price_key]))
				except (TypeError, ValueError):
					pass

	if not make_ids and not vehicle_types:
		return None

	interest = Q()
	if make_ids:
		interest |= Q(make_id__in=[mid for mid, _ in make_ids.most_common(3)])
	if vehicle_types:
		interest |= Q(vehicle_type__in=[vt for vt, _ in vehicle_types.most_common(3)])

	price_range = None
	if prices:
		avg_price = sum(prices) / len(prices)
		if avg_price:
			price_range = (avg_price * 0.5, avg_price * 1.5)

	already_viewed_ids = [v.listing_id for v in recent_views]

	return interest, price_range, already_viewed_ids


def get_recommended_listings(user, limit=8):
	"""Listings matching what `user` has recently searched for and viewed.

	Returns an empty queryset for anonymous users or anyone with no
	search/view history yet -- there's nothing to recommend from.
	"""
	signal = recommendation_interest_filter(user)
	if signal is None:
		return Listing.objects.none()
	interest, price_range, already_viewed_ids = signal

	qs = (
		Listing.objects.filter(is_active=True)
		.exclude(status__in=[Listing.Status.SOLD, Listing.Status.DRAFT])
		.exclude(seller=user)
		.exclude(id__in=already_viewed_ids)
		.filter(interest)
	)

	if price_range:
		qs = qs.filter(price__gte=price_range[0], price__lte=price_range[1])

	qs = (
		qs.select_related("seller", "make", "model")
		.prefetch_related("images")
		.annotate(annotated_likes_count=Count("likes", distinct=True))
		.annotate(annotated_is_liked=Exists(Like.objects.filter(listing=OuterRef("pk"), user=user)))
		.order_by("-created_at")
		.distinct()
	)

	return qs[:limit]


def get_similar_listings(listing, user=None, limit=4):
	"""Other available listings close to `listing` -- same make or vehicle
	type, and (when priced) within +/-30% -- ranked same-make first, then
	newest. Used on the listing detail page instead of a generic "recently
	added" list, since a same-make/type/price match is a much more useful
	next click than an arbitrary new listing would be.
	"""
	qs = (
		Listing.objects.filter(is_active=True)
		.exclude(id=listing.id)
		.exclude(status__in=[Listing.Status.SOLD, Listing.Status.DRAFT])
		.filter(Q(make_id=listing.make_id) | Q(vehicle_type=listing.vehicle_type))
	)

	if listing.price:
		lo, hi = listing.price * 0.7, listing.price * 1.3
		qs = qs.filter(Q(price__isnull=True) | Q(price__gte=lo, price__lte=hi))

	# Excludes the *viewer's* own listings, not the current listing's seller
	# -- if you're browsing someone else's listing, their other cars are
	# still perfectly good "similar listings"; it's only your own inventory
	# that shouldn't be recommended back to you (same rule as
	# get_recommended_listings' seller=user exclude above).
	if user is not None and user.is_authenticated:
		qs = qs.exclude(seller=user)

	qs = (
		qs.select_related("seller", "make", "model")
		.prefetch_related("images")
		.annotate(
			annotated_likes_count=Count("likes", distinct=True),
			same_make_rank=Case(
				When(make_id=listing.make_id, then=0), default=1, output_field=IntegerField()
			),
		)
		.order_by("same_make_rank", "-created_at")
	)

	if user is not None and user.is_authenticated:
		qs = qs.annotate(annotated_is_liked=Exists(Like.objects.filter(listing=OuterRef("pk"), user=user)))

	return qs[:limit]


class ListingCategory(models.Model):
	name = models.CharField(max_length=100)
	slug = models.SlugField(unique=True)
	icon = models.CharField(max_length=100, blank=True)
	image = models.ImageField(upload_to="categories/")

	class Meta:
		verbose_name_plural = "categories"

	def __str__(self):
		return self.name


class FeaturedListing(models.Model):
	class Source(models.TextChoices):
		ADMIN = "admin", "Admin"
		PAID = "paid", "Paid"

	listing = models.ForeignKey(
		Listing,
		on_delete=models.CASCADE,
		related_name="featured_periods",
	)

	start_date = models.DateTimeField(default=timezone.now)
	end_date = models.DateTimeField()

	source = models.CharField(max_length=10, choices=Source.choices, default=Source.ADMIN)
	# No `payment` FK yet -- there's no Payment model to point to. Once one
	# exists, add `payment = models.ForeignKey("payments.Payment", null=True,
	# blank=True, on_delete=models.SET_NULL)` here; adding a nullable FK is a
	# non-breaking migration, so nothing about this model needs to change to
	# support that later.

	# Lets an admin (or, later, a paid tier) control display order directly
	# instead of only ever sorting by start_date -- e.g. a promoted listing
	# can be pinned above others whose featured period simply started earlier.
	priority = models.PositiveSmallIntegerField(default=0)

	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="featured_listings_created",
	)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-priority", "start_date"]

	def is_active(self):
		now = timezone.now()
		return self.start_date <= now <= self.end_date
	is_active.boolean = True

	def clean(self):
		if self.end_date and self.start_date and self.end_date <= self.start_date:
			raise ValidationError({"end_date": "End date must be after the start date."})

	def save(self, *args, **kwargs):
		self.full_clean()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"{self.listing.title} ({self.start_date:%Y-%m-%d} → {self.end_date:%Y-%m-%d})"


def get_active_featured_listings(user=None):
	"""Listings with a currently-active FeaturedListing row, best-featured first.

	Uses a correlated Exists/Subquery pair so ordering by the active period's
	priority doesn't require pulling every listing into Python to inspect its
	featured_periods. Also select_related/prefetch_related's + annotates
	likes_count/is_liked so serializing the result doesn't re-query per row
	(see LikeInfoMixin) -- this bypasses ListingViewSet.get_queryset(), which
	does the same, so it needs its own copy.
	"""
	now = timezone.now()
	active_periods = FeaturedListing.objects.filter(
		listing=OuterRef("pk"),
		start_date__lte=now,
		end_date__gte=now,
	)

	qs = (
		Listing.objects.filter(Exists(active_periods))
		.exclude(status__in=[Listing.Status.SOLD, Listing.Status.DRAFT])
		.select_related("seller", "make", "model")
		.prefetch_related("images")
		.annotate(
			featured_priority=Subquery(active_periods.order_by("-priority", "start_date").values("priority")[:1]),
			featured_start=Subquery(active_periods.order_by("-priority", "start_date").values("start_date")[:1]),
			annotated_likes_count=Count("likes", distinct=True),
		)
		.order_by("-featured_priority", "featured_start")
	)

	if user is not None and user.is_authenticated:
		qs = qs.annotate(annotated_is_liked=Exists(Like.objects.filter(listing=OuterRef("pk"), user=user)))

	return qs


def get_most_liked_listings(user=None):
	"""Available listings with at least one like, most-liked first.

	Same select_related/prefetch_related/annotate treatment as
	get_active_featured_listings for the same reason: this bypasses
	ListingViewSet.get_queryset() so it needs its own eager-loading.
	"""
	qs = (
		Listing.objects.filter(is_active=True, status=Listing.Status.AVAILABLE)
		.select_related("seller", "make", "model")
		.prefetch_related("images")
		.annotate(annotated_likes_count=Count("likes", distinct=True))
		.filter(annotated_likes_count__gt=0)
		.order_by("-annotated_likes_count", "-created_at")
	)

	if user is not None and user.is_authenticated:
		qs = qs.annotate(annotated_is_liked=Exists(Like.objects.filter(listing=OuterRef("pk"), user=user)))

	return qs


def get_most_viewed_listings(user=None):
	"""Available listings with at least one view, most-viewed first.

	views_count (see ListingViewSet.retrieve) already excludes the owner's
	own views, so this is a plain order_by rather than needing its own
	annotation/exclusion here too. Same select_related/prefetch_related/
	likes annotation treatment as get_most_liked_listings, for the same
	reason: this bypasses ListingViewSet.get_queryset() so it needs its own.
	"""
	qs = (
		Listing.objects.filter(is_active=True, status=Listing.Status.AVAILABLE, views_count__gt=0)
		.select_related("seller", "make", "model")
		.prefetch_related("images")
		.annotate(annotated_likes_count=Count("likes", distinct=True))
		.order_by("-views_count", "-created_at")
	)

	if user is not None and user.is_authenticated:
		qs = qs.annotate(annotated_is_liked=Exists(Like.objects.filter(listing=OuterRef("pk"), user=user)))

	return qs