# Saleor Tax App — technical research

> Snapshot of the Saleor Tax App framework as of 2026-05.
> Saleor evolves fast; re-validate everything in this doc before
> writing code against it.

## 1. What a Tax App is

Saleor introduced the **Tax App** in v3.14 (2024) as the
replacement for the older "tax provider plugin" mechanism. A Tax
App is a Saleor App (registered via Saleor's standard App
manifest) that subscribes to **sync** tax webhooks. Saleor pauses
checkout / order processing, calls the app, waits for the
response, and applies the returned tax breakdown.

Docs: <https://docs.saleor.io/developer/app-store/getting-started/tax-app>

## 2. Webhook events the connector subscribes to

| Event | Trigger | Response budget |
|---|---|---|
| `CHECKOUT_CALCULATE_TAXES` | Checkout finalize / line edit | 20 s hard cap; ~2 s target |
| `ORDER_CALCULATE_TAXES` | Order create / line edit on draft | 20 s hard cap; ~2 s target |

Both are **sync** — Saleor blocks the user-facing operation until
the app responds. A slow or unreachable Tax App = stalled
checkout. Fail-soft (constitution §8) returns empty tax → Saleor
falls back to its own catalog rates rather than blocking.

The two payloads are structurally similar (both are GraphQL
fragments wrapping line items + shipping + a destination
address). The connector can share most transformer code between
the two handlers.

## 3. Webhook payload — fields the connector reads

Both events deliver a JSON payload with:

```json
{
  "taxBase": {
    "currency": "USD",                  // engine §5 gate
    "shippingPrice": { "amount": 5.99 },
    "address": {
      "country": { "code": "US" },      // engine §10 gate
      "countryArea": "MN",              // state code, for nexus filter
      "postalCode": "55401-1234",       // engine §1 source of truth
      ...
    },
    "lines": [
      {
        "id": "Q2hlY2tvdXRMaW5lOjE=",   // base64-encoded checkout line ID
        "totalPrice": { "amount": 100.0 },
        "quantity": 1,
        "sourceLine": {
          "productSku": "TSHIRT-RED-L",
          "productName": "T-shirt (red, L)",
          ...
        }
      },
      ...
    ]
  },
  "issuingPrincipal": { ... }            // app token info
}
```

What the connector cares about:

- **Gate**: `currency` is `"USD"` and `address.country.code` is
  `"US"`. Otherwise return empty.
- **Destination**: `address.postalCode` → ZIP5 + optional ZIP4.
- **Nexus** (post-v0.1): `countryArea` matches the configured
  state list.
- **Lines**: per-line `id` + `totalPrice.amount`. The OST engine
  is line-based; we send one OST line per Saleor line.
- **Shipping**: `shippingPrice.amount` becomes one additional
  line with category `shipping` (when OST supports a shipping
  category) or `general`.

## 4. Webhook response — what the connector returns

Saleor's expected response shape (the same for both events):

```json
{
  "shipping_price_gross_amount": 6.45,    // shipping incl. tax
  "shipping_price_net_amount": 5.99,      // shipping pre-tax
  "shipping_tax_rate": 0.07731,           // shipping effective rate
  "lines": [
    {
      "total_gross_amount": 107.69,       // line incl. tax
      "total_net_amount": 100.00,         // line pre-tax
      "tax_rate": 0.07690                 // line effective rate (decimal, not %)
    },
    ...
  ]
}
```

Per-line `total_net_amount` MUST match the Saleor request's
`totalPrice.amount` exactly. Saleor doesn't round-trip our net
through — it trusts the gross we send back and uses the rate for
display. Mismatched nets get logged but not rejected.

Tax rate is **decimal** (0.07690), not percent (7.690). The OST
engine returns percent strings; transformer divides by 100.

## 5. Authentication

Saleor signs every webhook with a JWT. The signing key is
distributed via JWKS at the Saleor instance's `.well-known/jwks.json`
endpoint. The connector:

1. On install (the `register` handler), persists the Saleor
   instance's `saleorApiUrl` + the app's `authToken`.
2. On every webhook request, verifies the `Saleor-Signature`
   header against the JWKS fetched (and cached) from the
   installed Saleor instance.
3. Rejects requests with invalid / missing / expired signatures.

`@saleor/app-sdk` handles all of this — we don't roll our own.

