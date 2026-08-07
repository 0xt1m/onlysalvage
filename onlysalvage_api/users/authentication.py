from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import ApiKey


class ApiKeyAuthentication(BaseAuthentication):
  """Authenticates requests to the public v1 API (see the `publicapi` app)
  against an `Authorization: Bearer <token>` header -- entirely separate
  from CookieJWTAuthentication, which is what the frontend itself uses.
  Deliberately not part of DEFAULT_AUTHENTICATION_CLASSES: only views that
  explicitly opt in (publicapi's) accept a bearer token at all.

  Only a key currently in APPROVED status ever authenticates -- a PENDING,
  DENIED, or REVOKED row's hash is still sitting in the table (kept for the
  audit trail), but ApiKey.issue_token() already replaced/cleared the hash on
  revoke, so there's nothing for a revoked token to match anyway. The
  status check is still explicit here rather than relying on that alone, so
  a future code path that forgets to clear hashed_key can't silently
  reauthorize a denied/revoked account.
  """
  keyword = "Bearer"

  def authenticate(self, request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith(f"{self.keyword} "):
      return None

    raw_token = auth_header[len(self.keyword) + 1:].strip()
    if not raw_token:
      return None

    hashed = ApiKey.hash_token(raw_token)
    try:
      api_key = ApiKey.objects.select_related("user").get(
        hashed_key=hashed,
        status=ApiKey.Status.APPROVED,
      )
    except ApiKey.DoesNotExist:
      raise AuthenticationFailed("Invalid or revoked API token.")

    if not api_key.user.is_active:
      raise AuthenticationFailed("This account is inactive.")

    ApiKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())

    return (api_key.user, api_key)

  def authenticate_header(self, request):
    return self.keyword
