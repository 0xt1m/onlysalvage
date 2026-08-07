import random
import re

from django.conf import settings
from django.core.cache import cache

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

# How long a locally-generated code stays valid (only relevant to the
# no-Twilio-configured fallback path below), and how long a *verified* phone
# stays usable to actually finish whatever it was being verified for
# (registration, or the settings-page verify/change-number flows) -- the gap
# between "check the code" and "submit the rest of the form" needs some slack.
CODE_TTL = 600
VERIFIED_TTL = 1800


def phone_to_e164(phone):
  # Mirrors phoneDigitsOnly in the frontend's lib/utils.ts: stored/typed
  # phones are formatted like "+1 (555) 123-4567", so stripping non-digits
  # leaves 11 digits with a leading "1" to drop, not 10 -- and there's no
  # country selector anywhere in sign-up/settings, so every phone here is
  # implicitly a US number.
  digits = re.sub(r"\D", "", phone or "")
  if len(digits) == 11 and digits.startswith("1"):
    digits = digits[1:]
  if len(digits) != 10:
    return None
  return f"+1{digits}"


def _code_cache_key(e164):
  return f"phone-code:{e164}"


def _verified_cache_key(e164):
  return f"phone-verified:{e164}"


def _twilio_client():
  # None (rather than raising) whenever any of the 3 Twilio settings is
  # missing -- lets local dev keep working against the fallback below
  # without a live Twilio account, same reasoning as EMAIL_BACKEND
  # defaulting to the console backend until real SMTP creds exist.
  if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID):
    return None
  return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def send_phone_code(phone):
  """Starts a Twilio Verify SMS check for `phone` -- every phone-verification
  flow (registration, settings verify, settings change-number) shares this
  one mechanism. Twilio generates and holds the actual code on its side (see
  check_phone_code), so there's nothing to cache here once it's configured.

  Falls back to generating and printing a local code -- same as before real
  Twilio Verify was wired up -- when TWILIO_VERIFY_SERVICE_SID isn't set, so
  local dev doesn't need a live Twilio account to exercise this flow.

  Returns True once the code is on its way (console or real SMS), False on
  a Twilio-side failure (bad number, trial-account restrictions, etc).
  """
  e164 = phone_to_e164(phone)
  if not e164:
    return False

  client = _twilio_client()
  if client is None:
    code = f"{random.randint(0, 999999):06d}"
    cache.set(_code_cache_key(e164), code, timeout=CODE_TTL)
    print(f"[Phone verification -- Twilio not configured] {e164} -> code {code}", flush=True)
    return True

  try:
    client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verifications.create(to=e164, channel="sms")
  except TwilioRestException:
    return False
  return True


def check_phone_code(phone, code):
  """Verifies `code` for `phone` -- against Twilio Verify once configured,
  or the locally-cached fallback code otherwise (see send_phone_code). On
  success, marks the phone verified (see is_phone_verified).
  """
  e164 = phone_to_e164(phone)
  if not e164 or not code:
    return False

  client = _twilio_client()
  if client is None:
    stored = cache.get(_code_cache_key(e164))
    if not stored or stored != code:
      return False
    cache.delete(_code_cache_key(e164))
  else:
    try:
      check = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks.create(to=e164, code=code)
    except TwilioRestException:
      return False
    if check.status != "approved":
      return False

  cache.set(_verified_cache_key(e164), True, timeout=VERIFIED_TTL)
  return True


def is_phone_verified(phone):
  e164 = phone_to_e164(phone)
  return bool(e164 and cache.get(_verified_cache_key(e164)))


def clear_phone_verified(phone):
  e164 = phone_to_e164(phone)
  if e164:
    cache.delete(_verified_cache_key(e164))