## 6. App installation flow

Saleor's standard App install:

1. Admin visits Saleor → Apps → Install from URL, pastes our
   manifest URL (e.g., `https://ostax.example.com/api/manifest`).
2. Saleor fetches the manifest, shows the requested permissions
   to the admin, asks for confirmation.
3. On confirm, Saleor POSTs to our `/api/register` endpoint with
   an `auth_token` the app uses for subsequent admin-facing API
   calls.
4. The app responds 200; install succeeds; the admin can now
   configure it (set OST engine URL, etc.) via the app's
   settings page.

Settings UI is optional — for v0.1 we can configure via
environment variables and skip the UI. v0.2 adds an embedded
settings page.

## 7. Manifest declaration

The manifest declares (among other things):

```json
{
  "id": "ejosterberg.opensalestax",
  "version": "0.1.0",
  "name": "OpenSalesTax",
  "about": "Destination-based US sales tax via OpenSalesTax engine.",
  "permissions": ["HANDLE_TAXES"],
  "appUrl": "https://ostax.example.com",
  "tokenTargetUrl": "https://ostax.example.com/api/register",
  "dataPrivacyUrl": "https://github.com/.../PRIVACY.md",
  "supportUrl": "https://github.com/.../issues",
  "webhooks": [
    {
      "name": "Checkout tax calculation",
      "asyncEvents": [],
      "syncEvents": ["CHECKOUT_CALCULATE_TAXES"],
      "targetUrl": "https://ostax.example.com/api/webhooks/checkout-calculate-taxes",
      "query": "..."   // GraphQL subscription query
    },
    {
      "name": "Order tax calculation",
      "syncEvents": ["ORDER_CALCULATE_TAXES"],
      "targetUrl": "https://ostax.example.com/api/webhooks/order-calculate-taxes",
      "query": "..."
    }
  ]
}
```

The `query` field is a GraphQL subscription that Saleor uses to
populate the webhook payload. We define the minimum-needed fields
to keep payload size small — `currency`, `address`, `lines` (id +
totalPrice + quantity), `shippingPrice`. Anything else costs us
parse time + bandwidth.

## 8. Auth-token storage

`@saleor/app-sdk` requires an `APL` (App Persistence Layer) for
storing the per-Saleor-instance auth tokens. Options:

- **`FileAPL`** — JSON file on disk. Trivial; fine for
  single-instance dev. Lost on container restart unless we mount
  a volume.
- **`EnvAPL`** — env-var-backed. Single-tenant only. Cleanest
  for a self-hosted single-merchant deploy.
- **`UpstashRedisAPL`** — Saleor's recommendation for multi-tenant
  hosted apps. We're self-hosted, so don't bring in Redis just
  for the APL.
- **Custom Postgres APL** — implement `APL` interface against the
  merchant's existing Postgres (which Saleor also uses).

**v0.1: `EnvAPL`** (single-tenant). `v0.2:` custom Postgres APL
(multi-tenant for hosted SaaS, if Eric ever takes Decision Y).

## 9. Test environment

Saleor publishes a `docker-compose.yml` for local dev:
<https://github.com/saleor/saleor-platform>. It boots Saleor +
Postgres + Redis + Saleor Dashboard. We extend that compose file
with our Tax App container + an OST engine container.

For unit tests: mock `@saleor/app-sdk` and the OST client; test
the transformers in isolation. For integration tests: spin the
real Saleor compose stack, install the app, run a checkout
through the API, assert the tax breakdown.

## 10. Open questions

- **GraphQL codegen**: Saleor recommends `graphql-codegen` for
  typed payloads. v0.1 — skip; hand-type the small slice we read.
  v0.2 — add codegen once payload shape is settled.
- **Multi-channel**: Saleor supports multiple "channels"
  (effectively storefronts) per instance. The connector engages
  per-channel based on the channel's `currency`. Each channel
  with `USD` + US default address gets OST routing. We don't
  expose channel filters in v0.1 (engine engages on every USD
  checkout); v0.2 adds opt-in / opt-out per channel.
- **Engine version pinning**: like Odoo, surface this on a
  settings page so merchants can see compatibility at a glance.
- **Saleor App Store submission**: deferred to v0.2. Their
  review cycle is similar to OCA's — weeks/months. Not blocking
  the alpha.
