import difflib
import django_filters
from django.core.cache import cache
from django.db.models import Q
from .models import Listing, Make, VehicleModel

def _make_model_names():
  # Make/VehicleModel are a small, closed set (a few hundred rows total) that
  # barely ever changes, so this is cheap to cache rather than re-querying on
  # every search request.
  def _load():
    names = set(Make.objects.values_list("name", flat=True))
    names.update(VehicleModel.objects.values_list("name", flat=True))
    return sorted(names)
  return cache.get_or_set("search_make_model_names", _load, 3600)

def fuzzy_name_matches(token, cutoff=0.72):
  # Typo tolerance for the free-text search box (e.g. "suvaru" -> "Subaru")
  # -- only worth trying on tokens long enough that a couple of wrong letters
  # can't accidentally land on an unrelated make/model.
  if len(token) < 4:
    return []
  lower_to_original = {n.lower(): n for n in _make_model_names()}
  close = difflib.get_close_matches(token.lower(), lower_to_original.keys(), n=3, cutoff=cutoff)
  return [lower_to_original[c] for c in close]

def codes_from_labels(value, choices):
  # The frontend sends human-readable labels (e.g. "Automatic,Manual"),
  # same as filter_make does with make names -- translate back to the
  # stored codes (e.g. "ATM,MAN"). Also used by get_recommended_listings()
  # to make sense of the raw filters saved in SearchLog.
  label_to_code = {label: code for code, label in choices}
  return [label_to_code[v.strip()] for v in value.split(",") if v.strip() in label_to_code]

def codes_matching_token(token, choices):
  # Used by the free-text search box (e.g. "subaru outback black" or "audi
  # manual") -- unlike codes_from_labels, this is case-insensitive and also
  # matches the raw code (e.g. "awd" against Drive.AWD), since several
  # choices' codes are themselves the common word for that attribute.
  token_lower = token.lower()
  return [code for code, label in choices if token_lower in (code.lower(), label.lower())]

