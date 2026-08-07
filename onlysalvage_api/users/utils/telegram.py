import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_telegram_message(text):
  """Best-effort delivery to TELEGRAM_CHAT_ID via TELEGRAM_BOT_API_TOKEN
  (see settings.py for how to obtain the chat id). Returns whether it
  actually sent -- callers (see ContactMessageView) persist that on the
  record itself rather than raising, so a missing/misconfigured token never
  loses the message, just leaves it undelivered until someone checks the
  admin.
  """
  token = settings.TELEGRAM_BOT_API_TOKEN
  chat_id = settings.TELEGRAM_CHAT_ID
  if not token or not chat_id:
    return False

  try:
    response = requests.post(
      f"https://api.telegram.org/bot{token}/sendMessage",
      json={"chat_id": chat_id, "text": text},
      timeout=10,
    )
    if not response.ok:
      logger.warning("Telegram send failed: %s %s", response.status_code, response.text)
    return response.ok
  except requests.RequestException:
    logger.exception("Telegram send raised")
    return False
