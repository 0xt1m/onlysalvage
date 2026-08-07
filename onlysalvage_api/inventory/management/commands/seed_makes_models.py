from django.core.management.base import BaseCommand
from inventory.models import Make, VehicleModel

# The most popular makes in the US market, each with their most popular models.
# Safe to re-run: existing makes/models are left untouched (get_or_create).
POPULAR_MAKES_AND_MODELS = {
  "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Prius", "Sienna", "Avalon", "Venza", "Sequoia", "Corolla Cross", "GR86", "Supra", "Land Cruiser", "Yaris", "Matrix", "C-HR", "Prius Prime", "Camry Hybrid", "Crown"],
  "Honda": ["Civic", "Accord", "CR-V", "Pilot", "Odyssey", "HR-V", "Ridgeline", "Passport", "Insight", "Fit", "Element", "S2000", "Civic Type R", "CR-Z", "Prelude"],
  "Ford": ["F-150", "Escape", "Explorer", "Mustang", "Edge", "Bronco", "Ranger", "Expedition", "F-250", "Focus", "Fusion", "Bronco Sport", "Maverick", "EcoSport", "F-350", "Taurus", "Flex", "Transit", "Transit Connect", "Mustang Mach-E", "GT"],
  "Chevrolet": ["Silverado 1500", "Equinox", "Traverse", "Malibu", "Tahoe", "Camaro", "Suburban", "Colorado", "Blazer", "Trax", "Trailblazer", "Corvette", "Impala", "Spark", "Silverado 2500HD", "Cruze", "Sonic", "Bolt EV", "Bolt EUV", "Express"],
  "Nissan": ["Altima", "Rogue", "Sentra", "Pathfinder", "Frontier", "Murano", "Maxima", "Kicks", "Armada", "Versa", "Titan", "370Z", "GT-R", "Z", "Ariya", "Juke", "Xterra", "Cube"],
  "BMW": ["3 Series", "5 Series", "X3", "X5", "7 Series", "X1", "X7", "4 Series", "2 Series", "M3", "Z4", "6 Series", "8 Series", "X2", "X4", "X6", "M2", "M4", "M5", "i4", "i7", "iX"],
  "Audi": ["A4", "A6", "Q5", "Q7", "A3", "Q3", "Q8", "A5", "A8", "e-tron", "TT", "S4", "S5", "RS5", "Q4 e-tron", "A7", "SQ5", "Allroad"],
  "Volkswagen": ["Golf GTI", "Jetta", "Tiguan", "Atlas", "Passat", "Taos", "ID.4", "Golf", "Arteon", "Beetle", "CC", "Atlas Cross Sport", "GTI", "Golf R"],
  "Mazda": ["CX-5", "CX-9", "Mazda3", "Mazda6", "CX-30", "MX-5 Miata", "CX-50", "CX-90", "CX-3", "RX-8", "Mazda2", "Tribute"],
  "Subaru": ["Outback", "Forester", "Crosstrek", "Ascent", "Impreza", "WRX", "BRZ", "Legacy", "Solterra", "STI", "Baja", "Tribeca"],
  "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue", "Ioniq 5", "Accent", "Santa Cruz", "Veloster", "Ioniq 6", "Genesis Coupe", "Azera"],
  "Kia": ["Forte", "K5", "Sportage", "Sorento", "Telluride", "Soul", "Seltos", "Rio", "Niro", "EV6", "Stinger", "Carnival", "Optima", "Sedona"],
  "Jeep": ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Gladiator", "Renegade", "Grand Wagoneer", "Wagoneer", "Patriot", "Liberty", "Wrangler Unlimited"],
  "GMC": ["Sierra 1500", "Terrain", "Acadia", "Yukon", "Canyon", "Yukon XL", "Sierra 2500HD", "Savana", "Envoy", "Sierra 3500HD"],
  "Ram": ["1500", "2500", "3500", "ProMaster", "ProMaster City", "1500 Classic", "Dakota"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Lexus": ["RX", "ES", "NX", "GX", "IS", "GS", "LX", "UX", "LS", "RC", "LC", "IS 350", "RX Hybrid"],
  "Dodge": ["Charger", "Challenger", "Durango", "Journey", "Grand Caravan", "Hornet", "Dart", "Avenger", "Viper", "Magnum", "Nitro"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "S-Class", "GLA", "GLB", "A-Class", "CLA", "G-Class", "GLS", "GLK", "ML-Class", "Sprinter", "CLS", "SL", "AMG GT"],
  "Acura": ["MDX", "RDX", "TLX", "Integra", "ILX", "TSX", "TL", "RSX", "RLX", "NSX", "ZDX"],
  "Infiniti": ["Q50", "QX60", "QX80", "QX50", "Q60", "QX55", "G37", "FX35", "QX30", "M37"],
  "Cadillac": ["Escalade", "XT5", "CT5", "XT4", "XT6", "CT4", "CTS", "ATS", "SRX", "XTS", "Escalade ESV"],
  "Buick": ["Enclave", "Encore", "Encore GX", "Envision", "LaCrosse", "Regal", "Verano", "Lucerne"],
  "Chrysler": ["Pacifica", "300", "Voyager", "200", "Town & Country", "Sebring", "PT Cruiser"],
  "Mitsubishi": ["Outlander", "Eclipse Cross", "Outlander Sport", "Mirage", "Lancer", "Galant", "Endeavor", "Outlander PHEV"],
  "Mini": ["Cooper", "Countryman", "Clubman", "Hardtop", "Convertible", "Paceman"],
  "Volvo": ["XC90", "XC60", "XC40", "S60", "S90", "V60", "V90", "XC70", "S80", "C40 Recharge"],
  "Land Rover": ["Range Rover", "Range Rover Sport", "Discovery", "Defender", "Range Rover Evoque", "Discovery Sport", "Range Rover Velar"],
  "Porsche": ["911", "Cayenne", "Macan", "Panamera", "Taycan", "718 Boxster", "718 Cayman", "Cayman"],
  "Genesis": ["G70", "G80", "G90", "GV70", "GV80", "GV60"],
  "Lincoln": ["Navigator", "Aviator", "Corsair", "Nautilus", "MKZ", "MKC", "MKX", "Continental", "Town Car"],
  "Jaguar": ["F-Pace", "XF", "XE", "E-Pace", "F-Type", "XJ", "I-Pace", "S-Type"],
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale", "4C"],
  "Fiat": ["500", "500X", "500L", "500e"],
  "Suzuki": ["Grand Vitara", "SX4", "Kizashi", "XL7", "Aerio", "Forenza"],
  "Isuzu": ["Rodeo", "Trooper", "Ascender", "Axiom"],
  "Saturn": ["Vue", "Ion", "Aura", "Outlook", "Sky", "L-Series"],
  "Pontiac": ["Grand Prix", "G6", "Vibe", "Torrent", "Firebird", "GTO", "Solstice", "Sunfire"],
  "Saab": ["9-3", "9-5", "9-2X", "9-4X"],
  "Mercury": ["Milan", "Mariner", "Grand Marquis", "Sable", "Mountaineer", "Cougar"],
  "Scion": ["tC", "xB", "FR-S", "xD", "iQ"],
  "Smart": ["Fortwo", "Forfour"],
  "Rivian": ["R1T", "R1S"],
  "Lucid": ["Air", "Gravity"],
  "Polestar": ["Polestar 2", "Polestar 3", "Polestar 4"],
  "Maserati": ["Ghibli", "Levante", "Quattroporte", "GranTurismo"],
  "Bentley": ["Continental GT", "Bentayga", "Flying Spur", "Mulsanne"],
  "Rolls-Royce": ["Ghost", "Wraith", "Cullinan", "Phantom", "Dawn"],
  "Ferrari": ["488", "Roma", "Portofino", "F8 Tributo", "812 Superfast", "296 GTB"],
  "Lamborghini": ["Huracan", "Urus", "Aventador", "Revuelto"],
  "Aston Martin": ["Vantage", "DB11", "DBX", "DBS"],
}


class Command(BaseCommand):
  help = "Seeds the most popular vehicle makes and models. Safe to re-run."

  def handle(self, *args, **options):
    makes_created = 0
    models_created = 0

    for make_name, model_names in POPULAR_MAKES_AND_MODELS.items():
      make, created = Make.objects.get_or_create(name=make_name)
      makes_created += created

      for model_name in model_names:
        _, created = VehicleModel.objects.get_or_create(make=make, name=model_name)
        models_created += created

    self.stdout.write(self.style.SUCCESS(
      f"Done. Created {makes_created} new make(s) and {models_created} new model(s)."
    ))
