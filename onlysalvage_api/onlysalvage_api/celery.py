import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "onlysalvage_api.settings")

app = Celery("onlysalvage_api")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()