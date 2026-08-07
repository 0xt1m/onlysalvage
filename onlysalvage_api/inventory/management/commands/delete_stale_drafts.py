from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from inventory.models import Listing

# The frontend already deletes a draft the moment its tab/page is closed
# without publishing *and* without ever being explicitly saved (see
# SellForm's pagehide/unmount handler and Listing.draft_saved) -- this is
# just the backstop for whenever that never fires at all: a crashed
# browser, a killed process, a network blip on the DELETE call, etc.
# There's no scheduler wired up in this project yet (no Celery beat, no
# cron), so this needs to actually be run periodically by whatever's
# deploying the app -- it's a plain management command, not self-scheduling.
#
# A draft the seller explicitly saved (draft_saved=True -- see the profile
# page's Drafts section) is a real "finish this later" listing, not an
# abandoned one, so it's excluded here regardless of age.
DEFAULT_MAX_AGE_HOURS = 24


class Command(BaseCommand):
  help = (
    "Hard-deletes never-saved DRAFT listings (and their S3 images) older "
    "than --max-age-hours. Run periodically."
  )

  def add_arguments(self, parser):
    parser.add_argument(
      "--max-age-hours",
      type=float,
      default=DEFAULT_MAX_AGE_HOURS,
      help=f"Delete drafts created more than this many hours ago (default {DEFAULT_MAX_AGE_HOURS}).",
    )
    parser.add_argument(
      "--dry-run",
      action="store_true",
      help="List what would be deleted without actually deleting it.",
    )

  def handle(self, *args, **options):
    cutoff = timezone.now() - timedelta(hours=options["max_age_hours"])
    stale = Listing.objects.filter(status=Listing.Status.DRAFT, draft_saved=False, created_at__lt=cutoff)

    count = stale.count()
    if count == 0:
      self.stdout.write("No stale drafts to delete.")
      return

    if options["dry_run"]:
      for listing in stale:
        self.stdout.write(f"Would delete: {listing.vin} (id={listing.id}, created {listing.created_at})")
      self.stdout.write(self.style.WARNING(f"Dry run -- {count} stale draft(s) would be deleted."))
      return

    for listing in stale:
      listing.hard_delete_with_s3_images()

    self.stdout.write(self.style.SUCCESS(f"Deleted {count} stale draft(s)."))
