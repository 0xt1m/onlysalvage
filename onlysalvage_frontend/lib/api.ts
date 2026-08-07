import { refreshAccessToken, logout } from "./auth";
import { getApiUrl } from "./apiUrl";

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response | null> => {
  // Let the browser set the multipart boundary itself when sending FormData
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  let res = await fetch(url, {
    ...options,
    credentials: "include", // browser attaches the access_token cookie automatically
    headers: {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken(); // sets new access cookie server-side
    if (refreshed) {
      res = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          ...(!isFormData && { "Content-Type": "application/json" }),
          ...options.headers,
        },
      });
    } else {
      await logout();
      // window.location.href = "/login";
      return null;
    }
  }

  return res;
};

export const getMe = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/`);
  if (!res || !res.ok) return null;
  return res.json();
};

export const getProfile = async (username: string) => {
  const res = await fetch(`${getApiUrl()}/users/${username}/`);
  if (!res.ok) return null;
  return res.json();
};

export const getListingsBySeller = async (sellerId: number) => {
  const res = await fetch(
    `${getApiUrl()}/inventory/listings/?seller_id=${sellerId}&is_active=true`
  );
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return (data?.results ?? []) as import("./types").ListingSummary[];
};

export const getListings = async (params: Record<string, string | number> = {}) => {
  const query = new URLSearchParams({ is_active: "true", ...params } as Record<string, string>);
  const res = await fetch(`${getApiUrl()}/inventory/listings/?${query.toString()}`, {
    credentials: "include", // so likes_count/is_liked reflect the logged-in viewer, if any
  });
  if (!res.ok) return { results: [] as import("./types").ListingSummary[], count: 0 };
  const data = await res.json().catch(() => null);
  return {
    results: (data?.results ?? []) as import("./types").ListingSummary[],
    count: (data?.count ?? 0) as number,
  };
};

export const updateProfile = async (data: FormData) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/`, {
    method: "PATCH",
    body: data,
  });
  if (!res || !res.ok) return null;
  return res.json();
};

// Fire-and-forget from LanguageSwitcher -- lets a logged-in user's language
// choice follow them to a new device/browser (see User.preferred_locale),
// rather than only living in that browser's NEXT_LOCALE cookie. Failure just
// means the account-level sync doesn't happen; the switch itself already
// went through via next-intl's own router, so this never blocks on it.
export const updatePreferredLocale = async (locale: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferred_locale: locale }),
  });
  return !!res && res.ok;
};

// `phone` covers both cases the backend supports: pass the account's current
// number to verify it, or a different one to change to it (see
// SendPhoneCodeView/CheckPhoneCodeView).
export const sendPhoneVerificationCode = async (phone: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/phone/send-code/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return !!res && res.ok;
};

export const checkPhoneVerificationCode = async (phone: string, code: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/phone/verify-code/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  return !!res && res.ok;
};

// Registration-time phone verification -- no account exists yet at this
// point, so these hit their own AllowAny endpoints rather than the
// authenticated me/phone/* ones above.
export const sendRegistrationPhoneCode = async (phone: string) => {
  const res = await fetch(`${getApiUrl()}/auth/register/phone/send-code/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.ok;
};

export const checkRegistrationPhoneCode = async (phone: string, code: string) => {
  const res = await fetch(`${getApiUrl()}/auth/register/phone/verify-code/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  return res.ok;
};

export const deleteAccount = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/`, {
    method: "DELETE",
  });
  return !!res?.ok;
};

// Not gated behind login (AllowAny on the backend) -- anonymous visitors can
// report a bug or suggest a feature too, same reasoning as scheduleTestDrive
// above. credentials are still sent so a logged-in submitter gets linked to
// it server-side without needing to re-enter their email.
export const submitFeedback = async (data: {
  category: string;
  subject: string;
  message: string;
  email?: string;
  context?: string;
}) => {
  const res = await fetch(`${getApiUrl()}/users/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json as Record<string, string[]> | null };
};

