'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  RotateCcw, Grid2x2, LayoutGrid, List, LocateFixed, Filter, X,
  MapPin, Calendar, DollarSign, Gauge, User, Car, Tag, CarFront, Fuel, FileText, Palette, Armchair,
} from 'lucide-react';
import { IconManualGearbox, IconSteeringWheel } from '@tabler/icons-react';
import { cn, colorSwatchIcon, formatMileage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { FilterRange } from '@/components/ui/FilterRange';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SearchBlock } from '@/components/ui/SearchBlock';
import { CarLoader } from '@/components/ui/CarLoader';
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid';
import { useAuth } from '@/lib/auth-context';
import { getListings, getMakes, getModelsForMakes } from '@/lib/api';
import { VEHICLE_TYPES, FILTER_TRANSMISSIONS, FILTER_DRIVES, FUEL_TYPES, COLORS, TITLE_DOCUMENTS } from '@/lib/types';
import { getInventoryViewMode, setInventoryViewMode } from '@/lib/inventoryViewMode';
import type { Make, VehicleModel, ListingSummary } from '@/lib/types';

const labelsOf = (options: { label: string }[]) => options.map((o) => o.label);

const splitParam = (value: string | null): string[] =>
  value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

// Several filters (transmission, drive, fuel type, exterior color, title
// document) double their *English* label as the exact value the backend
// matches against (see inventory/filters.py's _codes_from_labels) -- so the
// value sent over the wire must stay the canonical English text no matter
// the UI locale. This builds a display-only translator: given the English
// label used as the item's value, look up its stable short code in the
// options list and translate that instead of the value itself.
const makeLabelFor = (
  options: { value: string; label: string }[],
  translate: (code: string) => string
) => {
  const codeByLabel = new Map(options.map((o) => [o.label, o.value]));
  return (englishLabel: string) => {
    const code = codeByLabel.get(englishLabel);
    return code ? translate(code) : englishLabel;
  };
};

const PAGE_SIZE = 30;

const YEAR_BOUNDS: [number, number] = [1946, 2027];
const PRICE_BOUNDS: [number, number] = [0, 100000];
const MILEAGE_BOUNDS: [number, number] = [0, 200000];

// `value` is exactly what the backend's OrderingFilter expects (see
// ListingViewSet.ordering_fields in inventory/api/views.py); `key` is just a
// stable translation lookup, since a leading "-" doesn't make a usable
// message key.
const DEFAULT_SORT = '-created_at';
const SORT_OPTIONS = [
  { value: '-created_at', key: 'newest' },
  { value: 'price', key: 'priceAsc' },
  { value: '-price', key: 'priceDesc' },
  { value: 'mileage', key: 'mileageAsc' },
  { value: '-year', key: 'yearDesc' },
];
// Only meaningful once a location is resolved (see ListingViewSet.get_queryset
// on the backend -- there's no `distance` to sort by otherwise), so this is
// appended to SORT_OPTIONS conditionally rather than listed there directly.
const DISTANCE_SORT_OPTION = { value: 'distance', key: 'distance' };

// Same constraint as above: these are the literal values the backend
// understands -- 'Private'/'Dealer' go to the seller_type filter,
// 'Financing'/'Verified' each become their own boolean param
// (offers_financing/verified_seller) instead -- so they can't be
// translated directly, only their displayed label can, via labelFor below.
const SELLER_TYPE_ITEMS = ['Private', 'Dealer', 'Financing', 'Verified'];

