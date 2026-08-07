import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { createElement, type ElementType } from 'react'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Matches the ExteriorColor/InteriorColor codes in lib/types.ts's COLORS.
const COLOR_HEX: Record<string, string> = {
  BLK: '#1a1a1a',
  WHT: '#f5f5f5',
  SIL: '#c0c0c0',
  GRY: '#808080',
  RED: '#dc2626',
  BLU: '#2563eb',
  BRW: '#78350f',
  TAN: '#d2b48c',
  GRN: '#16a34a',
  ORG: '#f97316',
  YEL: '#eab308',
  GLD: '#d4af37',
  MAR: '#7f1d1d',
  PUR: '#7c3aed',
}

// Builds a small swatch component on the fly so it can drop into InfoItem's
// `icon` slot (a component receiving `className`) like any other icon --
// plain .ts file, so this uses createElement rather than JSX.
export function colorSwatchIcon(code?: string | null): ElementType | undefined {
  const hex = code ? COLOR_HEX[code] : undefined
  if (!hex) return undefined

  return function ColorSwatch({ className }: { className?: string }) {
    return createElement('span', {
      className: cn('inline-block rounded-full border border-border', className),
      style: { backgroundColor: hex },
    })
  }
}

// Make/VehicleModel have no slug field in the database -- only id + name --
// so make/model category page URLs are built from this on the way in, and
// matched back against `slugify(row.name)` on the way out (see
// app/[locale]/makes/**), rather than trusting a guessed reverse transform.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A business_name is only meaningful for dealers -- a private seller who
// once had one set (e.g. unchecked "selling as a dealer" later) shouldn't
// have it surface as their display name.
export function sellerDisplayName(seller: {
  username: string;
  business_name?: string | null;
  is_dealer: boolean;
}): string {
  return (seller.is_dealer && seller.business_name) || seller.username;
}