// Delivered to Telegram on the backend rather than email (see
// ContactMessageView) -- otherwise the same public-but-account-aware
// pattern as submitFeedback above.
export const submitContactMessage = async (data: { name?: string; email?: string; message: string }) => {
  const res = await fetch(`${getApiUrl()}/users/contact/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json as Record<string, string[]> | null };
};

export const getApiKeyStatus = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/api-key/`);
  if (!res || !res.ok) return null;
  return res.json() as Promise<import("./types").ApiKeyStatus>;
};

export const requestApiKey = async (note?: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/api-key/request/`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? "" }),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json as import("./types").ApiKeyStatus | { detail?: string } | null };
};

// Returns the plaintext token exactly once -- neither this endpoint nor any
// other can ever retrieve it again afterward (see ApiKey.issue_token on the
// backend). Also doubles as "regenerate": calling it again on an
// already-approved key immediately invalidates whatever token was issued
// before.
export const generateApiKey = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/api-key/generate/`, { method: "POST" });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json as { token: string; key_prefix: string; issued_at: string } | { detail?: string } | null };
};

export const revokeApiKey = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/api-key/revoke/`, { method: "POST" });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json as import("./types").ApiKeyStatus | { detail?: string } | null };
};

export const requestVerification = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/me/verification/`, {
    method: "POST",
  });
  if (!res) return null;
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data: data as { detail?: string; verification_status?: string } | null };
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/auth/change-password/`, {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

export const createListing = async (data: Record<string, unknown>) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

export const presignListingImage = async (listingId: number, contentType: string) => {
  const res = await fetchWithAuth(
    `${getApiUrl()}/inventory/listings/${listingId}/images/presign/`,
    {
      method: "POST",
      body: JSON.stringify({ content_type: contentType }),
    }
  );
  if (!res || !res.ok) return null;
  return res.json() as Promise<{ upload: { url: string; fields: Record<string, string> }; s3_key: string }>;
};

export const uploadImageToS3 = async (uploadUrl: string, fields: Record<string, string>, file: File) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append("file", file);

  const res = await fetch(uploadUrl, { method: "POST", body: formData });
  return res.ok;
};

export const registerListingImage = async (
  listingId: number,
  s3Key: string,
  order?: number,
  photoType?: import("./types").PhotoType
) => {
  const res = await fetchWithAuth(
    `${getApiUrl()}/inventory/listings/${listingId}/images/`,
    {
      method: "POST",
      body: JSON.stringify({
        original_s3_key: s3Key,
        ...(order !== undefined && { order }),
        ...(photoType && { photo_type: photoType }),
      }),
    }
  );
  if (!res || !res.ok) return null;
  return res.json();
};

export const getListing = async (slug: string) => {
  const res = await fetch(`${getApiUrl()}/inventory/listings/${slug}/`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json() as Promise<import("./types").Listing>;
};

export const getRandomListingSlug = async () => {
  const res = await fetch(`${getApiUrl()}/inventory/listings/random/`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.slug as string) ?? null;
};

export const translateText = async (text: string, target: string) => {
  const res = await fetch(`${getApiUrl()}/translate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ translated_text: string; detected_source_language?: string }>;
};

export const getSimilarListings = async (slug: string, limit = 4) => {
  const res = await fetch(`${getApiUrl()}/inventory/listings/${slug}/similar/?limit=${limit}`);
  if (!res.ok) return [] as import("./types").ListingSummary[];
  return (await res.json().catch(() => [])) as import("./types").ListingSummary[];
};

// Not gated behind login (AllowAny on the backend) -- anonymous visitors can
// request a test drive too, so contact details are collected in the form
// itself rather than assumed from an account. credentials are still sent so
// a logged-in requester gets linked to the request server-side.
export const scheduleTestDrive = async (
  slug: string,
  data: {
    requester_name: string;
    requester_email?: string;
    requester_phone?: string;
    preferred_datetime: string;
    message?: string;
  }
) => {
  const res = await fetch(`${getApiUrl()}/inventory/listings/${slug}/test-drive/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json as Record<string, string[]> | null };
};

export const likeListing = async (listingId: number) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${listingId}/like/`, {
    method: "POST",
  });
  if (!res || !res.ok) return null;
  return res.json() as Promise<{ liked: boolean; likes_count: number }>;
};

