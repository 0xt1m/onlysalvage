from django.urls import path

from .views import BuyerChecklistView

urlpatterns = [
	path("", BuyerChecklistView.as_view()),
]
