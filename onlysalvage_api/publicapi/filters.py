import django_filters

from inventory.models import Listing


class PublicListingFilter(django_filters.FilterSet):
	# Every filter here reads codes directly (e.g. status=AV, vehicle_type=SUV)
	# rather than the human labels the frontend's own inventory filter accepts
	# (see inventory/filters.py's codes_from_labels) -- an API client is
	# expected to already know the codes from GET /api/v1/schema/choices/,
	# so there's no need for the same label-translation layer here.
	status = django_filters.CharFilter(field_name="status")
	is_active = django_filters.BooleanFilter(field_name="is_active")
	vehicle_type = django_filters.CharFilter(field_name="vehicle_type")
	make = django_filters.NumberFilter(field_name="make_id")
	model = django_filters.NumberFilter(field_name="model_id")
	vin = django_filters.CharFilter(field_name="vin", lookup_expr="iexact")
	min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
	max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
	min_year = django_filters.NumberFilter(field_name="year", lookup_expr="gte")
	max_year = django_filters.NumberFilter(field_name="year", lookup_expr="lte")

	class Meta:
		model = Listing
		fields = []