export const unlikeListing = async (listingId: number) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${listingId}/like/`, {
    method: "DELETE",
  });
  if (!res || !res.ok) return null;
  return res.json() as Promise<{ liked: boolean; likes_count: number }>;
};

export const callSeller = async (listingId: number) => {
  const res = await fetch(`${getApiUrl()}/inventory/listings/${listingId}/call/`, {
    method: "POST",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ phone: string }>;
};

// Same fetch-on-click reveal as callSeller, just scoped to a seller's own
// card/profile instead of a specific listing -- no call_count to bump here.
export const callSellerProfile = async (username: string) => {
  const res = await fetch(`${getApiUrl()}/users/${encodeURIComponent(username)}/call/`, {
    method: "POST",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ phone: string }>;
};

export const getMySellerReview = async (username: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/users/${encodeURIComponent(username)}/reviews/`);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.review ?? null) as import("./types").SellerReview | null;
};

export const submitSellerReview = async (username: string, rating: number, comment: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/users/${encodeURIComponent(username)}/reviews/`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

export const reportListing = async (slug: string, reason: string, details: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/report/`, {
    method: "POST",
    body: JSON.stringify({ reason, details }),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

export const reportSeller = async (username: string, reason: string, details: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/users/${encodeURIComponent(username)}/report/`, {
    method: "POST",
    body: JSON.stringify({ reason, details }),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

export const updateListing = async (slug: string, data: Record<string, unknown>) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

// Bumps the listing back to the top of inventory's default sort (see
// Listing.renewed_at and ListingViewSet.renew on the backend) -- only
// possible once the 7-day cooldown has elapsed and fewer than 3 renewals
// have been used already, both enforced server-side.
export const renewListing = async (slug: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/renew/`, {
    method: "POST",
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json };
};

// Permanently deletes the listing -- draft or published alike -- including
// its S3-backed photos/documents (see ListingViewSet.perform_destroy /
// Listing.hard_delete_with_s3_images). This is NOT what the listing card's
// "Hide" action uses (that's a PATCH setting is_active=false, fully
// reversible) -- this is the distinct, irreversible "Delete" action, so
// callers should always confirm before calling it. Unlike deleteListingBeacon,
// this is awaited and reports success/failure rather than best-effort.
export const deleteListing = async (slug: string) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "DELETE",
  });
  return { ok: !!res?.ok };
};

// Best-effort cleanup for a draft listing (see SellForm) abandoned before
// publishing -- fired from a pagehide/unmount handler, so nothing can await
// it. `keepalive` is what lets the browser actually finish sending the
// request after the page has started tearing down, the fetch equivalent of
// navigator.sendBeacon (which can't do an authenticated DELETE). The
// backend also independently sweeps stale drafts (delete_stale_drafts
// management command) as a backstop for whenever this never fires at all --
// browser crash, killed process, etc.
export const deleteListingBeacon = (slug: string) => {
  fetch(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "DELETE",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
};

// Public/no-auth pre-flight check so the sell/edit forms can warn the user
// (with a link to the conflicting listing) before they hit submit, rather
// than only finding out from a generic field error after the fact. The
// create/update endpoints still enforce this server-side regardless.
export const checkVinAvailability = async (vin: string, excludeSlug?: string) => {
  const params = new URLSearchParams({ vin });
  if (excludeSlug) params.set("exclude", excludeSlug);

  const res = await fetch(`${getApiUrl()}/inventory/listings/check-vin/?${params.toString()}`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    available: boolean;
    listing?: { id: number; slug: string; title: string };
  }>;
};

export const uploadCarfaxReport = async (slug: string, file: File) => {
  const data = new FormData();
  data.append("carfax_pdf", file);
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "PATCH",
    body: data,
  });
  if (!res || !res.ok) return null;
  return res.json() as Promise<import("./types").Listing>;
};

export const uploadAlignmentReport = async (slug: string, file: File) => {
  const data = new FormData();
  data.append("alignment_report", file);
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "PATCH",
    body: data,
  });
  if (!res || !res.ok) return null;
  return res.json() as Promise<import("./types").Listing>;
};

