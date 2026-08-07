import {
  Thermometer, Snowflake, Armchair, Users, Zap, Settings2, Waves, Fan, Lightbulb,
  Navigation, Smartphone, Music, MonitorSmartphone, Bluetooth, BatteryCharging, Usb,
  CircleGauge, Radio, Wifi, Camera, Eye, Gauge, Route, ParkingCircle, ScanEye,
  TriangleAlert, ShieldCheck, Radar, Sun, Sunrise, Umbrella, KeyRound, DoorOpen,
  CircleDot, Sparkles, CloudRain, LayoutPanelTop, PackageOpen, Link, Anchor,
  TrendingUp, Cog, Flame, Check, type LucideIcon,
} from 'lucide-react'

// Keyed by VehicleOption.icon (a lucide-react component name) as stored on
// the backend -- see inventory/migrations/0025_seed_vehicle_options.py.
const VEHICLE_OPTION_ICONS: Record<string, LucideIcon> = {
  Thermometer, Snowflake, Armchair, Users, Zap, Settings2, Waves, Fan, Lightbulb,
  Navigation, Smartphone, Music, MonitorSmartphone, Bluetooth, BatteryCharging, Usb,
  CircleGauge, Radio, Wifi, Camera, Eye, Gauge, Route, ParkingCircle, ScanEye,
  TriangleAlert, ShieldCheck, Radar, Sun, Sunrise, Umbrella, KeyRound, DoorOpen,
  CircleDot, Sparkles, CloudRain, LayoutPanelTop, PackageOpen, Link, Anchor,
  TrendingUp, Cog, Flame,
}

export function vehicleOptionIcon(iconName: string): LucideIcon {
  return VEHICLE_OPTION_ICONS[iconName] ?? Check
}
