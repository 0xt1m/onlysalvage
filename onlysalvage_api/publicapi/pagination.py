from rest_framework.pagination import PageNumberPagination


class PublicApiPagination(PageNumberPagination):
	# Bigger default/max than the browse-facing ListingPagination (30/100) --
	# a management API client is paging through its own inventory, not a UI
	# grid, so fewer round trips matters more than a small page.
	page_size = 50
	page_size_query_param = "page_size"
	max_page_size = 200
