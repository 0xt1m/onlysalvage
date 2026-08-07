from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
  CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView,
  UserDetailView, UserListView, UserCreateView, UserMeView,
  PasswordResetRequestView, PasswordResetConfirmView, ChangePasswordView,
  SellerReviewView, TopRatedSellersView, VerifiedSellersView, SellerListView, GoogleLoginView,
  RequestVerificationView, ReportSellerView, SellerCallView,
  AddressAutocompleteView, AddressDetailsView,
  SendPhoneCodeView, CheckPhoneCodeView,
  SendRegistrationPhoneCodeView, CheckRegistrationPhoneCodeView,
  ApiKeyStatusView, ApiKeyRequestView, ApiKeyGenerateView, ApiKeyRevokeView,
  SiteFeedbackView, ContactMessageView,
)

urlpatterns = [
    path("login/", CookieTokenObtainPairView.as_view()),
    path("login/google/", GoogleLoginView.as_view()),
    path("refresh/", CookieTokenRefreshView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", UserMeView.as_view()),
    path("me/verification/", RequestVerificationView.as_view()),
    path("me/api-key/", ApiKeyStatusView.as_view()),
    path("me/api-key/request/", ApiKeyRequestView.as_view()),
    path("me/api-key/generate/", ApiKeyGenerateView.as_view()),
    path("me/api-key/revoke/", ApiKeyRevokeView.as_view()),
    path("me/phone/send-code/", SendPhoneCodeView.as_view()),
    path("me/phone/verify-code/", CheckPhoneCodeView.as_view()),
    path("register/phone/send-code/", SendRegistrationPhoneCodeView.as_view()),
    path("register/phone/verify-code/", CheckRegistrationPhoneCodeView.as_view()),
    path("create/", UserCreateView.as_view()),
    path("password-reset/", PasswordResetRequestView.as_view()),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view()),
    path("change-password/", ChangePasswordView.as_view()),
    path("top-rated/", TopRatedSellersView.as_view()),
    path("verified/", VerifiedSellersView.as_view()),
    path("sellers/", SellerListView.as_view()),
    path("address-autocomplete/", AddressAutocompleteView.as_view()),
    path("address-details/", AddressDetailsView.as_view()),
    # Ahead of the "<str:username>/" catch-all below -- otherwise "feedback"/
    # "contact" would be swallowed as (nonexistent) username lookups.
    path("feedback/", SiteFeedbackView.as_view()),
    path("contact/", ContactMessageView.as_view()),
    path("", UserListView.as_view()),
    path("<str:username>/reviews/", SellerReviewView.as_view()),
    path("<str:username>/report/", ReportSellerView.as_view()),
    path("<str:username>/call/", SellerCallView.as_view()),
    path("<str:username>/", UserDetailView.as_view()),
]