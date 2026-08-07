export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
].map((code) => ({ value: code, label: code }));

export interface SellerReview {
  id: number;
  reviewer: number;
  reviewer_username: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface TopRatedSeller {
  id: number;
  username: string;
  business_name?: string;
  is_dealer: boolean;
  is_verified?: boolean;
  city?: string;
  state?: string;
  street_address?: string | null;
  zip_code?: string | null;
  profile_picture?: string | null;
  has_phone?: boolean;
  email?: string | null;
  avg_rating: number;
  review_count: number;
}

export interface SellerListItem {
  id: number;
  username: string;
  business_name?: string;
  is_dealer: boolean;
  is_verified?: boolean;
  offers_financing?: boolean;
  city?: string;
  state?: string;
  street_address?: string | null;
  zip_code?: string | null;
  profile_picture?: string | null;
  has_phone?: boolean;
  email?: string | null;
  avg_rating: number | null;
  review_count: number;
  listings_count: number;
}

export interface Profile {
  id: number;
  username: string;
  is_dealer: boolean;
  is_verified?: boolean;
  // Only set on the owner's own profile (via /auth/me/) -- "verified" |
  // "pending" | "rejected" | "none". Lets the profile page show the right
  // call to action without a separate request.
  verification_status?: 'verified' | 'pending' | 'rejected' | 'none';
  offers_financing?: boolean;
  offers_warranty?: boolean;
  warranty_duration?: string;
  warranty_description?: string;
  phone?: string;
  // Only meaningful on the owner's own profile (via /auth/me/) -- set once
  // CheckPhoneVerificationView confirms a Twilio Verify code, and reset back
  // to false the moment the phone number itself changes (see UserSerializer).
  phone_verified?: boolean;
  // Only present when this Profile came embedded in a Listing response --
  // the listing endpoint omits the actual phone; it's fetched separately
  // when the buyer clicks Call (see callSeller in lib/api.ts).
  has_phone?: boolean;
  // Just the first 3 digits, shown before reveal (see ContactSellerCard) --
  // same "area code only" disclosure as has_phone's own comment above.
  phone_area_code?: string | null;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  profile_picture?: string | null;
  business_name?: string;
  description?: string;
  seller_reviews_received?: SellerReview[];
  email?: string | null;
  show_email?: boolean;
  date_joined?: string;
  sold_listings_count?: number;
}

export interface Make {
  id: number;
  name: string;
}

export interface CityListing {
  city: string;
  state: string;
  count: number;
}

export type VehicleOptionCategory = 'CMF' | 'TEC' | 'SAF' | 'EXT' | 'PRF';

export interface VehicleOption {
  id: number;
  label: string;
  icon: string;
  category: VehicleOptionCategory;
}

export interface VehicleModel {
  id: number;
  name: string;
  make: number;
}

// Every listing is normalized onto one of these five body styles -- there's
// no separate "full" vs. "selectable" list the way transmission/drive have
// below, since every Wagon/Coupe/Hatchback listing was migrated onto one of
// the first four (see inventory/migrations/0029_squash_body_styles.py on the
// backend) and nothing can produce one of the old values anymore (VIN decode
// included -- see mapBodyClassToVehicleType in SellForm). OTHER exists as a
// catch-all for the public API: a third-party client can submit an
// unrecognized body style, and the backend's generalize_vehicle_type
// (inventory/models.py) folds it here instead of rejecting the listing.
export const VEHICLE_TYPES = [
  { value: "SDN", label: "Sedan" },
  { value: "TK", label: "Truck" },
  { value: "SUV", label: "SUV" },
  { value: "VAN", label: "Van" },
  { value: "OTH", label: "Other" },
];

export const TRANSMISSIONS = [
  { value: "ATM", label: "Automatic" },
  { value: "MAN", label: "Manual" },
  { value: "CVT", label: "CVT" },
  { value: "DTC", label: "DCT" },
  { value: "ECVT", label: "eCVT" },
];

export const DRIVES = [
  { value: "FWD", label: "Front Wheel Drive" },
  { value: "RWD", label: "Rear Wheel Drive" },
  { value: "AWD", label: "All Wheel Drive" },
  { value: "4WD", label: "Four Wheel Drive" },
  { value: "EAWD", label: "Electric All Wheel Drive" },
  { value: "OTH", label: "Other" },
];

// Narrowed subsets used everywhere a user actually *picks* one of these
// (the inventory filters, and the sell/edit listing forms) -- the full
// lists above stay exported since translating an existing listing's stored
// code back to a label (e.g. on its detail page) must still cover every
// real value in the DB, including ones no longer selectable here.
export const FILTER_TRANSMISSIONS = TRANSMISSIONS.filter((o) => ["ATM", "MAN"].includes(o.value));
export const FILTER_DRIVES = DRIVES.filter((o) => o.value !== "EAWD");

export const FUEL_TYPES = [
  { value: "GAS", label: "Gasoline" },
  { value: "DIS", label: "Diesel" },
  { value: "HYB", label: "Hybrid" },
  { value: "ELC", label: "Electric" },
];

// No plain "Clean" option -- every car on a salvage marketplace has a
// branded title or a total-loss history by definition (see
// Listing.TitleDocument on the backend). CLEAN_TOTAL_LOSS is the exception:
// an insurance-declared total loss whose title was never actually branded.
export const TITLE_DOCUMENTS = [
  { value: "RE", label: "Rebuilt" },
  { value: "SA", label: "Salvage" },
  { value: "CT", label: "Clean (Total Loss)" },
];

export const COLORS = [
  { value: "BLK", label: "Black" },
  { value: "WHT", label: "White" },
  { value: "SIL", label: "Silver" },
  { value: "GRY", label: "Grey" },
  { value: "RED", label: "Red" },
  { value: "BLU", label: "Blue" },
  { value: "BRW", label: "Brown" },
  { value: "TAN", label: "Beige/Tan" },
  { value: "GRN", label: "Green" },
  { value: "ORG", label: "Orange" },
  { value: "YEL", label: "Yellow" },
  { value: "GLD", label: "Gold" },
  { value: "MAR", label: "Maroon" },
  { value: "PUR", label: "Purple" },
];

// Codes must match Report.LISTING_REASONS / Report.SELLER_REASONS on the
// backend (inventory/models.py) -- the API rejects a reason that isn't in
// the matching set for whichever target (listing vs seller) is being reported.
export const LISTING_REPORT_REASONS = [
  { value: "FAKE_VIN", label: "VIN doesn't match the vehicle" },
  { value: "DUP_VIN", label: "VIN is already listed on another ad" },
  { value: "MISLEADING", label: "Listing details are misleading or inaccurate" },
  { value: "SOLD", label: "Vehicle has already been sold elsewhere" },
  { value: "SCAM", label: "Suspected scam or fraud" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Other" },
];

export const SELLER_REPORT_REASONS = [
  { value: "SCAM", label: "Suspected scam or fraud" },
  { value: "HARASSMENT", label: "Harassment or abusive behavior" },
  { value: "FAKE_PROFILE", label: "Fake or impersonating profile" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Other" },
];

export type PhotoType = "gallery" | "before_repair";

export interface ListingImage {
  id: number;
  image_url: string;
  large_url: string;
  medium_url: string;
  thumb_url: string;
  order: number | null;
  photo_type: PhotoType;
  status: "pending" | "ready" | "failed";
}

export interface ListingReview {
  id: number;
  reviewer: number;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Listing {
  id: number;
  slug: string;
  title: string;
  vin: string;
  vehicle_type: string;
  year: number;
  make: Make;
  model: VehicleModel;
  trim?: string | null;
  mileage?: number | null;
  title_document: string;
  fuel_type: string;
  drive: string;
  transmission: string;
  engine?: string | null;
  description?: string | null;
  exterior_color?: string | null;
  interior_color?: string | null;
  video_url?: string | null;
  city_mpg?: number | null;
  hwy_mpg?: number | null;
  price?: number | null;
  retail_price?: number | null;
  owners?: number | null;
  carfax_pdf?: string | null;
  alignment_report?: string | null;
  inspection_report?: string | null;
  options: VehicleOption[];
  is_active: boolean;
  // "DR" (draft) only ever reaches the frontend via a direct-by-slug fetch
  // of the owner's own saved draft (see EditListingForm, which is how a
  // draft gets resumed) -- every other listing-fetching path (search,
  // browse, ListingSummary below) never returns one at all.
  status: "AV" | "PE" | "SO" | "DR";
  created_at: string;
  seller: Profile;
  images: ListingImage[];
  // Only ever set on a listing created via CSV bulk import (see
  // inventory/api/bulk_import.py) -- how many image_urls that row listed,
  // decremented as any that fail to fetch get given up on. Null for every
  // other creation path, where there's no fixed target and the seller
  // controls when they're done adding photos themselves.
  expected_photo_count: number | null;
  reviews: ListingReview[];
  likes_count: number;
  is_liked: boolean;
  call_count: number;
  views_count: number;
  has_warranty: boolean;
  renewed_at?: string | null;
  renewal_count: number;
  can_renew: boolean;
  renewal_available_at: string;
  // Whether "before repair" (damage) photos show to every visitor -- off by
  // default. The raw damage_photos_token never reaches this response (see
  // ListingDetailSerializer) -- only the owner can retrieve the actual link,
  // via getDamagePhotosLink().
  damage_photos_public: boolean;
  // True the moment any before_repair photo exists, regardless of whether
  // it's actually included in `images` above -- lets the frontend show
  // "Request damage pictures" even when they're currently hidden.
  has_damage_photos: boolean;
}

export interface ListingSummary {
  id: number;
  slug: string;
  title: string;
  price?: number | null;
  is_promoted: boolean;
  is_active: boolean;
  thumbnails: { id: number; thumb_url: string; medium_url: string; large_url: string; image_url: string }[];
  vin: string;
  status: "AV" | "PE" | "SO";
  year: number;
  mileage?: number | null;
  transmission?: string;
  fuel_type?: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  call_count: number;
  views_count: number;
  has_warranty: boolean;
  // Only present when the request included a resolvable location
  // (lat/lng or zip_code) -- see ListingViewSet.get_queryset's Distance
  // annotation. Miles.
  distance?: number | null;
  seller: {
    id: number;
    username: string;
    business_name?: string | null;
    is_dealer: boolean;
    is_verified?: boolean;
    city?: string | null;
    state?: string | null;
    profile_picture?: string | null;
    has_phone?: boolean;
    email?: string | null;
  };
}

// Mirrors ListingBulkImportView's response (inventory/api/bulk_import.py) --
// one row per line of the uploaded CSV, in the same order.
export interface BulkImportRowResult {
  row: number;
  success: boolean;
  vin: string;
  listing?: { id: number; slug: string; title: string };
  errors?: Record<string, string>;
}

export interface BulkImportResponse {
  total: number;
  imported: number;
  failed: number;
  results: BulkImportRowResult[];
}

// Mirrors ApiKeyStatusSerializer (users/api/serializers.py).
export type ApiKeyStatusValue = 'none' | 'PE' | 'AP' | 'DE' | 'RE';

export interface ApiKeyStatus {
  status: ApiKeyStatusValue;
  status_display: string;
  has_token: boolean;
  key_prefix: string;
  note: string;
  denial_reason: string;
  requested_at: string | null;
  reviewed_at: string | null;
  issued_at: string | null;
  last_used_at: string | null;
}

export interface BuyerChecklistItem {
  id: number;
  icon: string;
  text: string;
  note: string;
}

export interface BuyerChecklistCategory {
  id: number;
  icon: string;
  title: string;
  items: BuyerChecklistItem[];
}

// Mirrors SiteFeedback.Category (users/models.py).
export const FEEDBACK_CATEGORIES = [
  { value: 'BUG', label: 'Bug Report' },
  { value: 'SUG', label: 'Suggestion' },
  { value: 'OTH', label: 'Other' },
];
