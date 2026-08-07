from django.db import migrations

# (label, icon) per category -- labels for options that already existed get
# matched by label and updated in place (keeps their id, and any listing
# already pointing at them); everything else is a new option.
OPTIONS_BY_CATEGORY = {
    "CMF": [
        ("Heated Front Seats", "Thermometer"),
        ("Heated Rear Seats", "Thermometer"),
        ("Ventilated/Cooled Seats", "Snowflake"),
        ("Heated Steering Wheel", "Thermometer"),
        ("Leather Seats", "Armchair"),
        ("Third Row Seating", "Users"),
        ("Power Seats", "Zap"),
        ("Memory Seats", "Settings2"),
        ("Massage Seats", "Waves"),
        ("Dual-Zone Climate Control", "Fan"),
        ("Rear Climate Control", "Fan"),
        ("Ambient Lighting", "Lightbulb"),
    ],
    "TEC": [
        ("Navigation System", "Navigation"),
        ("Apple CarPlay", "Smartphone"),
        ("Android Auto", "Smartphone"),
        ("Premium Sound System", "Music"),
        ("Heads-Up Display", "MonitorSmartphone"),
        ("Bluetooth", "Bluetooth"),
        ("Wireless Charging Pad", "BatteryCharging"),
        ("USB Ports", "Usb"),
        ("Digital Instrument Cluster", "CircleGauge"),
        ("Satellite Radio", "Radio"),
        ("Wi-Fi Hotspot", "Wifi"),
    ],
    "SAF": [
        ("Backup Camera", "Camera"),
        ("Blind Spot Monitoring", "Eye"),
        ("Adaptive Cruise Control", "Gauge"),
        ("Lane Keep Assist", "Route"),
        ("Parking Sensors", "ParkingCircle"),
        ("360-Degree Camera", "ScanEye"),
        ("Forward Collision Warning", "TriangleAlert"),
        ("Automatic Emergency Braking", "ShieldCheck"),
        ("Rear Cross Traffic Alert", "Radar"),
        ("Night Vision", "Eye"),
        ("Driver Attention Monitor", "ScanEye"),
    ],
    "EXT": [
        ("Moonroof/Sunroof", "Sun"),
        ("Panoramic Roof", "Sunrise"),
        ("Sunroof Shade", "Umbrella"),
        ("Remote Start", "Zap"),
        ("Keyless Entry", "KeyRound"),
        ("Power Liftgate", "DoorOpen"),
        ("Alloy Wheels", "CircleDot"),
        ("Push-Button Start", "Zap"),
        ("Auto-Dimming Mirrors", "Sparkles"),
        ("Rain-Sensing Wipers", "CloudRain"),
        ("Adaptive Headlights", "Lightbulb"),
        ("Tinted Windows", "LayoutPanelTop"),
        ("Roof Rack", "PackageOpen"),
    ],
    "PRF": [
        ("Tow Package", "Link"),
        ("Trailer Hitch", "Anchor"),
        ("Sport Suspension", "TrendingUp"),
        ("Limited-Slip Differential", "Cog"),
        ("Performance Exhaust", "Flame"),
        ("All-Terrain Tires", "CircleDot"),
    ],
}


def seed_options(apps, schema_editor):
    VehicleOption = apps.get_model("inventory", "VehicleOption")
    existing = {o.label: o for o in VehicleOption.objects.all()}

    for category, options in OPTIONS_BY_CATEGORY.items():
        for label, icon in options:
            if label in existing:
                obj = existing[label]
                obj.category = category
                obj.icon = icon
                obj.save(update_fields=["category", "icon"])
            else:
                VehicleOption.objects.create(label=label, icon=icon, category=category)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0024_alter_vehicleoption_options_vehicleoption_category"),
    ]

    operations = [
        migrations.RunPython(seed_options, noop),
    ]
