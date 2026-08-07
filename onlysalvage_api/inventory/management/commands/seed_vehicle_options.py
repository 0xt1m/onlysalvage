from django.core.management.base import BaseCommand
from inventory.models import VehicleOption

# Common trim/feature options buyers filter by. Safe to re-run: existing
# options are left untouched (get_or_create).
VEHICLE_OPTIONS = [
  "Heated Front Seats",
  "Heated Rear Seats",
  "Ventilated/Cooled Seats",
  "Heated Steering Wheel",
  "Leather Seats",
  "Third Row Seating",
  "Moonroof/Sunroof",
  "Panoramic Roof",
  "Navigation System",
  "Backup Camera",
  "Blind Spot Monitoring",
  "Adaptive Cruise Control",
  "Lane Keep Assist",
  "Apple CarPlay",
  "Android Auto",
  "Premium Sound System",
  "Remote Start",
  "Keyless Entry",
  "Power Liftgate",
  "Tow Package",
  "Alloy Wheels",
  "Heads-Up Display",
  "Parking Sensors",
  "Sunroof Shade",
]


class Command(BaseCommand):
  help = "Seeds common vehicle trim/feature options. Safe to re-run."

  def handle(self, *args, **options):
    created_count = 0

    for label in VEHICLE_OPTIONS:
      _, created = VehicleOption.objects.get_or_create(label=label)
      created_count += created

    self.stdout.write(self.style.SUCCESS(
      f"Done. {created_count} option(s) created, {len(VEHICLE_OPTIONS) - created_count} already existed."
    ))
