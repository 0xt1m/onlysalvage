import logging
import mimetypes
import uuid

from celery import shared_task
from django.conf import settings
from django.utils.text import slugify
from io import BytesIO
from PIL import Image
import boto3
import requests

s3 = boto3.client('s3')
logger = logging.getLogger(__name__)

SIZES = {
    "large": 2400,
    "medium": 800,
    "thumb": 300,
}


def build_image_key(listing, size, ext=""):
    """S3 key for one of a listing's images -- title/seller/VIN when
    available, so browsing the bucket directly isn't just a wall of random
    UUIDs. Always ends with a short random suffix since none of those
    fields are guaranteed unique on their own (a VIN can repeat once a
    listing's sold and relisted, and title may still be blank on a
    brand-new draft -- see ListingCreateSerializer/Listing.save()).
    """
    parts = [
        slugify(listing.title) if listing.title else None,
        slugify(listing.seller.username) if listing.seller_id else None,
        listing.vin or None,
    ]
    prefix = "-".join(p for p in parts if p) or "listing"
    suffix = uuid.uuid4().hex[:8]
    return f"listing_images/{listing.id}/{size}/{prefix}-{suffix}{ext}"

@shared_task
def process_listing_image(image_id):
    from .models import ListingImage

    image = ListingImage.objects.get(id=image_id)

    updated = ListingImage.objects.filter(
        id=image_id,
        status="pending",
    )
    if updated == 0:
        return

    obj = s3.get_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=image.original_s3_key,
    )

    body = obj["Body"].read()
    img = Image.open(BytesIO(body))
    img = img.convert("RGB")

    new_keys = {}

    for name, width in SIZES.items():
        resized = img.copy()
        # LANCZOS (Pillow's highest-quality resampling filter) instead of
        # thumbnail()'s BICUBIC default -- noticeably sharper on a big
        # downscale like the original photo straight off a phone camera
        # down to these display sizes.
        resized.thumbnail((width, width * 10_000), Image.Resampling.LANCZOS)

        buffer = BytesIO()
        # quality=92 + method=6 (WebP's slowest but best-compression encode
        # mode -- fine here, this always runs async in Celery) instead of
        # the old quality=85 default, for visibly less compression
        # softness/blocking on close inspection, which matters for buyers
        # actually examining salvage damage in the photos.
        resized.save(buffer, format="WEBP", quality=92, method=6)
        buffer.seek(0)

        key = build_image_key(image.listing, name, ".webp")

        s3.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=key,
            Body=buffer,
            ContentType="image/webp",
        )

        new_keys[name] = key

    image.large_s3_key = new_keys["large"]
    image.medium_s3_key = new_keys["medium"]
    image.thumb_s3_key = new_keys["thumb"]
    image.status = "ready"

    image.save(
        update_fields=[
            "large_s3_key",
            "medium_s3_key",
            "thumb_s3_key",
            "status",
        ]
    )


MAX_IMPORTED_IMAGE_BYTES = 10 * 1024 * 1024


def store_original_image(listing, body, content_type, order=None):
    """Puts already-in-hand image bytes into S3 and creates the ListingImage
    row for them -- shared by import_listing_image_from_url below (bytes
    fetched from an external URL) and the public API's direct multipart
    upload (publicapi/views.py), so the key-naming and row creation can't
    drift between the two paths. Callers are responsible for
    triggering process_listing_image afterward -- synchronously if already
    running on a worker (see import_listing_image_from_url), via .delay()
    if called from a live web request.
    """
    from .models import ListingImage

    ext = mimetypes.guess_extension(content_type) or ""
    key = build_image_key(listing, "original", ext)

    s3.put_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Body=body,
        ContentType=content_type,
    )

    return ListingImage.objects.create(
        listing_id=listing.id,
        original_s3_key=key,
        order=order,
        status="pending",
    )


@shared_task
def import_listing_image_from_url(listing_id, url, order=None):
    """Fetches an externally-hosted photo (see the CSV bulk-import's
    image_urls column -- inventory/api/bulk_import.py -- and the public v1
    API's image_url upload option) into S3 as a real ListingImage, then
    hands it to process_listing_image exactly like a normal upload would.

    Best-effort: a bad/unreachable URL just means that one photo doesn't get
    attached rather than failing the whole import (the listing itself was
    already created and saved before this task was ever queued).
    """
    from .models import Listing

    try:
        listing = Listing.objects.select_related("seller").get(id=listing_id)
    except Listing.DoesNotExist:
        return

    try:
        resp = requests.get(url, timeout=15, stream=True)
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
        if not content_type.startswith("image/"):
            logger.warning("Skipping non-image URL for listing %s: %s", listing_id, url)
            return

        body = resp.content
        if len(body) > MAX_IMPORTED_IMAGE_BYTES:
            logger.warning("Skipping oversized image for listing %s: %s", listing_id, url)
            return
    except requests.RequestException:
        logger.warning("Failed to fetch image for listing %s: %s", listing_id, url)
        return

    image = store_original_image(listing, body, content_type, order=order)

    # Called directly rather than .delay() -- this task is already running on
    # a worker, so there's no reason to round-trip through the broker again.
    process_listing_image(image.id)


def delete_s3_keys(keys):
    # Used for hard-deleting a listing's images (abandoned drafts -- see
    # Listing.hard_delete_with_s3_images -- and the delete_stale_drafts
    # command), where the DB rows are actually removed rather than
    # soft-deleted, so the S3 objects need cleaning up too or they'd sit
    # there forever with nothing left pointing at them.
    keys = [k for k in keys if k]
    if not keys:
        return

    # S3 DeleteObjects caps out at 1000 keys per call.
    for i in range(0, len(keys), 1000):
        batch = keys[i:i + 1000]
        s3.delete_objects(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Delete={"Objects": [{"Key": k} for k in batch]},
        )