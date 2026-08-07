import csv
import io
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

from inventory.models import Listing, Make, VehicleModel
from inventory.tasks import import_listing_image_from_url

logger = logging.getLogger(__name__)

MAX_ROWS = 200
MAX_IMAGE_URLS_PER_ROW = 20

REQUIRED_COLUMNS = ["vin"]

# CSV header -> the model's TextChoices for every field a dealer can fill in
# with either the short code ("SUV") or the human label ("Salvage") -- mirrors
# the value/label pairs kept in lib/types.ts (VEHICLE_TYPES, TITLE_DOCUMENTS,
# etc.) on the frontend for the same fields in the manual sell/edit forms.
CHOICE_COLUMNS = {
	"vehicle_type": Listing.VehicleType.choices,
	"title_document": Listing.TitleDocument.choices,
	"fuel_type": Listing.FuelType.choices,
	"drive": Listing.Drive.choices,
	"transmission": Listing.Transmission.choices,
	"exterior_color": Listing.ExteriorColor.choices,
	"interior_color": Listing.InteriorColor.choices,
}

INT_COLUMNS = ["mileage", "price", "retail_price", "owners", "city_mpg", "hwy_mpg"]

CSV_COLUMNS = (
	["vin", "year", "make", "model", "trim"]
	+ list(CHOICE_COLUMNS.keys())
	+ INT_COLUMNS
	+ ["engine", "description", "video_url", "image_urls"]
)

# One filled-in example row so the downloaded template is self-explanatory
# without a separate instructions doc -- every value here is deliberately a
# real, resolvable one (an existing Make/VehicleModel, a real choice code).
TEMPLATE_EXAMPLE_ROW = {
	"vin": "1HGCM82633A004352",
	"year": "2018",
	"make": "Honda",
	"model": "Accord",
	"trim": "EX-L",
	"vehicle_type": "SDN",
	"title_document": "SA",
	"fuel_type": "GAS",
	"drive": "FWD",
	"transmission": "ATM",
	"exterior_color": "BLK",
	"interior_color": "GRY",
	"mileage": "62000",
	"price": "9500",
	"retail_price": "14000",
	"owners": "2",
	"city_mpg": "23",
	"hwy_mpg": "32",
	"engine": "2.0L I4 Turbo",
	"description": "Runs and drives -- front end damage, repaired and cleared.",
	"video_url": "",
	"image_urls": "https://example.com/photo1.jpg|https://example.com/photo2.jpg",
}


def generate_template_csv():
	buffer = io.StringIO()
	writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS)
	writer.writeheader()
	writer.writerow(TEMPLATE_EXAMPLE_ROW)
	return buffer.getvalue()


def _resolve_choice(value, choices):
	value = (value or "").strip()
	if not value:
		return None, None
	for code, label in choices:
		if value.lower() in (code.lower(), label.lower()):
			return code, None
	valid = ", ".join(code for code, _label in choices)
	return None, f"'{value}' isn't valid -- use one of: {valid}."


def _resolve_int(value):
	value = (value or "").strip()
	if not value:
		return None, None
	try:
		# float() first so "62000.0"-style exports from spreadsheet tools
		# don't get rejected just for having a trailing ".0".
		return int(float(value)), None
	except ValueError:
		return None, f"'{value}' isn't a whole number."


def _resolve_make(value):
	value = (value or "").strip()
	if not value:
		return None, None
	make = Make.objects.filter(name__iexact=value).first()
	if not make:
		return None, f"Unknown make '{value}' -- check the spelling matches our listings exactly."
	return make, None


def _resolve_model(value, make):
	value = (value or "").strip()
	if not value:
		return None, None
	if not make:
		return None, "A model can't be resolved without a recognized make."
	model = VehicleModel.objects.filter(make=make, name__iexact=value).first()
	if not model:
		return None, f"Unknown model '{value}' for {make.name}."
	return model, None


def _resolve_image_urls(value):
	if not value or not value.strip():
		return [], None

	urls = [u.strip() for u in value.split("|") if u.strip()]
	if len(urls) > MAX_IMAGE_URLS_PER_ROW:
		return [], f"At most {MAX_IMAGE_URLS_PER_ROW} image URLs per listing."

	bad = next((u for u in urls if not u.lower().startswith(("http://", "https://"))), None)
	if bad:
		return [], f"Not a valid URL: '{bad}'."

	return urls, None


def _flatten_validation_error(exc):
	if hasattr(exc, "message_dict"):
		return {field: "; ".join(msgs) for field, msgs in exc.message_dict.items()}
	return {"non_field_errors": "; ".join(exc.messages)}


