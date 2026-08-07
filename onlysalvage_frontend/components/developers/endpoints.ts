// One entry per public API endpoint (see publicapi/views.py and
// publicapi/urls.py on the backend), rendered as its own section on the
// /developers page. `descKey` looks up an already-translated one-line
// description (Developers.endpoint*) -- its short section title lives at
// `${descKey}Title` (e.g. descKey "endpointMe" -> title key
// "endpointMeTitle") rather than as a separate field here, since the two
// always come as a pair. Everything else here is a technical artifact
// (paths, code) and deliberately not run through next-intl, same reasoning
// as the rest of this page's code samples.

export type Lang = 'curl' | 'python' | 'javascript' | 'php'

export interface EndpointDoc {
  id: string
  method: string
  path: string
  descKey: string
  snippets: Record<Lang, string>
}

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'me',
    method: 'GET',
    path: '/api/v1/me/',
    descKey: 'endpointMe',
    snippets: {
      curl: `curl https://onlysalvage.com/api/v1/me/ \\
  -H "Authorization: Bearer osk_your_token_here"`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.get(
    "https://onlysalvage.com/api/v1/me/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
me = response.json()
print(me["username"], me["is_dealer"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/me/", {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
const me = await res.json();
console.log(me.username, me.is_dealer);`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/me/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
$me = json_decode(curl_exec($ch), true);
echo $me["username"] . " " . ($me["is_dealer"] ? "dealer" : "private");`,
    },
  },
  {
    id: 'choices',
    method: 'GET',
    path: '/api/v1/schema/choices/',
    descKey: 'endpointChoices',
    snippets: {
      curl: `curl https://onlysalvage.com/api/v1/schema/choices/`,
      python: `import requests

response = requests.get("https://onlysalvage.com/api/v1/schema/choices/")
choices = response.json()
for option in choices["vehicle_type"]:
    print(option["value"], option["label"])`,
      javascript: `const res = await fetch("https://onlysalvage.com/api/v1/schema/choices/");
const choices = await res.json();
choices.vehicle_type.forEach((o) => console.log(o.value, o.label));`,
      php: `<?php
$ch = curl_init("https://onlysalvage.com/api/v1/schema/choices/");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$choices = json_decode(curl_exec($ch), true);
foreach ($choices["vehicle_type"] as $option) {
    echo $option["value"] . " " . $option["label"] . "\\n";
}`,
    },
  },
  {
    id: 'makes',
    method: 'GET',
    path: '/api/inventory/makes/',
    descKey: 'endpointMakes',
    snippets: {
      curl: `curl https://onlysalvage.com/api/inventory/makes/`,
      python: `import requests

response = requests.get("https://onlysalvage.com/api/inventory/makes/")
for make in response.json():
    print(make["id"], make["name"])`,
      javascript: `const res = await fetch("https://onlysalvage.com/api/inventory/makes/");
const makes = await res.json();
makes.forEach((m) => console.log(m.id, m.name));`,
      php: `<?php
$ch = curl_init("https://onlysalvage.com/api/inventory/makes/");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$makes = json_decode(curl_exec($ch), true);
foreach ($makes as $make) {
    echo $make["id"] . " " . $make["name"] . "\\n";
}`,
    },
  },
  {
    id: 'models',
    method: 'GET',
    path: '/api/inventory/models/?make={id}',
    descKey: 'endpointModels',
    snippets: {
      curl: `curl "https://onlysalvage.com/api/inventory/models/?make=21"`,
      python: `import requests

response = requests.get("https://onlysalvage.com/api/inventory/models/", params={"make": 21})
for model in response.json():
    print(model["id"], model["name"])`,
      javascript: `const res = await fetch("https://onlysalvage.com/api/inventory/models/?make=21");
const models = await res.json();
models.forEach((m) => console.log(m.id, m.name));`,
      php: `<?php
$ch = curl_init("https://onlysalvage.com/api/inventory/models/?make=21");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$models = json_decode(curl_exec($ch), true);
foreach ($models as $model) {
    echo $model["id"] . " " . $model["name"] . "\\n";
}`,
    },
  },
  {
    id: 'list',
    method: 'GET',
    path: '/api/v1/listings/',
    descKey: 'endpointList',
    snippets: {
      curl: `curl "https://onlysalvage.com/api/v1/listings/?status=AV&min_price=5000" \\
  -H "Authorization: Bearer osk_your_token_here"`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.get(
    "https://onlysalvage.com/api/v1/listings/",
    headers={"Authorization": f"Bearer {TOKEN}"},
    params={"status": "AV", "min_price": 5000},
)
for listing in response.json()["results"]:
    print(listing["title"], listing["price"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const params = new URLSearchParams({ status: "AV", min_price: "5000" });
const res = await fetch(\`https://onlysalvage.com/api/v1/listings/?\${params}\`, {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
const { results } = await res.json();
results.forEach((listing) => console.log(listing.title, listing.price));`,
      php: `<?php
$token = "osk_your_token_here";

$query = http_build_query(["status" => "AV", "min_price" => 5000]);
$ch = curl_init("https://onlysalvage.com/api/v1/listings/?$query");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
$data = json_decode(curl_exec($ch), true);
foreach ($data["results"] as $listing) {
    echo $listing["title"] . " " . $listing["price"] . "\\n";
}`,
    },
  },
  {
    id: 'create',
    method: 'POST',
    path: '/api/v1/listings/',
    descKey: 'endpointCreate',
    snippets: {
      curl: `curl -X POST https://onlysalvage.com/api/v1/listings/ \\
  -H "Authorization: Bearer osk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vin": "1HGCM82633A004352",
    "year": 2018,
    "make": 21,
    "model": 186,
    "price": 9500,
    "vehicle_type": "SDN",
    "title_document": "SA"
  }'`,
      python: `import requests

TOKEN = "osk_your_token_here"
BASE_URL = "https://onlysalvage.com/api/v1"

response = requests.post(
    f"{BASE_URL}/listings/",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "vin": "1HGCM82633A004352",
        "year": 2018,
        "make": 21,
        "model": 186,
        "price": 9500,
        "vehicle_type": "SDN",
        "title_document": "SA",
    },
)
listing = response.json()
print(listing["id"], listing["status"])  # -> "DR"`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    vin: "1HGCM82633A004352",
    year: 2018,
    make: 21,
    model: 186,
    price: 9500,
    vehicle_type: "SDN",
    title_document: "SA",
  }),
});
const listing = await res.json();
console.log(listing.id, listing.status); // -> "DR"`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $token",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "vin" => "1HGCM82633A004352",
        "year" => 2018,
        "make" => 21,
        "model" => 186,
        "price" => 9500,
        "vehicle_type" => "SDN",
        "title_document" => "SA",
    ]),
]);
$listing = json_decode(curl_exec($ch), true);
echo $listing["id"] . " " . $listing["status"]; // -> "DR"`,
    },
  },
  {
    id: 'retrieve',
    method: 'GET',
    path: '/api/v1/listings/{id}/',
    descKey: 'endpointRetrieve',
    snippets: {
      curl: `curl https://onlysalvage.com/api/v1/listings/123/ \\
  -H "Authorization: Bearer osk_your_token_here"`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.get(
    "https://onlysalvage.com/api/v1/listings/123/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
listing = response.json()
print(listing["title"], listing["status"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/", {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
const listing = await res.json();
console.log(listing.title, listing.status);`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
$listing = json_decode(curl_exec($ch), true);
echo $listing["title"] . " " . $listing["status"];`,
    },
  },
  {
    id: 'update',
    method: 'PATCH',
    path: '/api/v1/listings/{id}/',
    descKey: 'endpointUpdate',
    snippets: {
      curl: `curl -X PATCH https://onlysalvage.com/api/v1/listings/123/ \\
  -H "Authorization: Bearer osk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"price": 8900, "description": "Price reduced -- motivated seller."}'`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.patch(
    "https://onlysalvage.com/api/v1/listings/123/",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={"price": 8900, "description": "Price reduced -- motivated seller."},
)
listing = response.json()
print(listing["price"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/", {
  method: "PATCH",
  headers: {
    Authorization: \`Bearer \${TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ price: 8900, description: "Price reduced -- motivated seller." }),
});
const listing = await res.json();
console.log(listing.price);`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "PATCH",
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $token",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "price" => 8900,
        "description" => "Price reduced -- motivated seller.",
    ]),
]);
$listing = json_decode(curl_exec($ch), true);
echo $listing["price"];`,
    },
  },
  {
    id: 'delete',
    method: 'DELETE',
    path: '/api/v1/listings/{id}/',
    descKey: 'endpointDelete',
    snippets: {
      curl: `curl -X DELETE https://onlysalvage.com/api/v1/listings/123/ \\
  -H "Authorization: Bearer osk_your_token_here"

# 204 No Content on success`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.delete(
    "https://onlysalvage.com/api/v1/listings/123/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
print(response.status_code)  # -> 204`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/", {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
console.log(res.status); // -> 204`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "DELETE",
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
curl_exec($ch);
echo curl_getinfo($ch, CURLINFO_HTTP_CODE); // -> 204`,
    },
  },
  {
    id: 'status',
    method: 'POST',
    path: '/api/v1/listings/{id}/status/',
    descKey: 'endpointStatus',
    snippets: {
      curl: `curl -X POST https://onlysalvage.com/api/v1/listings/123/status/ \\
  -H "Authorization: Bearer osk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "AV"}'`,
      python: `import requests

TOKEN = "osk_your_token_here"
listing_id = 123

requests.post(
    f"https://onlysalvage.com/api/v1/listings/{listing_id}/status/",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={"status": "AV"},
)`,
      javascript: `const TOKEN = "osk_your_token_here";
const listingId = 123;

await fetch(\`https://onlysalvage.com/api/v1/listings/\${listingId}/status/\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ status: "AV" }),
});`,
      php: `<?php
$token = "osk_your_token_here";
$listingId = 123;

$ch = curl_init("https://onlysalvage.com/api/v1/listings/$listingId/status/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $token",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(["status" => "AV"]),
]);
curl_exec($ch);`,
    },
  },
  {
    id: 'renew',
    method: 'POST',
    path: '/api/v1/listings/{id}/renew/',
    descKey: 'endpointRenew',
    snippets: {
      curl: `curl -X POST https://onlysalvage.com/api/v1/listings/123/renew/ \\
  -H "Authorization: Bearer osk_your_token_here"`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.post(
    "https://onlysalvage.com/api/v1/listings/123/renew/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
listing = response.json()
print(listing["renewal_available_at"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/renew/", {
  method: "POST",
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
const listing = await res.json();
console.log(listing.renewal_available_at);`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/renew/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
$listing = json_decode(curl_exec($ch), true);
echo $listing["renewal_available_at"];`,
    },
  },
  {
    id: 'images-list',
    method: 'GET',
    path: '/api/v1/listings/{id}/images/',
    descKey: 'endpointImagesList',
    snippets: {
      curl: `curl https://onlysalvage.com/api/v1/listings/123/images/ \\
  -H "Authorization: Bearer osk_your_token_here"`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.get(
    "https://onlysalvage.com/api/v1/listings/123/images/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
for image in response.json():
    print(image["id"], image["order"], image["large_url"])`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/images/", {
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
const images = await res.json();
images.forEach((img) => console.log(img.id, img.order, img.large_url));`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/images/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
$images = json_decode(curl_exec($ch), true);
foreach ($images as $image) {
    echo $image["id"] . " " . $image["order"] . " " . $image["large_url"] . "\\n";
}`,
    },
  },
  {
    id: 'images-upload',
    method: 'POST',
    path: '/api/v1/listings/{id}/images/',
    descKey: 'endpointImagesUpload',
    snippets: {
      curl: `curl -X POST https://onlysalvage.com/api/v1/listings/123/images/ \\
  -H "Authorization: Bearer osk_your_token_here" \\
  -F "file=@photo.jpg"

# or, from an existing hosted URL instead of a local file:
curl -X POST https://onlysalvage.com/api/v1/listings/123/images/ \\
  -H "Authorization: Bearer osk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"image_url": "https://example.com/photo.jpg"}'`,
      python: `import requests

TOKEN = "osk_your_token_here"
listing_id = 123

# From a local file
with open("photo.jpg", "rb") as f:
    requests.post(
        f"https://onlysalvage.com/api/v1/listings/{listing_id}/images/",
        headers={"Authorization": f"Bearer {TOKEN}"},
        files={"file": f},
    )

# Or from an existing hosted URL
requests.post(
    f"https://onlysalvage.com/api/v1/listings/{listing_id}/images/",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={"image_url": "https://example.com/photo.jpg"},
)`,
      javascript: `const TOKEN = "osk_your_token_here";
const listingId = 123;

// From a local file
import { readFile } from "node:fs/promises";
const form = new FormData();
form.append("file", new Blob([await readFile("photo.jpg")]), "photo.jpg");
await fetch(\`https://onlysalvage.com/api/v1/listings/\${listingId}/images/\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${TOKEN}\` },
  body: form,
});

// Or from an existing hosted URL
await fetch(\`https://onlysalvage.com/api/v1/listings/\${listingId}/images/\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${TOKEN}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image_url: "https://example.com/photo.jpg" }),
});`,
      php: `<?php
$token = "osk_your_token_here";
$listingId = 123;

// From a local file
$ch = curl_init("https://onlysalvage.com/api/v1/listings/$listingId/images/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
    CURLOPT_POSTFIELDS => ["file" => new CURLFile("photo.jpg")],
]);
curl_exec($ch);

// Or from an existing hosted URL
$ch = curl_init("https://onlysalvage.com/api/v1/listings/$listingId/images/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer $token",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode(["image_url" => "https://example.com/photo.jpg"]),
]);
curl_exec($ch);`,
    },
  },
  {
    id: 'images-delete',
    method: 'DELETE',
    path: '/api/v1/listings/{id}/images/{image_id}/',
    descKey: 'endpointImageDelete',
    snippets: {
      curl: `curl -X DELETE https://onlysalvage.com/api/v1/listings/123/images/456/ \\
  -H "Authorization: Bearer osk_your_token_here"

# 204 No Content on success`,
      python: `import requests

TOKEN = "osk_your_token_here"

response = requests.delete(
    "https://onlysalvage.com/api/v1/listings/123/images/456/",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
print(response.status_code)  # -> 204`,
      javascript: `const TOKEN = "osk_your_token_here";

const res = await fetch("https://onlysalvage.com/api/v1/listings/123/images/456/", {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${TOKEN}\` },
});
console.log(res.status); // -> 204`,
      php: `<?php
$token = "osk_your_token_here";

$ch = curl_init("https://onlysalvage.com/api/v1/listings/123/images/456/");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "DELETE",
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $token"],
]);
curl_exec($ch);
echo curl_getinfo($ch, CURLINFO_HTTP_CODE); // -> 204`,
    },
  },
]