class ListingFilter(django_filters.FilterSet):
  title = django_filters.CharFilter(
    method="filter_title"
  )
  vin = django_filters.CharFilter(
    field_name="vin",
    lookup_expr="iexact"
  )

  vehicle_type = django_filters.CharFilter(
    method="filter_vehicle_type"
  )

  year = django_filters.CharFilter(
    field_name="year"
  )
  min_year = django_filters.NumberFilter(
    field_name="year",
    lookup_expr="gte"
  )
  max_year = django_filters.NumberFilter(
    field_name="year",
    lookup_expr="lte"
  )
  make = django_filters.CharFilter(
    method="filter_make"
  )
  make_id = django_filters.NumberFilter(
    field_name="make_id"
  )
  model = django_filters.CharFilter(
    method="filter_model"
  )
  model_id = django_filters.NumberFilter(
    field_name="model_id"
  )
  trim = django_filters.CharFilter(
    field_name="trim"
  )

  min_mileage = django_filters.NumberFilter(
    field_name="mileage",
    lookup_expr="gte"
  )
  max_mileage = django_filters.NumberFilter(
    field_name="mileage",
    lookup_expr="lte"
  )

  fuel_type = django_filters.CharFilter(
    method="filter_fuel_type"
  )
  drive = django_filters.CharFilter(
    method="filter_drive"
  )
  transmission = django_filters.CharFilter(
    method="filter_transmission"
  )
  engine = django_filters.CharFilter(field_name="engine")
  exterior_color = django_filters.CharFilter(
    method="filter_exterior_color"
  )
  interior_color = django_filters.CharFilter(
    method="filter_interior_color"
  )

  status = django_filters.ChoiceFilter(
    field_name="status",
    choices=Listing.Status.choices
  )

  title_document = django_filters.CharFilter(
    method="filter_title_document"
  )
  seller_type = django_filters.CharFilter(
    method="filter_seller_type"
  )

  min_price = django_filters.NumberFilter(
    field_name="price", 
    lookup_expr="gte"
  )
  max_price = django_filters.NumberFilter(
    field_name="price", 
    lookup_expr="lte"
  )

  seller_id = django_filters.NumberFilter(
    field_name="seller_id"
  )
  seller = django_filters.CharFilter(
    method="filter_seller"
  )

  city = django_filters.CharFilter(
    field_name="seller__city",
    lookup_expr="iexact"
  )
  state = django_filters.CharFilter(
    field_name="seller__state",
    lookup_expr="iexact"
  )
  verified_seller = django_filters.BooleanFilter(
    field_name="seller__is_verified"
  )
  offers_financing = django_filters.BooleanFilter(
    field_name="seller__offers_financing"
  )

  is_active = django_filters.BooleanFilter(
    field_name="is_active"
  )

  liked = django_filters.BooleanFilter(method="filter_liked")
  ids = django_filters.CharFilter(method="filter_ids")
  exclude_sold = django_filters.BooleanFilter(method="filter_exclude_sold")

  search = django_filters.CharFilter(method="filter_search")

  def filter_exclude_sold(self, qs, name, value):
    if value:
      return qs.exclude(status=Listing.Status.SOLD)
    return qs

  def filter_liked(self, qs, name, value):
    user = getattr(self.request, "user", None)
    if not value or not user or not user.is_authenticated:
      return qs.none()
    return qs.filter(likes__user=user)

  def filter_ids(self, qs, name, value):
    ids = [v.strip() for v in value.split(",") if v.strip().isdigit()]
    return qs.filter(id__in=ids)

  def filter_search(self, qs, name, value):
    # Each word has to match *something* (title, make, model, or a
    # structured attribute like color/transmission/drivetrain), but
    # different words can match different fields -- so "subaru outback
    # black" finds a black Subaru Outback even though no single field
    # contains that whole phrase, and "audi manual" finds manual-transmission
    # Audis the same way.
    tokens = [t for t in value.split() if t.strip()]
    for token in tokens:
      fuzzy_names = fuzzy_name_matches(token)
      qs = qs.filter(
        Q(title__icontains=token) |
        Q(description__icontains=token) |
        Q(trim__icontains=token) |
        Q(make__name__icontains=token) |
        Q(model__name__icontains=token) |
        Q(make__name__in=fuzzy_names) |
        Q(model__name__in=fuzzy_names) |
        Q(vehicle_type__in=codes_matching_token(token, Listing.VehicleType.choices)) |
        Q(transmission__in=codes_matching_token(token, Listing.Transmission.choices)) |
        Q(drive__in=codes_matching_token(token, Listing.Drive.choices)) |
        Q(fuel_type__in=codes_matching_token(token, Listing.FuelType.choices)) |
        Q(exterior_color__in=codes_matching_token(token, Listing.ExteriorColor.choices)) |
        Q(title_document__in=codes_matching_token(token, Listing.TitleDocument.choices))
      )
    return qs

  def filter_make(self, qs, name, value):
    # Accepts a single make name or a comma-separated list of names.
    names = [v.strip() for v in value.split(",") if v.strip()]
    return qs.filter(make__name__in=names)

  def filter_model(self, qs, name, value):
    names = [v.strip() for v in value.split(",") if v.strip()]
    return qs.filter(model__name__in=names)

  def _codes_from_labels(self, value, choices):
    return codes_from_labels(value, choices)

  def filter_vehicle_type(self, qs, name, value):
    return qs.filter(vehicle_type__in=self._codes_from_labels(value, Listing.VehicleType.choices))

  def filter_fuel_type(self, qs, name, value):
    return qs.filter(fuel_type__in=self._codes_from_labels(value, Listing.FuelType.choices))

  def filter_drive(self, qs, name, value):
    return qs.filter(drive__in=self._codes_from_labels(value, Listing.Drive.choices))

  def filter_transmission(self, qs, name, value):
    return qs.filter(transmission__in=self._codes_from_labels(value, Listing.Transmission.choices))

  def filter_exterior_color(self, qs, name, value):
    return qs.filter(exterior_color__in=self._codes_from_labels(value, Listing.ExteriorColor.choices))

  def filter_interior_color(self, qs, name, value):
    return qs.filter(interior_color__in=self._codes_from_labels(value, Listing.InteriorColor.choices))

  def filter_title_document(self, qs, name, value):
    return qs.filter(title_document__in=self._codes_from_labels(value, Listing.TitleDocument.choices))

  def filter_seller_type(self, qs, name, value):
    values = {v.strip().lower() for v in value.split(",") if v.strip()}
    q = Q()
    if "dealer" in values:
      q |= Q(seller__is_dealer=True)
    if "private" in values:
      q |= Q(seller__is_dealer=False)
    return qs.filter(q) if q else qs

  def filter_title(self, qs, name, value):
    return qs.filter(
      Q(title__iexact=value) |
      Q(title__icontains=value)
    )

  def filter_seller(self, qs, name, value):
    return qs.filter(
      Q(seller__username__iexact=value) |
      Q(seller__username__icontains=value) |
      Q(seller__business_name__iexact=value) |
      Q(seller__business_name__icontains=value)
    )

  class Meta:
    model = Listing
    fields = ["is_promoted"]