export function InventoryBrowser() {
  const searchParams = useSearchParams();
  const t = useTranslations('Inventory');
  const tAttr = useTranslations('VehicleAttributes');
  const locale = useLocale();
  const { user } = useAuth();

  // Slider drag tooltips for the range filters below -- year stays a plain
  // number (toLocaleString would insert a comma, e.g. "2,024", which reads
  // wrong for a year), price gets currency formatting, mileage reuses the
  // same locale-aware "X miles"/"X миль" formatter used everywhere else.
  const yearValueFor = (v: number) => String(v);
  const priceValueFor = (v: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  const mileageValueFor = (v: number) => formatMileage(v, locale);

  const vehicleTypeLabelFor = makeLabelFor(VEHICLE_TYPES, (code) => tAttr(`vehicleType.${code}`));
  const transmissionLabelFor = makeLabelFor(FILTER_TRANSMISSIONS, (code) => tAttr(`transmission.${code}`));
  const driveLabelFor = makeLabelFor(FILTER_DRIVES, (code) => tAttr(`drive.${code}`));
  const fuelTypeLabelFor = makeLabelFor(FUEL_TYPES, (code) => tAttr(`fuelType.${code}`));
  const colorLabelFor = makeLabelFor(COLORS, (code) => tAttr(`color.${code}`));
  const titleDocumentLabelFor = makeLabelFor(TITLE_DOCUMENTS, (code) => tAttr(`titleDocument.${code}`));
  const sellerTypeLabelFor = (item: string) => tAttr(`sellerType.${item}`);

  // Exterior/interior color share the same code set, so one label->code
  // lookup (built once, not per-render) covers the swatch for both dropdowns.
  const colorCodeByLabel = new Map(COLORS.map((c) => [c.label, c.value]));
  const colorIconFor = (item: string) => colorSwatchIcon(colorCodeByLabel.get(item));

  const DISTANCE_OPTIONS = [
    { value: '25', label: t('within', { miles: 25 }) },
    { value: '50', label: t('within', { miles: 50 }) },
    { value: '100', label: t('within', { miles: 100 }) },
    { value: '250', label: t('within', { miles: 250 }) },
  ];

  const [makes, setMakes] = useState<Make[]>([]);

  // Every filter below is parsed from the URL, both for the initial render
  // (so a shared/bookmarked search URL takes effect) and re-applied whenever
  // searchParams changes later (see the effect below) -- the search block's
  // quick-filter chips ("Under $5,000", "Nearby", etc.) are plain links, so
  // clicking one while already on this page only changes the URL; without
  // that effect nothing here re-reads it and the results never update.
  const parseFiltersFromParams = (params: URLSearchParams) => ({
    selectedMakes: splitParam(params.get('make')),
    selectedModels: splitParam(params.get('model')),
    year: [
      Number(params.get('min_year')) || YEAR_BOUNDS[0],
      Number(params.get('max_year')) || YEAR_BOUNDS[1],
    ] as [number, number],
    price: [
      Number(params.get('min_price')) || PRICE_BOUNDS[0],
      Number(params.get('max_price')) || PRICE_BOUNDS[1],
    ] as [number, number],
    mileage: [
      Number(params.get('min_mileage')) || MILEAGE_BOUNDS[0],
      Number(params.get('max_mileage')) || MILEAGE_BOUNDS[1],
    ] as [number, number],
    selectedVehicleTypes: splitParam(params.get('vehicle_type')),
    selectedTransmissions: splitParam(params.get('transmission')),
    selectedDrives: splitParam(params.get('drive')),
    selectedFuelTypes: splitParam(params.get('fuel_type')),
    selectedColors: splitParam(params.get('exterior_color')),
    selectedInteriorColors: splitParam(params.get('interior_color')),
    selectedTitleDocuments: splitParam(params.get('title_document')),
    // Private/Dealer come from seller_type; Financing/Verified are their
    // own boolean params (offers_financing/verified_seller) -- all four
    // still collapse into one array so the UI can treat them as a single
    // multi-select "Seller" filter regardless of how each is actually sent.
    selectedSellerTypes: [
      ...splitParam(params.get('seller_type')).map((v) => v[0].toUpperCase() + v.slice(1).toLowerCase()),
      ...(params.get('offers_financing') === 'true' ? ['Financing'] : []),
      ...(params.get('verified_seller') === 'true' ? ['Verified'] : []),
    ],
    zipCode: params.get('zip_code') ?? '',
    maxDistance: params.get('max_distance') ?? (params.get('nearby') ? '50' : ''),
    search: params.get('search') ?? '',
    nearby: params.get('nearby') === 'true',
    recommended: params.get('recommended') === 'true',
    sort: params.get('ordering') || DEFAULT_SORT,
  });

  // Each filter widget below is "staged" separately from what's actually
  // applied to the search -- the sidebar's own Apply buttons are gone
  // (showApplyButton={false}), so a widget's onApply now fires live as the
  // user interacts with it, but only updates *pending* state. Nothing is
  // sent to the backend until the sticky "Apply Filters" button copies
  // pending into applied, so picking several filters only costs one fetch.
  const [selectedMakes, setSelectedMakes] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedMakes);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedModels);
  const [year, setYear] = useState<[number, number]>(() => parseFiltersFromParams(searchParams).year);
  const [price, setPrice] = useState<[number, number]>(() => parseFiltersFromParams(searchParams).price);
  const [mileage, setMileage] = useState<[number, number]>(() => parseFiltersFromParams(searchParams).mileage);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedVehicleTypes);
  const [selectedTransmissions, setSelectedTransmissions] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedTransmissions);
  const [selectedDrives, setSelectedDrives] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedDrives);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedFuelTypes);
  const [selectedColors, setSelectedColors] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedColors);
  const [selectedInteriorColors, setSelectedInteriorColors] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedInteriorColors);
  const [selectedTitleDocuments, setSelectedTitleDocuments] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedTitleDocuments);
  const [selectedSellerTypes, setSelectedSellerTypes] = useState<string[]>(() => parseFiltersFromParams(searchParams).selectedSellerTypes);

  const [pendingSelectedMakes, setPendingSelectedMakes] = useState(selectedMakes);
  const [pendingSelectedModels, setPendingSelectedModels] = useState(selectedModels);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [pendingYear, setPendingYear] = useState(year);
  const [pendingPrice, setPendingPrice] = useState(price);
  const [pendingMileage, setPendingMileage] = useState(mileage);
  const [pendingSelectedVehicleTypes, setPendingSelectedVehicleTypes] = useState(selectedVehicleTypes);
  const [pendingSelectedTransmissions, setPendingSelectedTransmissions] = useState(selectedTransmissions);
  const [pendingSelectedDrives, setPendingSelectedDrives] = useState(selectedDrives);
  const [pendingSelectedFuelTypes, setPendingSelectedFuelTypes] = useState(selectedFuelTypes);
  const [pendingSelectedColors, setPendingSelectedColors] = useState(selectedColors);
  const [pendingSelectedInteriorColors, setPendingSelectedInteriorColors] = useState(selectedInteriorColors);
  const [pendingSelectedTitleDocuments, setPendingSelectedTitleDocuments] = useState(selectedTitleDocuments);
  const [pendingSelectedSellerTypes, setPendingSelectedSellerTypes] = useState(selectedSellerTypes);

  // Distance: either a zip code or the browser's geolocation, plus a radius.
  // Kept separate from coords -- entering a zip clears any prior geolocation
  // fix and vice versa, since only one can drive the search at a time.
  const [zipCode, setZipCode] = useState(() => parseFiltersFromParams(searchParams).zipCode);
  const [maxDistance, setMaxDistance] = useState(() => parseFiltersFromParams(searchParams).maxDistance);
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  // Staged copies for the filters modal, same as every other pendingX above
  // -- picking a distance/radius/location shouldn't search until "Apply
  // Filters" is actually clicked. The *un*staged zipCode/maxDistance/coords
  // above stay real-and-immediate for the other two triggers that aren't
  // part of this modal at all: the "Nearby" quick-filter chip and the
  // sort-by-distance dropdown (see requestGeolocation).
  const [pendingZipCode, setPendingZipCode] = useState(zipCode);
  const [pendingMaxDistance, setPendingMaxDistance] = useState(maxDistance);
  const [pendingCoords, setPendingCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [search, setSearch] = useState(() => parseFiltersFromParams(searchParams).search);
  const [recommended, setRecommended] = useState(() => parseFiltersFromParams(searchParams).recommended);
  const [sort, setSort] = useState(() => parseFiltersFromParams(searchParams).sort);

  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewModeState] = useState<'large' | 'compact' | 'list'>('list');
  // Reads the saved mode after mount (not as the initial state) so the
  // server-rendered/first-client-render HTML always matches -- localStorage
  // isn't visible during SSR, so seeding the initial state from it would
  // mismatch whatever the server rendered and trip a hydration warning.
  useEffect(() => {
    const saved = getInventoryViewMode();
    if (saved) setViewModeState(saved);
  }, []);
  const setViewMode = (mode: 'large' | 'compact' | 'list') => {
    setViewModeState(mode);
    setInventoryViewMode(mode);
  };
  // The filter sidebar is a slide-in drawer at every screen size (not just
  // mobile) -- toggled via the "Filters" button rather than always stacked
  // above/beside the results, so results are visible immediately either way.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // FilterRange/FilterDropdown/SearchBlock all manage their own internal
  // widget state (slider position, checked items, search text) and never
  // resync it from props after mount. Bumping this and using it as a `key`
  // forces them to remount so a reset is actually visible, not just applied
  // to the underlying fetch.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    getMakes().then(setMakes);
  }, []);

  // The Model dropdown only makes sense once at least one Make is staged --
  // re-fetches the union of models across every currently-checked make
  // whenever that set changes, and prunes any staged model selection that's
  // no longer valid for the new set (e.g. its make got unchecked). Waits for
  // `makes` itself to be loaded since the lookup below needs it to turn the
  // staged make *names* into the ids the models endpoint actually filters by.
  useEffect(() => {
    if (pendingSelectedMakes.length === 0) {
      setModels([]);
      setPendingSelectedModels([]);
      setModelsLoading(false);
      return;
    }
    if (makes.length === 0) return;

    const ids = makes.filter((m) => pendingSelectedMakes.includes(m.name)).map((m) => m.id);
    if (ids.length === 0) {
      setModels([]);
      setPendingSelectedModels([]);
      setModelsLoading(false);
      return;
    }

    let cancelled = false;
    setModelsLoading(true);
    getModelsForMakes(ids).then((result) => {
      if (cancelled) return;
      setModels(result);
      setPendingSelectedModels((prev) => prev.filter((name) => result.some((m) => m.name === name)));
      setModelsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingSelectedMakes, makes]);

  useEffect(() => {
    if (!filtersOpen) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [filtersOpen]);

  // If a geolocation attempt for "Nearest" sorting fails outright, there's
  // nothing to sort by -- fall back rather than leave the sort dropdown
  // stuck on an option that silently does nothing.
  const fallBackFromDistanceSort = () => {
    setSort((current) => (current === DISTANCE_SORT_OPTION.value ? DEFAULT_SORT : current));
  };

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t('noGeolocationSupport'));
      fallBackFromDistanceSort();
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        setZipCode('');
        setMaxDistance((prev) => prev || '50');
        setGeoLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      () => {
        setGeoError(t('geolocationFailed'));
        setGeoLoading(false);
        fallBackFromDistanceSort();
      },
      { timeout: 10000 }
    );
  };

  // Same request as requestGeolocation, but stages the result into the
  // filters-modal's pending state instead of applying it immediately -- this
  // is what the modal's own "Use My Location" button calls; the plain
  // requestGeolocation above stays for the "Nearby" chip and the
  // sort-by-distance dropdown, which are both meant to search right away.
  const requestGeolocationPending = () => {
    if (!navigator.geolocation) {
      setGeoError(t('noGeolocationSupport'));
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPendingCoords({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        setPendingZipCode('');
        setPendingMaxDistance((prev) => prev || '50');
        setGeoLoading(false);
      },
      () => {
        setGeoError(t('geolocationFailed'));
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // Re-parses every URL-driven filter whenever searchParams changes -- not
  // just on mount -- so clicking one quick-filter chip after another (or
  // after already landing here from a link) actually updates the results
  // instead of only changing the address bar. Each chip's href is a fresh,
  // standalone query string (not merged with the current filters), so
  // replacing all of this state wholesale on every change matches that
  // "start a new focused search" intent, including clearing any stale
  // geolocation fix that isn't itself reflected in the URL.
  useEffect(() => {
    const parsed = parseFiltersFromParams(searchParams);
    setSelectedMakes(parsed.selectedMakes);
    setSelectedModels(parsed.selectedModels);
    setYear(parsed.year);
    setPrice(parsed.price);
    setMileage(parsed.mileage);
    setSelectedVehicleTypes(parsed.selectedVehicleTypes);
    setSelectedTransmissions(parsed.selectedTransmissions);
    setSelectedDrives(parsed.selectedDrives);
    setSelectedFuelTypes(parsed.selectedFuelTypes);
    setSelectedColors(parsed.selectedColors);
    setSelectedInteriorColors(parsed.selectedInteriorColors);
    setSelectedTitleDocuments(parsed.selectedTitleDocuments);
    setSelectedSellerTypes(parsed.selectedSellerTypes);
    setZipCode(parsed.zipCode);
    setMaxDistance(parsed.maxDistance);
    setSearch(parsed.search);
    setRecommended(parsed.recommended);
    setSort(parsed.sort);
    setCoords(null);

    // A quick-filter chip is a fresh, already-applied search, so the staged
    // (pending) side is reset right along with it -- otherwise the sidebar
    // widgets would keep showing whatever was staged before the chip was
    // clicked, out of sync with the results now on screen.
    setPendingSelectedMakes(parsed.selectedMakes);
    setPendingSelectedModels(parsed.selectedModels);
    setPendingYear(parsed.year);
    setPendingPrice(parsed.price);
    setPendingMileage(parsed.mileage);
    setPendingSelectedVehicleTypes(parsed.selectedVehicleTypes);
    setPendingSelectedTransmissions(parsed.selectedTransmissions);
    setPendingSelectedDrives(parsed.selectedDrives);
    setPendingSelectedFuelTypes(parsed.selectedFuelTypes);
    setPendingSelectedColors(parsed.selectedColors);
    setPendingSelectedInteriorColors(parsed.selectedInteriorColors);
    setPendingSelectedTitleDocuments(parsed.selectedTitleDocuments);
    setPendingSelectedSellerTypes(parsed.selectedSellerTypes);
    setPendingZipCode(parsed.zipCode);
    setPendingMaxDistance(parsed.maxDistance);
    setPendingCoords(null);
    // Widgets only read defaultSelected/defaultValue once at mount, so force
    // a remount to actually show the reset pending values, not just apply
    // them to the underlying fetch.
    setResetKey((k) => k + 1);

    // The "Nearby" chip can't request geolocation itself (it's a plain
    // link), so it just sets ?nearby=true and this effect requests it
    // whenever that param is freshly present.
    if (parsed.nearby) {
      requestGeolocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buildParams = (pageNum: number): Record<string, string> => {
    const params: Record<string, string> = {
      exclude_sold: 'true',
      page: String(pageNum),
      page_size: String(PAGE_SIZE),
    };
    // Only send range filters once the user actually narrows them -- price and
    // mileage are nullable on the backend, and a gte/lte filter never matches
    // NULL, so sending these at their full default range would silently hide
    // any listing that doesn't have a price/mileage set yet.
    if (year[0] !== YEAR_BOUNDS[0]) params.min_year = String(year[0]);
    if (year[1] !== YEAR_BOUNDS[1]) params.max_year = String(year[1]);
    if (price[0] !== PRICE_BOUNDS[0]) params.min_price = String(price[0]);
    if (price[1] !== PRICE_BOUNDS[1]) params.max_price = String(price[1]);
    if (mileage[0] !== MILEAGE_BOUNDS[0]) params.min_mileage = String(mileage[0]);
    if (mileage[1] !== MILEAGE_BOUNDS[1]) params.max_mileage = String(mileage[1]);
    if (selectedMakes.length > 0) params.make = selectedMakes.join(',');
    if (selectedModels.length > 0) params.model = selectedModels.join(',');
    if (selectedVehicleTypes.length > 0) params.vehicle_type = selectedVehicleTypes.join(',');
    if (selectedTransmissions.length > 0) params.transmission = selectedTransmissions.join(',');
    if (selectedDrives.length > 0) params.drive = selectedDrives.join(',');
    if (selectedFuelTypes.length > 0) params.fuel_type = selectedFuelTypes.join(',');
    if (selectedColors.length > 0) params.exterior_color = selectedColors.join(',');
    if (selectedInteriorColors.length > 0) params.interior_color = selectedInteriorColors.join(',');
    if (selectedTitleDocuments.length > 0) params.title_document = selectedTitleDocuments.join(',');
    // Private/Dealer go to seller_type; Financing/Verified are their own
    // boolean params on the backend (see inventory/filters.py) -- this one
    // combined array just gets split back apart on the way out.
    const sellerTypeTokens = selectedSellerTypes.filter((s) => s === 'Private' || s === 'Dealer');
    if (sellerTypeTokens.length > 0) params.seller_type = sellerTypeTokens.map((s) => s.toLowerCase()).join(',');
    if (selectedSellerTypes.includes('Financing')) params.offers_financing = 'true';
    if (selectedSellerTypes.includes('Verified')) params.verified_seller = 'true';
    if (search.trim()) params.search = search.trim();
    if (recommended) params.recommended = 'true';
    if (sort !== DEFAULT_SORT) params.ordering = sort;

    if (coords) {
      params.lat = coords.lat;
      params.lng = coords.lng;
      if (maxDistance) params.max_distance = maxDistance;
    } else if (zipCode.trim()) {
      params.zip_code = zipCode.trim();
      if (maxDistance) params.max_distance = maxDistance;
    }

    return params;
  };

  // Whenever a filter changes, start over from page 1 and replace the results.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setPage(1);
    getListings(buildParams(1)).then(({ results, count }) => {
      if (cancelled) return; // a newer fetch superseded this one
      setListings(results);
      setTotalCount(count);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    selectedMakes, selectedModels, year, price, mileage,
    selectedVehicleTypes, selectedTransmissions, selectedDrives, selectedFuelTypes, selectedColors, selectedInteriorColors,
    selectedTitleDocuments, selectedSellerTypes, zipCode, coords, maxDistance,
    search, recommended, sort,
  ]);

  // Lets a listing's detail page (see ListingNavArrows) offer "next/previous"
  // through exactly this search, in this order -- `listings` already holds
  // every page loaded so far in order (page 1 replaces it, Load More appends),
  // so this just mirrors that array out to sessionStorage every time it
  // changes. `params`/`page`/`pageSize` are enough for the detail page to
  // fetch the next not-yet-loaded page itself if someone pages past the end
  // of what's been loaded here.
  useEffect(() => {
    if (typeof window === 'undefined' || listings.length === 0) return;
    try {
      sessionStorage.setItem('inventory-nav-context', JSON.stringify({
        slugs: listings.map((l) => l.slug),
        count: totalCount,
        page,
        pageSize: PAGE_SIZE,
        params: buildParams(1),
      }));
    } catch {
      // Private browsing / storage disabled -- ListingNavArrows just won't render.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, totalCount, page]);

  const hasLocation = coords !== null || zipCode.trim().length > 0;

  // "Nearest" only makes sense once a location is active. Picking it while
  // there isn't one yet triggers a geolocation request (see the sort
  // dropdown below), which takes a moment to resolve -- so this only falls
  // back when a *previously active* location goes away (e.g. the zip code
  // gets cleared), not during that initial pending window, which would
  // otherwise immediately undo the selection before geolocation ever answers.
  const hadLocation = useRef(hasLocation);
  useEffect(() => {
    if (hadLocation.current && !hasLocation && sort === DISTANCE_SORT_OPTION.value) {
      setSort(DEFAULT_SORT);
    }
    hadLocation.current = hasLocation;
  }, [hasLocation, sort]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    const { results, count } = await getListings(buildParams(nextPage));
    setListings((prev) => [...prev, ...results]);
    setTotalCount(count);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const canLoadMore = listings.length < totalCount;

  // Copies every staged filter into the applied state that buildParams/the
  // fetch effect actually reads -- the one place all those separate widget
  // changes finally turn into a single search.
  const handleApplyFilters = () => {
    setSelectedMakes(pendingSelectedMakes);
    setSelectedModels(pendingSelectedModels);
    setYear(pendingYear);
    setPrice(pendingPrice);
    setMileage(pendingMileage);
    setSelectedVehicleTypes(pendingSelectedVehicleTypes);
    setSelectedTransmissions(pendingSelectedTransmissions);
    setSelectedDrives(pendingSelectedDrives);
    setSelectedFuelTypes(pendingSelectedFuelTypes);
    setSelectedColors(pendingSelectedColors);
    setSelectedInteriorColors(pendingSelectedInteriorColors);
    setSelectedTitleDocuments(pendingSelectedTitleDocuments);
    setSelectedSellerTypes(pendingSelectedSellerTypes);
    setZipCode(pendingZipCode);
    setMaxDistance(pendingMaxDistance);
    setCoords(pendingCoords);
    setFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasPendingChanges =
    JSON.stringify([selectedMakes, selectedModels, year, price, mileage, selectedVehicleTypes, selectedTransmissions, selectedDrives, selectedFuelTypes, selectedColors, selectedInteriorColors, selectedTitleDocuments, selectedSellerTypes, zipCode, maxDistance, coords]) !==
    JSON.stringify([pendingSelectedMakes, pendingSelectedModels, pendingYear, pendingPrice, pendingMileage, pendingSelectedVehicleTypes, pendingSelectedTransmissions, pendingSelectedDrives, pendingSelectedFuelTypes, pendingSelectedColors, pendingSelectedInteriorColors, pendingSelectedTitleDocuments, pendingSelectedSellerTypes, pendingZipCode, pendingMaxDistance, pendingCoords]);

  const handleResetFilters = () => {
    setYear(YEAR_BOUNDS);
    setPrice(PRICE_BOUNDS);
    setMileage(MILEAGE_BOUNDS);
    setSelectedMakes([]);
    setSelectedModels([]);
    setSelectedVehicleTypes([]);
    setSelectedTransmissions([]);
    setSelectedDrives([]);
    setSelectedFuelTypes([]);
    setSelectedColors([]);
    setSelectedInteriorColors([]);
    setSelectedTitleDocuments([]);
    setSelectedSellerTypes([]);
    setPendingYear(YEAR_BOUNDS);
    setPendingPrice(PRICE_BOUNDS);
    setPendingMileage(MILEAGE_BOUNDS);
    setPendingSelectedMakes([]);
    setPendingSelectedModels([]);
    setPendingSelectedVehicleTypes([]);
    setPendingSelectedTransmissions([]);
    setPendingSelectedDrives([]);
    setPendingSelectedFuelTypes([]);
    setPendingSelectedColors([]);
    setPendingSelectedInteriorColors([]);
    setPendingSelectedTitleDocuments([]);
    setPendingSelectedSellerTypes([]);
    setZipCode('');
    setMaxDistance('');
    setCoords(null);
    setPendingZipCode('');
    setPendingMaxDistance('');
    setPendingCoords(null);
    setGeoError('');
    setSearch('');
    setRecommended(false);
    setResetKey((k) => k + 1);
    setFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters =
    year[0] !== YEAR_BOUNDS[0] || year[1] !== YEAR_BOUNDS[1] ||
    price[0] !== PRICE_BOUNDS[0] || price[1] !== PRICE_BOUNDS[1] ||
    mileage[0] !== MILEAGE_BOUNDS[0] || mileage[1] !== MILEAGE_BOUNDS[1] ||
    selectedMakes.length > 0 || selectedModels.length > 0 || selectedVehicleTypes.length > 0 ||
    selectedTransmissions.length > 0 || selectedDrives.length > 0 ||
    selectedFuelTypes.length > 0 || selectedColors.length > 0 || selectedInteriorColors.length > 0 ||
    selectedTitleDocuments.length > 0 || selectedSellerTypes.length > 0 ||
    zipCode.trim().length > 0 || coords !== null ||
    search.trim().length > 0 || recommended;

  // Model's own items array, resorted so models group cleanly by make
  // (FilterDropdown's groupFor buckets by first-appearance order, so this
  // is what actually determines the on-screen group order) -- the API
  // itself only orders by model name, which would otherwise interleave
  // e.g. BMW's "3 Series" and Toyota's "4Runner" alphabetically instead of
  // keeping each make's models together.
  const makeNameById = new Map(makes.map((m) => [m.id, m.name]));
  const modelMakeName = new Map(models.map((m) => [m.name, makeNameById.get(m.make) ?? '']));
  const sortedModels = [...models].sort((a, b) => {
    const makeCompare = (modelMakeName.get(a.name) ?? '').localeCompare(modelMakeName.get(b.name) ?? '');
    return makeCompare !== 0 ? makeCompare : a.name.localeCompare(b.name);
  });
  const modelGroupFor = (modelName: string) => modelMakeName.get(modelName) ?? '';

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col mb-3'>
      <SearchBlock key={`search-${resetKey}`} title={t('browseTitle')} onSearch={setSearch} initialQuery={search} />
      {/* Always rendered (not conditionally mounted) so both this and the
          panel below can actually animate in/out via opacity/transform
          instead of just popping. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          filtersOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setFiltersOpen(false)}
      />

      {/* A slide-in drawer from the left on mobile, but a centered modal on
          desktop (`lg:`) -- opened via the "Filters" button below rather
          than sitting inline, so it never competes with the results for
          space. The scrollable filter list and the Reset/Apply footer are
          separate flex children (flex-1 vs shrink-0) so the footer is always
          pinned flush to the actual bottom of the panel, whether or not the
          filters are tall enough to scroll -- a plain `sticky` footer only
          pins once you've scrolled past it, so a short filter list would
          leave it floating right after the last filter instead. */}
      <Card
        className={cn(
          // overflow-hidden clips the header/footer bars to the panel's own
          // rounded corners -- without it, their square corners (each has
          // its own opaque background) poke out past the rounded ones.
          'fixed z-50 flex flex-col overflow-hidden transition-all duration-300 ease-out',
          // Mobile: edge-to-edge drawer sliding in from the left.
          'inset-y-0 left-0 w-[85%] max-w-sm p-0 rounded-none',
          filtersOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: centered modal instead -- the slide transform above is
          // cancelled out (lg:translate-x-0) and replaced with a fade/scale.
          // m-auto (all four margins auto) is what actually centers it, both
          // axes, once max-w/max-h clamp it smaller than this box -- top-16/
          // bottom-16 (instead of inset-0's top-0/bottom-0) is what keeps a
          // clear gap under the sticky navbar and above the bottom edge
          // rather than centering across the *entire* viewport. top-28
          // (7rem/112px), not top-16 -- the navbar itself renders taller
          // than 4rem (70px logo + py-3 padding + border ~= 95px), so
          // top-16 actually sat the modal a bit underneath/behind it.
          // max-h is a calc() tied to those same insets (100vh minus the
          // 7rem top gap and 4rem bottom gap), not a plain vh number --
          // top-28/bottom-16 already hard-cap the fixed box's available
          // height (a fixed element with top+bottom both set can never be
          // taller than that gap), so a plain max-h-[Nvh] silently does
          // nothing once N is big enough to exceed that gap. Tying it to
          // the same insets means the modal always uses exactly the full
          // available box once content is tall enough to need it.
          'lg:inset-x-0 lg:top-28 lg:bottom-16 lg:m-auto lg:translate-x-0 lg:w-full lg:max-w-[1600px] lg:h-fit lg:max-h-[calc(100vh-11rem)] lg:rounded-lg',
          filtersOpen ? 'lg:opacity-100 lg:scale-100' : 'lg:opacity-0 lg:scale-95 lg:pointer-events-none'
        )}
        inert={!filtersOpen}
      >
        <div className="flex items-center justify-between p-6 pb-3 shrink-0 border-b border-border">
          <span className="text-lg font-semibold text-foreground">{t('filters')}</span>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            aria-label={t('closeFilters')}
            className="p-1 text-muted hover:text-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explicit 4-column layout rather than an auto-flowing one --
            grouped so each column reads as its own unit: location/range
            filters, Make, Model (dependent on Make), then everything else.
            On mobile the drawer is a single stacked column, so the whole
            thing scrolling together is normal there -- but on desktop the
            modal's own size is fixed (see the Card's max-h above), so this
            row scrolling as one unit would mean one tall column (e.g. a
            long Make/Model list) drags the whole modal into scrolling.
            lg:grid-rows-[minmax(0,1fr)] instead forces this grid's single
            row to exactly the space available (not its content's natural
            height), lg:overflow-hidden stops it from scrolling as a whole,
            and each column below gets its own lg:overflow-y-auto so any
            column taller than that row scrolls internally instead. Setting
            only overflow-y (not overflow-x) makes the browser force
            overflow-x to 'auto' too (per spec, an axis can't stay 'visible'
            once the other isn't) -- lg:pr-1 gives the card's right border a
            hair of slack before that new horizontal clip edge, so it isn't
            shaved off by sub-pixel rounding. */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 overflow-y-auto flex-1 p-6 lg:overflow-hidden lg:grid-rows-[minmax(0,1fr)]">
          <div className="flex flex-col gap-3 min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <Card className="select-none p-3">
              <span className="flex items-center gap-2 text-foreground font-medium">
                <MapPin className="w-4 h-4 text-muted shrink-0" />
                {t('distance')}
              </span>
              <Input
                key={`zip-${resetKey}`}
                placeholder={t('zipCode')}
                value={pendingZipCode}
                onChange={(e) => { setPendingZipCode(e.target.value); setPendingCoords(null); }}
                className="rounded-md px-3 py-1.5 text-sm"
              />
              <Select
                value={pendingMaxDistance}
                onChange={(e) => setPendingMaxDistance(e.target.value)}
                options={DISTANCE_OPTIONS}
                placeholder={t('anyDistance')}
                className="text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                className="flex items-center justify-center gap-2 w-full"
                onClick={requestGeolocationPending}
                disabled={geoLoading}
              >
                <LocateFixed className="w-4 h-4" />
                {geoLoading ? t('locating') : pendingCoords ? t('usingYourLocation') : t('useMyLocation')}
              </Button>
              {geoError && <p className="text-xs text-error">{geoError}</p>}
            </Card>

            <FilterRange
              key={`year-${resetKey}`}
              title={t('year')}
              icon={Calendar}
              min={1946}
              max={2027}
              step={1}
              defaultValue={pendingYear}
              showApplyButton={false}
              onApply={setPendingYear}
              className="select-none p-3"
              formatValue={yearValueFor}
            />
            <FilterRange
              key={`price-${resetKey}`}
              title={t('price')}
              icon={DollarSign}
              min={PRICE_BOUNDS[0]}
              max={PRICE_BOUNDS[1]}
              step={500}
              defaultValue={pendingPrice}
              showApplyButton={false}
              onApply={setPendingPrice}
              className="select-none p-3"
              formatValue={priceValueFor}
              allowAnyMax
            />
            <FilterRange
              key={`mileage-${resetKey}`}
              title={t('mileage')}
              icon={Gauge}
              min={0}
              max={200000}
              step={1000}
              defaultValue={pendingMileage}
              showApplyButton={false}
              onApply={setPendingMileage}
              className="select-none p-3"
              formatValue={mileageValueFor}
              allowAnyMax
            />
            <FilterDropdown
              key={`seller-type-${resetKey}`}
              title={t('seller')}
              icon={User}
              items={SELLER_TYPE_ITEMS}
              labelFor={sellerTypeLabelFor}
              defaultSelected={pendingSelectedSellerTypes}
              showApplyButton={false}
              onApply={setPendingSelectedSellerTypes}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
          </div>

          <div className="flex flex-col gap-3 min-w-0 lg:h-full lg:min-h-0">
            <FilterDropdown
              key={`make-${resetKey}`}
              title={t('make')}
              icon={Car}
              isOpen={true}
              items={makes.map((m) => m.name)}
              defaultSelected={pendingSelectedMakes}
              showApplyButton={false}
              onApply={setPendingSelectedMakes}
              columns={2}
              maxHeight={48}
              fillHeight
            />
            <FilterDropdown
              key={`model-${resetKey}-${pendingSelectedMakes.join(',')}`}
              title={t('model')}
              icon={Tag}
              isOpen={true}
              items={sortedModels.map((m) => m.name)}
              groupFor={modelGroupFor}
              defaultSelected={pendingSelectedModels}
              showApplyButton={false}
              onApply={setPendingSelectedModels}
              disabled={pendingSelectedMakes.length === 0}
              disabledMessage={t('selectMakeFirst')}
              loading={modelsLoading}
              columns={2}
              maxHeight={48}
              fillHeight
            />
          </div>

          <div className="flex flex-col gap-2 min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <FilterDropdown
              key={`vehicle-type-${resetKey}`}
              title={t('vehicleType')}
              icon={CarFront}
              items={labelsOf(VEHICLE_TYPES)}
              labelFor={vehicleTypeLabelFor}
              defaultSelected={pendingSelectedVehicleTypes}
              showApplyButton={false}
              onApply={setPendingSelectedVehicleTypes}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
            <FilterDropdown
              key={`transmission-${resetKey}`}
              title={t('transmission')}
              icon={IconManualGearbox}
              items={labelsOf(FILTER_TRANSMISSIONS)}
              labelFor={transmissionLabelFor}
              defaultSelected={pendingSelectedTransmissions}
              showApplyButton={false}
              onApply={setPendingSelectedTransmissions}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
            <FilterDropdown
              key={`drive-${resetKey}`}
              title={t('driveType')}
              icon={IconSteeringWheel}
              items={labelsOf(FILTER_DRIVES)}
              labelFor={driveLabelFor}
              defaultSelected={pendingSelectedDrives}
              showApplyButton={false}
              onApply={setPendingSelectedDrives}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
            <FilterDropdown
              key={`fuel-type-${resetKey}`}
              title={t('fuelType')}
              icon={Fuel}
              items={labelsOf(FUEL_TYPES)}
              labelFor={fuelTypeLabelFor}
              defaultSelected={pendingSelectedFuelTypes}
              showApplyButton={false}
              onApply={setPendingSelectedFuelTypes}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
            <FilterDropdown
              key={`title-document-${resetKey}`}
              title={t('titleStatus')}
              icon={FileText}
              items={labelsOf(TITLE_DOCUMENTS)}
              labelFor={titleDocumentLabelFor}
              defaultSelected={pendingSelectedTitleDocuments}
              showApplyButton={false}
              onApply={setPendingSelectedTitleDocuments}
              isOpen={true}
              columns={2}
              maxHeight={64}
              className="p-2"
              itemClassName="py-1"
              showSearch={false}
            />
          </div>

          <div className="flex flex-col gap-2 min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <FilterDropdown
              key={`exterior-color-${resetKey}`}
              title={t('exteriorColor')}
              icon={Palette}
              items={labelsOf(COLORS)}
              labelFor={colorLabelFor}
              iconFor={colorIconFor}
              defaultSelected={pendingSelectedColors}
              showApplyButton={false}
              onApply={setPendingSelectedColors}
              isOpen={true}
              columns={2}
              itemLabelClassName="text-xs"
              maxHeight={96}
              className="p-2"
              itemClassName="py-1"
            />
            <FilterDropdown
              key={`interior-color-${resetKey}`}
              title={t('interiorColor')}
              icon={Armchair}
              items={labelsOf(COLORS)}
              labelFor={colorLabelFor}
              iconFor={colorIconFor}
              defaultSelected={pendingSelectedInteriorColors}
              showApplyButton={false}
              onApply={setPendingSelectedInteriorColors}
              isOpen={true}
              columns={2}
              itemLabelClassName="text-xs"
              maxHeight={96}
              className="p-2"
              itemClassName="py-1"
            />
          </div>
        </div>

        {/* A plain flex sibling (not sticky) after the scrollable region
            above -- always renders at the true bottom of the panel, whether
            or not the filters are tall enough to need scrolling. */}
        <div className="shrink-0 px-6 py-3 bg-surface border-t border-border flex gap-2">
          <Button
            variant="ghost"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            className="flex items-center justify-center gap-2 shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            {t('reset')}
          </Button>
          <Button
            onClick={handleApplyFilters}
            disabled={!hasPendingChanges}
            variant="primary"
            className="flex-1"
          >
            {t('applyFilters')}
          </Button>
        </div>
      </Card>

      <Card className="p-3 sm:p-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFiltersOpen(true)}
              className="relative flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {t('filters')}
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary-light border-2 border-surface" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('reset')}
            </Button>
            <span className="text-sm text-muted">
              {loading ? t('searching') : t('listingsFound', { count: totalCount })}
            </span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-44">
                <Select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    // No location yet -- go get one, same as the "Use my
                    // location" button, rather than silently sorting by
                    // nothing (see fallBackFromDistanceSort if it fails).
                    if (e.target.value === DISTANCE_SORT_OPTION.value && !hasLocation) {
                      requestGeolocation();
                    }
                  }}
                  options={[...SORT_OPTIONS, DISTANCE_SORT_OPTION].map((o) => ({
                    value: o.value,
                    label: t(`sortOptions.${o.key}`),
                  }))}
                  className="text-sm"
                />
              </div>
              {/* Below `sm`, every mode collapses to the same single column
                  (variant="h" itself only goes row-layout at sm+ -- see
                  ListingCard -- and V_GRID_COLUMNS caps at 1 column below
                  sm too), so the toggle has nothing real to switch between
                  on phones -- only worth showing once there's room. */}
              <div className="hidden sm:flex items-center border border-border rounded-md">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label={t('listView')}
                  aria-pressed={viewMode === 'list'}
                  className={cn(
                    'group relative rounded-l-md p-2 cursor-pointer transition-colors',
                    viewMode === 'list' ? 'bg-primary-light text-white' : 'text-muted hover:text-foreground'
                  )}
                >
                  <List className="w-4 h-4" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {t('listView')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('compact')}
                  aria-label={t('compactCards')}
                  aria-pressed={viewMode === 'compact'}
                  className={cn(
                    'group relative p-2 cursor-pointer transition-colors border-l border-border',
                    viewMode === 'compact' ? 'bg-primary-light text-white' : 'text-muted hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {t('compactCards')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('large')}
                  aria-label={t('largeCards')}
                  aria-pressed={viewMode === 'large'}
                  className={cn(
                    'group relative rounded-r-md p-2 cursor-pointer transition-colors border-l border-border',
                    viewMode === 'large' ? 'bg-primary-light text-white' : 'text-muted hover:text-foreground'
                  )}
                >
                  <Grid2x2 className="w-4 h-4" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {t('largeCards')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <CarLoader size="lg" className="max-w-md" />
            </div>
          ) : (
            <>
              <ListingResultsGrid
                listings={listings}
                variant={viewMode === 'list' ? 'h' : 'v'}
                columns={viewMode === 'compact' ? 4 : viewMode === 'large' ? 2 : 1}
                emptyMessage={t('noListingsMatchFilters')}
                currentUsername={user?.username}
              />
              {canLoadMore && (
                <div className="flex justify-center pt-3">
                  <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? t('loading') : t('loadMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
    </div>
  );
}
