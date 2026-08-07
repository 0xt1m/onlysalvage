from rest_framework import serializers

from inventory.models import Listing
from inventory.api.serializers import ListingImageSerializer, MakeSerializer, VehicleModelSerializer


class PublicListingSerializer(serializers.ModelSerializer):
	"""Read shape for GET /api/v1/listings/ and /api/v1/listings/{id}/ --
	deliberately its own serializer rather than reusing ListingListSerializer/
	ListingDetailSerializer, since those are shaped for the frontend (nested
	public seller info, likes_count/is_liked) and every listing here is
	already known to belong to the caller.
	"""
	make = MakeSerializer(read_only=True)
	model = VehicleModelSerializer(read_only=True)
	images = ListingImageSerializer(many=True, read_only=True)
	status_display = serializers.CharField(source="get_status_display", read_only=True)
	can_renew = serializers.BooleanField(read_only=True)
	renewal_available_at = serializers.DateTimeField(read_only=True)

	class Meta:
		model = Listing
		fields = (
			"id", "slug", "vin", "title", "status", "status_display", "is_active",
			"vehicle_type", "year", "make", "model", "trim",
			"mileage", "price", "retail_price",
			"title_document", "fuel_type", "drive", "transmission", "engine",
			"exterior_color", "interior_color", "description", "video_url",
			"city_mpg", "hwy_mpg", "owners", "has_warranty",
			"images", "views_count", "call_count",
			"can_renew", "renewal_available_at",
			"created_at", "updated_at", "sold_at",
		)