export const uploadInspectionReport = async (slug: string, file: File) => {
  const data = new FormData();
  data.append("inspection_report", file);
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/${slug}/`, {
    method: "PATCH",
    body: data,
  });
  if (!res || !res.ok) return null;
  return res.json() as Promise<import("./types").Listing>;
};

export const deleteListingImage = async (listingId: number, imageId: number) => {
  const res = await fetchWithAuth(
    `${getApiUrl()}/inventory/listings/${listingId}/images/${imageId}/`,
    { method: "DELETE" }
  );
  return !!res?.ok;
};

// Dealer-only CSV bulk import -- each row becomes a saved draft listing
// (see the Drafts section on the profile page), never published directly,
// since a CSV row can't carry a real photo upload and listings can't publish
// without at least one (see ListingUpdateSerializer.validate).
export const bulkImportListings = async (file: File) => {
  const data = new FormData();
  data.append("file", file);
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/bulk-import/`, {
    method: "POST",
    body: data,
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, status: res?.status, data: json as import("./types").BulkImportResponse | { detail?: string } | null };
};

// Fetched (rather than a plain <a href>) so the auth cookie/refresh flow
// goes through fetchWithAuth like every other authenticated request here --
// a plain link would depend on the browser sending cookies cross-origin on
// its own, which isn't guaranteed depending on how the API is hosted.
export const downloadBulkImportTemplate = async () => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/listings/bulk-import/template/`);
  if (!res || !res.ok) return false;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "listing-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
};

export const getMakes = async () => {
  const res = await fetch(`${getApiUrl()}/inventory/makes/`);
  if (!res.ok) return [];
  return res.json() as Promise<import("./types").Make[]>;
};

export const getModels = async (makeId: number) => {
  const res = await fetch(`${getApiUrl()}/inventory/models/?make=${makeId}`);
  if (!res.ok) return [];
  return res.json() as Promise<import("./types").VehicleModel[]>;
};

// Union of models across however many makes are passed -- used by the
// inventory filter's Model dropdown, which depends on every currently
// checked Make rather than just one.
export const getModelsForMakes = async (makeIds: number[]) => {
  if (makeIds.length === 0) return [];
  const res = await fetch(`${getApiUrl()}/inventory/models/?make=${makeIds.join(',')}`);
  if (!res.ok) return [];
  return res.json() as Promise<import("./types").VehicleModel[]>;
};

// Sell/Edit forms only -- always sent with an auth cookie, since a request
// needs a requester (see MakeModelRequestView on the backend).
export const requestMakeModel = async (data: { kind: 'MAKE' | 'MODEL'; name: string; make?: number }) => {
  const res = await fetchWithAuth(`${getApiUrl()}/inventory/make-model-requests/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, data: json as Record<string, string[]> | null };
};

export const getVehicleOptions = async () => {
  const res = await fetch(`${getApiUrl()}/inventory/options/`);
  if (!res.ok) return [];
  return res.json() as Promise<import("./types").VehicleOption[]>;
};

// NHTSA vPIC: free, no API key required, public domain.
// https://vpic.nhtsa.dot.gov/api/
export const decodeVin = async (vin: string) => {
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.Results?.[0] ?? null;
};

// Proxied through the backend (rather than calling Google Places directly)
// so the billable API key stays server-side.
export const autocompleteAddress = async (input: string, options?: { citiesOnly?: boolean }) => {
  const query = new URLSearchParams({ input });
  if (options?.citiesOnly) query.set('types', 'city');
  const res = await fetch(`${getApiUrl()}/users/address-autocomplete/?${query.toString()}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return (data?.suggestions ?? []) as { place_id: string; description: string }[];
};

export const getAddressDetails = async (placeId: string) => {
  const res = await fetch(`${getApiUrl()}/users/address-details/?place_id=${encodeURIComponent(placeId)}`);
  if (!res.ok) return null;
  return res.json().catch(() => null) as Promise<{
    street_address: string;
    city: string;
    state: string;
    zip_code: string;
  } | null>;
};