from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

class CookieJWTAuthentication(JWTAuthentication):
  def authenticate(self, request):
    raw_token = request.COOKIES.get("access")
    if raw_token is None:
      return None
    try:
      validated_token = self.get_validated_token(raw_token)
    except InvalidToken:
      return None
    return self.get_user(validated_token), validated_token