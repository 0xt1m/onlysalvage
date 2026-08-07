from .celery import app as celery_app

__all__ = (celery_app,)

"""
redis-server
celery -A project worker -l info
python manage.py runserver
"""