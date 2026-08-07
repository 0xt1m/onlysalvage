"""Standalone Twilio Verify send test -- run directly with:

    python scripts/test_twilio_send.py +18287820820

Prints every detail available on success or failure (status code, Twilio
error code, message, full traceback for anything unexpected) so a trial
restriction, bad credentials, or propagation delay is obvious at a glance,
without going through Django or the rest of the app.
"""

import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv
import os

# .env lives at the project root (one level up from this scripts/ dir), not
# next to this file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException


def main():
    if len(sys.argv) != 2:
        print(f"Usage: python {Path(__file__).name} <phone number, e.g. +18287820820>")
        sys.exit(1)

    to_number = sys.argv[1]

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    verify_service_sid = os.environ.get("TWILIO_VERIFY_SERVICE_SID", "")

    print("Loaded from .env:")
    print(f"  TWILIO_ACCOUNT_SID       = {account_sid[:8]}..." if account_sid else "  TWILIO_ACCOUNT_SID       = (missing)")
    print(f"  TWILIO_AUTH_TOKEN        = {'*' * 8} (set)" if auth_token else "  TWILIO_AUTH_TOKEN        = (missing)")
    print(f"  TWILIO_VERIFY_SERVICE_SID = {verify_service_sid}" if verify_service_sid else "  TWILIO_VERIFY_SERVICE_SID = (missing)")
    print()

    if not (account_sid and auth_token and verify_service_sid):
        print("One or more required env vars are missing -- aborting.")
        sys.exit(1)

    client = Client(account_sid, auth_token)

    print(f"Sending verification code to {to_number} ...")
    print()

    try:
        verification = client.verify.v2.services(verify_service_sid).verifications.create(
            to=to_number,
            channel="sms",
        )
    except TwilioRestException as e:
        print("FAILED -- TwilioRestException:")
        print(f"  HTTP status : {e.status}")
        print(f"  Error code  : {e.code}")
        print(f"  Message     : {e.msg}")
        print(f"  More info   : https://www.twilio.com/docs/errors/{e.code}")
        sys.exit(1)
    except Exception:
        print("FAILED -- unexpected (non-Twilio) exception:")
        sys.stdout.flush()
        traceback.print_exc()
        sys.exit(1)

    print("SUCCESS")
    print(f"  sid              = {verification.sid}")
    print(f"  status           = {verification.status}")
    print(f"  to               = {verification.to}")
    print(f"  channel          = {verification.channel}")
    print(f"  valid            = {verification.valid}")
    print(f"  date_created     = {verification.date_created}")
    print(f"  send_code_attempts = {verification.send_code_attempts}")


if __name__ == "__main__":
    main()
