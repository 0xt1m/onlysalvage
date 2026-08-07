from django.core.management.base import BaseCommand
from inventory.models import Make, VehicleModel

# The makes/models seen in the US market -- mainstream current makes get the
# deepest lists since that's most of what's on the road, but this also
# covers the discontinued-but-still-everywhere-on-used-car-lots makes
# (Pontiac, Saturn, Oldsmobile, Plymouth, Mercury, Geo, Eagle, Hummer,
# Datsun) since a salvage/rebuilt-title marketplace skews toward older
# vehicles far more than a new-car site would.
# Safe to re-run: existing makes/models are left untouched (get_or_create).
POPULAR_MAKES_AND_MODELS = {
  "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Prius", "Sienna", "Avalon", "Venza", "Sequoia", "Corolla Cross", "GR86", "Supra", "Land Cruiser", "Yaris", "Matrix", "C-HR", "Prius Prime", "Camry Hybrid", "Crown", "Celica", "MR2", "Previa", "Tercel", "Echo", "Paseo", "T100", "Solara", "FJ Cruiser", "Camry Solara"],
  "Honda": ["Civic", "Accord", "CR-V", "Pilot", "Odyssey", "HR-V", "Ridgeline", "Passport", "Insight", "Fit", "Element", "S2000", "Civic Type R", "CR-Z", "Prelude", "Del Sol", "Crosstour", "Civic Si", "Accord Hybrid", "CR-V Hybrid"],
  "Ford": ["F-150", "Escape", "Explorer", "Mustang", "Edge", "Bronco", "Ranger", "Expedition", "F-250", "Focus", "Fusion", "Bronco Sport", "Maverick", "EcoSport", "F-350", "Taurus", "Flex", "Transit", "Transit Connect", "Mustang Mach-E", "GT", "Escort", "Crown Victoria", "Fiesta", "Excursion", "F-150 Lightning", "Thunderbird", "Contour", "Aerostar", "Windstar", "Freestyle", "Five Hundred", "Probe", "Bronco II", "Ranchero"],
  "Chevrolet": ["Silverado 1500", "Equinox", "Traverse", "Malibu", "Tahoe", "Camaro", "Suburban", "Colorado", "Blazer", "Trax", "Trailblazer", "Corvette", "Impala", "Spark", "Silverado 2500HD", "Cruze", "Sonic", "Bolt EV", "Bolt EUV", "Express", "Volt", "Cobalt", "HHR", "Aveo", "Astro", "S-10", "Monte Carlo", "Uplander", "Venture", "Silverado 3500HD", "Avalanche", "SSR"],
  "Nissan": ["Altima", "Rogue", "Sentra", "Pathfinder", "Frontier", "Murano", "Maxima", "Kicks", "Armada", "Versa", "Titan", "370Z", "GT-R", "Z", "Ariya", "Juke", "Xterra", "Cube", "Quest", "NV200", "Rogue Sport", "Rogue Select", "Titan XD", "350Z", "300ZX", "Pulsar"],
  "BMW": ["3 Series", "5 Series", "X3", "X5", "7 Series", "X1", "X7", "4 Series", "2 Series", "M3", "Z4", "6 Series", "8 Series", "X2", "X4", "X6", "M2", "M4", "M5", "i4", "i7", "iX", "1 Series", "Z3", "X5 M", "X6 M"],
  "Audi": ["A4", "A6", "Q5", "Q7", "A3", "Q3", "Q8", "A5", "A8", "e-tron", "TT", "S4", "S5", "RS5", "Q4 e-tron", "A7", "SQ5", "Allroad", "S3", "S6", "RS6", "R8"],
  "Volkswagen": ["Golf GTI", "Jetta", "Tiguan", "Atlas", "Passat", "Taos", "ID.4", "Golf", "Arteon", "Beetle", "CC", "Atlas Cross Sport", "GTI", "Golf R", "Rabbit", "Eos", "Touareg", "Routan", "New Beetle"],
  "Mazda": ["CX-5", "CX-9", "Mazda3", "Mazda6", "CX-30", "MX-5 Miata", "CX-50", "CX-90", "CX-3", "RX-8", "Mazda2", "Tribute", "RX-7", "Protege", "Millenia", "MPV", "5", "CX-7"],
  "Subaru": ["Outback", "Forester", "Crosstrek", "Ascent", "Impreza", "WRX", "BRZ", "Legacy", "Solterra", "STI", "Baja", "Tribeca", "Justy", "SVX"],
  "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Venue", "Ioniq 5", "Accent", "Santa Cruz", "Veloster", "Ioniq 6", "Genesis Coupe", "Azera", "Tiburon", "XG350", "Entourage"],
  "Kia": ["Forte", "K5", "Sportage", "Sorento", "Telluride", "Soul", "Seltos", "Rio", "Niro", "EV6", "Stinger", "Carnival", "Optima", "Sedona", "Spectra", "Rondo", "Amanti", "Borrego"],
  "Jeep": ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Gladiator", "Renegade", "Grand Wagoneer", "Wagoneer", "Patriot", "Liberty", "Wrangler Unlimited", "Comanche", "Grand Cherokee L"],
  "GMC": ["Sierra 1500", "Terrain", "Acadia", "Yukon", "Canyon", "Yukon XL", "Sierra 2500HD", "Savana", "Envoy", "Sierra 3500HD", "Jimmy", "Sonoma", "Safari", "Envoy XL"],
  "Ram": ["1500", "2500", "3500", "ProMaster", "ProMaster City", "1500 Classic", "Dakota", "C/V"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Lexus": ["RX", "ES", "NX", "GX", "IS", "GS", "LX", "UX", "LS", "RC", "LC", "IS 350", "RX Hybrid", "SC", "CT", "HS"],
  "Dodge": ["Charger", "Challenger", "Durango", "Journey", "Grand Caravan", "Hornet", "Dart", "Avenger", "Viper", "Magnum", "Nitro", "Neon", "Stratus", "Intrepid", "Caravan", "Shadow", "Ram Van"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE", "S-Class", "GLA", "GLB", "A-Class", "CLA", "G-Class", "GLS", "GLK", "ML-Class", "Sprinter", "CLS", "SL", "AMG GT", "SLK", "R-Class", "Metris"],
  "Acura": ["MDX", "RDX", "TLX", "Integra", "ILX", "TSX", "TL", "RSX", "RLX", "NSX", "ZDX", "CL", "Legend", "Vigor"],
  "Infiniti": ["Q50", "QX60", "QX80", "QX50", "Q60", "QX55", "G37", "FX35", "QX30", "M37", "G35", "I30", "J30", "EX35"],
  "Cadillac": ["Escalade", "XT5", "CT5", "XT4", "XT6", "CT4", "CTS", "ATS", "SRX", "XTS", "Escalade ESV", "DeVille", "Seville", "Fleetwood", "DTS", "STS"],
  "Buick": ["Enclave", "Encore", "Encore GX", "Envision", "LaCrosse", "Regal", "Verano", "Lucerne", "Century", "LeSabre", "Park Avenue", "Rainier", "Rendezvous", "Terraza"],
  "Chrysler": ["Pacifica", "300", "Voyager", "200", "Town & Country", "Sebring", "PT Cruiser", "Concorde", "LHS", "Crossfire", "Cirrus", "300M", "Aspen"],
  "Mitsubishi": ["Outlander", "Eclipse Cross", "Outlander Sport", "Mirage", "Lancer", "Galant", "Endeavor", "Outlander PHEV", "Eclipse", "Diamante", "Montero"],
  "Mini": ["Cooper", "Countryman", "Clubman", "Hardtop", "Convertible", "Paceman"],
  "Volvo": ["XC90", "XC60", "XC40", "S60", "S90", "V60", "V90", "XC70", "S80", "C40 Recharge", "S40", "V70", "C30", "850"],
  "Land Rover": ["Range Rover", "Range Rover Sport", "Discovery", "Defender", "Range Rover Evoque", "Discovery Sport", "Range Rover Velar", "LR3", "LR4", "Freelander"],
  "Porsche": ["911", "Cayenne", "Macan", "Panamera", "Taycan", "718 Boxster", "718 Cayman", "Cayman", "Boxster"],
  "Genesis": ["G70", "G80", "G90", "GV70", "GV80", "GV60"],
  "Lincoln": ["Navigator", "Aviator", "Corsair", "Nautilus", "MKZ", "MKC", "MKX", "Continental", "Town Car", "LS", "Zephyr", "Mark LT"],
  "Jaguar": ["F-Pace", "XF", "XE", "E-Pace", "F-Type", "XJ", "I-Pace", "S-Type", "X-Type"],
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale", "4C"],
  "Fiat": ["500", "500X", "500L", "500e"],
  "Suzuki": ["Grand Vitara", "SX4", "Kizashi", "XL7", "Aerio", "Forenza", "Esteem", "Sidekick", "Samurai", "Vitara"],
  "Isuzu": ["Rodeo", "Trooper", "Ascender", "Axiom", "Amigo", "Rodeo Sport"],
  "Saturn": ["Vue", "Ion", "Aura", "Outlook", "Sky", "L-Series", "S-Series", "Relay", "Astra"],
  "Pontiac": ["Grand Prix", "G6", "Vibe", "Torrent", "Firebird", "GTO", "Solstice", "Sunfire", "Bonneville", "Grand Am", "Aztek", "Trans Am", "Sunbird", "Montana"],
  "Saab": ["9-3", "9-5", "9-2X", "9-4X", "900"],
  "Mercury": ["Milan", "Mariner", "Grand Marquis", "Sable", "Mountaineer", "Cougar", "Villager", "Topaz", "Marauder", "Monterey"],
  "Scion": ["tC", "xB", "FR-S", "xD", "iQ", "xA"],
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
  # Discontinued makes that still show up constantly in a used/salvage market.
  "Oldsmobile": ["Cutlass", "Alero", "Achieva", "Intrigue", "Aurora", "Bravada", "Silhouette", "88", "98", "Ciera"],
  "Plymouth": ["Neon", "Voyager", "Breeze", "Grand Voyager", "Prowler", "Acclaim"],
  "Geo": ["Metro", "Prizm", "Tracker", "Storm"],
  "Eagle": ["Talon", "Vision", "Summit", "Premier"],
  "Datsun": ["240Z", "280Z", "510", "B210"],
  "Hummer": ["H1", "H2", "H3", "H3T"],
  "Daewoo": ["Lanos", "Nubira", "Leganza"],
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