// US-only, so the country code is fixed rather than user-entered. Strips
// whatever punctuation/spacing is already present (typed or stored) and
// rebuilds "+1 (XXX) XXX-XXXX" from the digits alone -- this doubles as the
// as-you-type formatter (called on every keystroke) and the display
// formatter (for numbers stored before this formatting existed).
export function phoneDigitsOnly(raw: string): string {
  // Strip a literal leading "+1" first -- the formatter re-parses its own
  // previous "+1 (555) ..." output on every keystroke (it's a controlled
  // input), so without this the "1" in "+1" gets counted as if it were a
  // digit the user typed, corrupting the number.
  const working = raw.startsWith('+1') ? raw.slice(2) : raw;
  let digits = working.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function formatPhoneDigits(digits: string): string {
  if (!digits) return '';
  let out = '+1 (' + digits.slice(0, 3);
  if (digits.length >= 3) out += ') ';
  if (digits.length > 3) out += digits.slice(3, 6);
  if (digits.length >= 6) out += '-';
  if (digits.length > 6) out += digits.slice(6, 10);
  return out;
}

export function formatPhoneNumber(raw?: string | null): string {
  return formatPhoneDigits(phoneDigitsOnly(raw ?? ''));
}

// Phone is an optional field everywhere it appears, so callers should only
// treat this as an error when the user has actually entered something --
// an untouched/empty field is not "invalid", just absent.
export function isPhoneNumberComplete(raw?: string | null): boolean {
  return phoneDigitsOnly(raw ?? '').length === 10;
}

export function phoneTelHref(raw?: string | null): string {
  const digits = phoneDigitsOnly(raw ?? '');
  return digits ? `tel:+1${digits}` : '';
}

const MILES_UNIT: Record<string, string> = { en: "miles", uk: "миль", ru: "миль", es: "millas", ro: "mile" };
const MILES_AWAY: Record<string, string> = { en: "miles away", uk: "миль від вас", ru: "миль от вас", es: "millas de distancia", ro: "mile distanță" };
const POSTED_PREFIX: Record<string, string> = { en: "Posted", uk: "Розміщено", ru: "Размещено", es: "Publicado", ro: "Publicat" };
const POSTED_JUST_NOW: Record<string, string> = { en: "Posted just now", uk: "Щойно розміщено", ru: "Только что размещено", es: "Publicado justo ahora", ro: "Publicat chiar acum" };

export function formatMileage(mileage: number, locale: string = "en") {
  const unit = MILES_UNIT[locale] ?? MILES_UNIT.en;
  return `${new Intl.NumberFormat(locale).format(mileage)} ${unit}`;
}

// Assumes ~10k miles/year of "expected" driving; a car at or under 70% of
// that for its age counts as low mileage. Age is floored at 1 year so a
// brand-new model-year listing doesn't get a 0-mile expectation (which would
// make almost any real mileage read as "not low").
const EXPECTED_MILES_PER_YEAR = 10000;
const LOW_MILEAGE_RATIO = 0.8;

export function isLowMileage(year: number, mileage?: number | null): boolean {
  if (mileage == null) return false;
  const age = Math.max(new Date().getFullYear() - year, 1);
  return mileage <= age * EXPECTED_MILES_PER_YEAR * LOW_MILEAGE_RATIO;
}

export function labelFor(
  options: { value: string; label: string }[],
  value?: string | null,
  translate?: (code: string) => string
) {
  const opt = options.find(o => o.value === value);
  if (opt && translate) {
    return translate(opt.value);
  }
  return opt?.label ?? value ?? '';
}

// Returns a copy of an options array with each label translated (by its
// stable `value` code), for passing straight into a <Select> -- the code
// itself is untouched since it's what actually gets submitted/stored.
export function translateOptions<T extends { value: string; label: string }>(
  options: T[],
  translate: (code: string) => string
): T[] {
  return options.map(o => ({ ...o, label: translate(o.value) }));
}

// Resized image variants (large/medium/thumb) are generated asynchronously;
// until that finishes the backend returns a URL ending in "/None". Fall back
// to the always-available original upload in that case.
export function safeImageUrl(url: string, fallback: string) {
  return url.endsWith('/None') ? fallback : url;
}

export function formatAddress(input: {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}): string {
  const cityStateZip = [input.city, [input.state, input.zip_code].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  return [input.street_address, cityStateZip].filter(Boolean).join(', ');
}

// The "search/?api=1&query=" form works for a full street address as well
// as a bare "City, State" -- no API key needed (unlike the Maps Embed/JS
// APIs), so this covers both a dealer's full address and a private
// seller's city-only display with the same link.
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Users commonly type "example.com" without a scheme; browsers and our
// URLField backend both require one, so add https:// if it's missing.
export function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function formatDistance(distance: number, locale: string = "en") {
  const suffix = MILES_AWAY[locale] ?? MILES_AWAY.en;
  return `${new Intl.NumberFormat(locale).format(distance)} ${suffix}`;
}

// Intl.RelativeTimeFormat handles pluralization per-locale on its own (crucial
// for Slavic locales, whose plural rules have more forms than English's two),
// so there's no manual `!== 1 ? "s" : ""` branching to translate by hand here.
// withPrefix defaults to true (the bare-text corner-of-a-card use, where
// there's no separate "Posted" label sitting next to it) -- pass false
// wherever the caller already renders its own "Posted" label (e.g. an
// InfoItem), so the two don't double up.
export function formatTimeAgo(date: string | Date, locale: string = "en", options: { withPrefix?: boolean } = {}) {
  const { withPrefix = true } = options;
  const now = new Date();
  const posted = new Date(date);

  const seconds = Math.floor((now.getTime() - posted.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(seconds / 86400);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const postedPrefix = POSTED_PREFIX[locale] ?? POSTED_PREFIX.en;

  if (seconds < 60) return withPrefix ? (POSTED_JUST_NOW[locale] ?? POSTED_JUST_NOW.en) : rtf.format(0, "second");
  if (minutes < 60) return withPrefix ? `${postedPrefix} ${rtf.format(-minutes, "minute")}` : rtf.format(-minutes, "minute");
  if (hours < 24) return withPrefix ? `${postedPrefix} ${rtf.format(-hours, "hour")}` : rtf.format(-hours, "hour");
  if (days < 7) return withPrefix ? `${postedPrefix} ${rtf.format(-days, "day")}` : rtf.format(-days, "day");

  return posted.toLocaleDateString(locale);
}

// Whole days remaining until a future timestamp (e.g. Listing.renewal_available_at),
// rounded up so "less than a day left" still reads as 1 rather than 0.
export function daysUntil(date: string | Date) {
  const diffMs = new Date(date).getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / 86400000));
}

export function formatMonthYear(date: string | Date, locale: string = "en") {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(date));
}

// Mirrors i18n/routing.ts's localePrefix: 'as-needed' -- the default locale
// (English) keeps unprefixed URLs, every other locale gets a /xx prefix.
// Needed anywhere a URL is built outside of next-intl's own <Link>, e.g.
// window.open() or navigator.clipboard, which don't resolve locale prefixes
// on their own.
export function localizedPath(locale: string, path: string, defaultLocale: string = "en") {
  return locale === defaultLocale ? path : `/${locale}${path}`;
}
