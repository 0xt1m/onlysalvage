import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from inventory.models import Listing, Make, VehicleModel

User = get_user_model()

VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"  # excludes I, O, Q per VIN spec


def random_vin():
  return "".join(random.choices(VIN_CHARS, k=17))


# (make, model, trim, year, vehicle_type, transmission, fuel_type, drive,
#  price, mileage, exterior_color, interior_color, status)
SAMPLE_LISTINGS = [
  ("Toyota", "Camry", "XLE", 2022, "SDN", "ATM", "GAS", "FWD", 23900, 18000, "SIL", "BLK", "AV"),
  ("Honda", "CR-V", "EX-L", 2021, "SUV", "ATM", "GAS", "EAWD", 27500, 25000, "BLU", "GRY", "AV"),
  ("Ford", "F-150", "XLT", 2023, "TK", "ATM", "GAS", "4WD", 41200, 9000, "WHT", "BLK", "AV"),
  ("Tesla", "Model 3", "Long Range", 2022, "SDN", "ATM", "ELC", "EAWD", 32900, 21000, "RED", "BLK", "AV"),
  ("Jeep", "Wrangler", "Sport", 2020, "SUV", "MAN", "GAS", "4WD", 28750, 42000, "GRN", "BLK", "PE"),
  ("BMW", "5 Series", "530i", 2021, "SDN", "ATM", "GAS", "RWD", 36400, 30000, "BLK", "TAN", "AV"),
  ("Subaru", "Outback", "Premium", 2021, "SDN", "ATM", "GAS", "EAWD", 26300, 33000, "GRY", "BLK", "AV"),
  ("Volkswagen", "Golf GTI", "SE", 2020, "SDN", "MAN", "GAS", "FWD", 23100, 28000, "BLK", "BLK", "AV"),
  ("Audi", "A3", "Premium", 2020, "SDN", "ATM", "GAS", "EAWD", 25600, 24000, "SIL", "BLK", "AV"),
  ("Toyota", "Sienna", "XLE", 2021, "VAN", "ATM", "HYB", "FWD", 29800, 35000, "WHT", "GRY", "AV"),
]


class Command(BaseCommand):
  help = "Creates a handful of random sample listings, split across existing sellers. Safe to re-run."

  def handle(self, *args, **options):
    sellers = list(User.objects.all())
    if not sellers:
      raise CommandError("No users exist yet -- create a seller account first.")

    created = 0

    for i, (make_name, model_name, trim, year, vtype, trans, fuel, drive, price, mileage, ext, interior, status) in enumerate(SAMPLE_LISTINGS):
      try:
        make = Make.objects.get(name=make_name)
        model = VehicleModel.objects.get(make=make, name=model_name)
      except (Make.DoesNotExist, VehicleModel.DoesNotExist):
        self.stdout.write(self.style.WARNING(f"Skipping {make_name} {model_name} -- not seeded yet."))
        continue

      seller = sellers[i % len(sellers)]

      listing = Listing(
        seller=seller,
        vin=random_vin(),
        vehicle_type=vtype,
        year=year,
        make=make,
        model=model,
        trim=trim,
        mileage=mileage,
        fuel_type=fuel,
        drive=drive,
        transmission=trans,
        price=price,
        retail_price=int(price * 1.08),
        exterior_color=ext,
        interior_color=interior,
        owners=random.randint(1, 3),
        status=status,
      )
      listing.save()
      created += 1

    self.stdout.write(self.style.SUCCESS(f"Done. Created {created} listing(s)."))
