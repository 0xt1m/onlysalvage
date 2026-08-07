from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from ..models import BuyerChecklistCategory, LOCALE_CODES
from .serializers import BuyerChecklistCategorySerializer


class BuyerChecklistView(ListAPIView):
	"""GET /api/checklist/?locale=uk -- public, no auth required, content is
	managed through the Django admin (see checklist/admin.py) rather than a
	code deploy. Unpaginated: the full checklist is meant to render as one
	page, not be paged through.
	"""
	permission_classes = [AllowAny]
	pagination_class = None
	serializer_class = BuyerChecklistCategorySerializer
	queryset = BuyerChecklistCategory.objects.prefetch_related("items")

	def get_serializer_context(self):
		context = super().get_serializer_context()
		locale = self.request.query_params.get("locale", "en")
		context["locale"] = locale if locale in LOCALE_CODES else "en"
		return context
