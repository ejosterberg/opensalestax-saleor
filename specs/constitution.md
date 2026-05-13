# Constitution — opensalestax-saleor

> Non-negotiable principles. Read before writing code; flag conflicts
> explicitly before deviating.

## §1. Mission

Ship a free, self-hostable **Saleor Tax App** that routes Saleor's
`CHECKOUT_CALCULATE_TAXES` and `ORDER_CALCULATE_TAXES` webhooks
through an OpenSalesTax engine instance for destination-based US
sales tax. Same merchant value proposition as the WooCommerce /
Medusa / Odoo connectors: no per-transaction fees, no SaaS lock-in,
merchant runs both Saleor and OST on their own infrastructure.

## §2. Architecture (locked 2026-05-10)

**B + X:**

- **B.** Raw Node HTTP server + `@saleor/app-sdk` (no Next.js, no
  React). The app has no UI; pulling in Next.js for two webhook
  endpoints + the install flow is wasted bytes. `@saleor/app-sdk`
  still handles JWT verification, app-token storage, and the
  Saleor app-installation protocol.
- **X.** Merchant-self-hosted. Distributed as a Docker container +
  `docker-compose.yml`. Merchant points their Saleor instance at
  the container's manifest URL and runs the install flow. No
  hosted SaaS option in v0.x. (If a SaaS tier is ever added, it's
  a separate fork or sibling project — this repo stays
  self-host-only.)

## §3. License

Apache-2.0. Matches the engine, the Python SDK, and the Medusa
connector. (The Odoo connector is LGPL/AGPL dual because OCA
requires AGPL; Saleor has no such constraint, so we keep Apache 2.0
for maximum reuse.)

DCO sign-off mandatory on every commit. No AI co-author trailers.

## §4. Engine-call contract

The OST engine HTTP API (v1) is the source of truth. The Saleor
connector calls:

- `POST /v1/calculate` — per-line tax calculation, destination ZIP
- `GET /v1/health` — for Test Connection / startup probe

The connector NEVER imports OST internals or relies on
undocumented engine behavior. The HTTP API is the contract; we
pin the engine `v1` API in our README's compatibility matrix.

## §5. USD-only

The OST engine is US-only and USD-only by design (engine
constitution §5). When Saleor sends a non-USD checkout or a
non-US destination, the Tax App returns an **empty** tax response
(zero lines) so Saleor falls back to its own catalog rates. This
is opt-out behavior — merchants who want US-only checkouts use
Saleor's standard country filter.

## §6. Calculation only

Never file returns, never remit collected tax, never validate
addresses. The connector computes tax; the merchant remits.
Every README, settings page, and webhook-response disclaimer
carries this statement.

## §7. JWT verification

Saleor signs every webhook with its app's JWKS. The connector
MUST verify the signature before processing the payload. No
"trust the source IP" shortcuts; no "skip verification in dev"
flags. `@saleor/app-sdk` handles this; if we ever swap it out
(see §2 option C), the replacement must enforce the same
guarantee.

## §8. Fail-soft policy

When the OST engine is unreachable or returns 5xx, the connector
returns an empty tax response (zero lines) and logs a warning.
Saleor then falls back to its own catalog rates. Merchants can
opt into **fail-hard** behavior (return a webhook error, blocking
the checkout) via an environment variable. Default is fail-soft.

## §9. Test environment

`docker compose up` brings the whole stack (Saleor + engine +
this Tax App) up locally for integration testing. Unit tests
mock the OST client; integration tests use real engine calls
against a local OST container.

## §10. Out of scope

Per the engine + project constitutions:

- Tax filing / remittance
- Address validation / autocomplete
- Non-USD currency
- Non-US jurisdictions
- Tax-exempt customer certificate validation against state DOR
- Marketplace facilitator handling (NJ / CA seller-of-record
  edge cases)
- Modifying upstream Saleor source