def parse_row(seller, row):
	"""Validates one CSV row and, if it's clean, saves it as a draft listing.

	Returns (listing_or_None, image_urls, errors_dict). image_urls is only
	ever non-empty alongside a saved listing -- a row with errors never gets
	as far as queuing photo downloads.
	"""
	errors = {}

	vin = (row.get("vin") or "").strip().upper()
	if not vin:
		errors["vin"] = "VIN is required."

	year, err = _resolve_int(row.get("year"))
	if err:
		errors["year"] = err

	make, err = _resolve_make(row.get("make"))
	if err:
		errors["make"] = err

	model, err = _resolve_model(row.get("model"), make)
	if err:
		errors["model"] = err

	choice_values = {}
	for field, choices in CHOICE_COLUMNS.items():
		code, err = _resolve_choice(row.get(field), choices)
		if err:
			errors[field] = err
		elif code:
			choice_values[field] = code

	numeric_values = {}
	for field in INT_COLUMNS:
		value, err = _resolve_int(row.get(field))
		if err:
			errors[field] = err
		elif value is not None:
			numeric_values[field] = value

	image_urls, err = _resolve_image_urls(row.get("image_urls"))
	if err:
		errors["image_urls"] = err

	if errors:
		return None, [], errors

	# Imported as a draft, same as a listing a seller starts by hand (see
	# Listing.Status.DRAFT) -- this is what lets "no photo, no publish" (see
	# ListingUpdateSerializer.validate) keep holding even though CSV rows
	# can't carry real image uploads, only URLs to fetch in the background.
	# draft_saved=True (rather than the disposable, VIN-only kind SellForm
	# creates) so these show up in the dealer's Drafts tab instead of getting
	# silently swept by delete_stale_drafts.
	listing = Listing(
		seller=seller,
		status=Listing.Status.DRAFT,
		draft_saved=True,
		vin=vin,
		year=year,
		make=make,
		model=model,
		trim=(row.get("trim") or "").strip() or None,
		engine=(row.get("engine") or "").strip() or None,
		description=(row.get("description") or "").strip() or None,
		video_url=(row.get("video_url") or "").strip() or None,
		**choice_values,
		**numeric_values,
	)

	try:
		with transaction.atomic():
			# Listing.save() runs full_clean() itself, but only after first
			# auto-generating title/slug from year/make/model/trim -- calling
			# full_clean() here first would reject every row on a blank title
			# before save() ever gets the chance to fill it in.
			listing.save()
	except DjangoValidationError as exc:
		return None, [], _flatten_validation_error(exc)
	except IntegrityError:
		return None, [], {"non_field_errors": "Could not save this row."}

	return listing, image_urls, {}


def run_bulk_import(seller, uploaded_file):
	"""Returns (error_dict_or_None, results_list_or_None) -- error is only set
	for a whole-file problem (bad encoding, too many rows, missing columns);
	individual row failures are reported per-row in results instead.
	"""
	try:
		decoded = uploaded_file.read().decode("utf-8-sig")
	except UnicodeDecodeError:
		return {"detail": "Could not read the file -- please upload a UTF-8 encoded CSV."}, None

	reader = csv.DictReader(io.StringIO(decoded))
	rows = list(reader)

	if not rows:
		return {"detail": "The CSV file has no data rows."}, None

	if len(rows) > MAX_ROWS:
		return {"detail": f"Too many rows ({len(rows)}) -- split the file into batches of {MAX_ROWS} or fewer."}, None

	missing_columns = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
	if missing_columns:
		return {"detail": f"Missing required column(s): {', '.join(missing_columns)}."}, None

	results = []
	for i, row in enumerate(rows, start=2):  # row 1 is the header
		listing, image_urls, errors = parse_row(seller, row)

		if listing is None:
			results.append({
				"row": i,
				"success": False,
				"vin": (row.get("vin") or "").strip(),
				"errors": errors,
			})
			continue

		# The listing row itself is already committed at this point -- a
		# broker hiccup (Redis down/unreachable) should leave it created
		# without photos rather than turning an otherwise-successful row
		# into a 500 for the whole request (same reasoning as
		# ListingImageViewSet.perform_create's own try/except around .delay).
		for order, url in enumerate(image_urls):
			try:
				import_listing_image_from_url.delay(listing.id, url, order)
			except Exception:
				logger.exception("Failed to queue image import for listing %s: %s", listing.id, url)

		results.append({
			"row": i,
			"success": True,
			"vin": listing.vin,
			"listing": {"id": listing.id, "slug": listing.slug, "title": listing.title},
		})

	return None, results
