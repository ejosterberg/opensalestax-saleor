# Current State — opensalestax-saleor

**Last updated:** 2026-05-10 (project scaffolded)
**Status:** **Pre-alpha — specs scaffolded; no code yet.** Eric
confirmed architecture (raw Node + @saleor/app-sdk, merchant
self-hosted). Next step: scaffold `package.json` + source layout,
then implement v0.1.0 alpha (handler for one webhook event, real
engine call, integration smoke test).

## Where the upstream engine is

OpenSalesTax engine — same instance the other connectors point at.
Pin in production: **v0.22+** (pre-v0.22 had the SD-state-bleed
bug, closed in v0.22.0). Tested-against version pinned per release.
v1 HTTP API: `POST /v1/calculate`, `GET /v1/health`,
`GET /v1/states`, `GET /v1/rates`.

## Where the platform is

Saleor — **v3.20+** is the supported floor. Saleor's Tax App
framework went GA in 3.14 but the JWKS rotation + v2 webhook
payload shape stabilized at 3.20.

Tax App webhooks the connector handles:

- `CHECKOUT_CALCULATE_TAXES` — sync; called when a checkout is
  finalized, gets the per-line tax breakdown response.
- `ORDER_CALCULATE_TAXES` — sync; called on order create + every
  line edit on an unfinalized order.

Both are SYNC webhooks (Saleor blocks the checkout/order until we
respond). Saleor's docs cap the response time at 20s — we target
≤2s with the OST engine's typical ~50-200 ms RTT.

## What's shipped

(Nothing yet — this is the project's first session.)

## What's planned (in order)

### v0.1.0 alpha (this session or next)

- `package.json` with `@saleor/app-sdk` + `@saleor/app-sdk/handlers/next`
  (the SDK ships sub-paths for Express + raw Node; pick raw Node
  per Decision B)
- `src/lib/ostax-client.ts` — minimal HTTP client lifted from the
  Medusa connector's `client.ts` (~130 lines)
- `src/lib/saleor-app.ts` — `@saleor/app-sdk` SaleorApp wiring +
  auth-token storage adapter (Postgres or in-memory for v0.1)
- `src/handlers/manifest.ts` — Saleor app manifest at
  `/api/manifest` (declares the two webhook event types + the
  app's permissions)
- `src/handlers/register.ts` — Saleor app installation endpoint at
  `/api/register`
- `src/handlers/checkout-calculate-taxes.ts` — sync webhook
  handler; transforms Saleor checkout → OST request, calls
  engine, transforms response → Saleor tax response
- `src/handlers/order-calculate-taxes.ts` — same shape, different
  payload
- `src/transformers/saleor-to-ost.ts` — payload conversion
- `src/transformers/ost-to-saleor.ts` — response conversion
- `Dockerfile` + `docker-compose.yml`
- `tests/unit/*.test.ts` — Jest unit tests for transformers + the
  engine-call gate logic
- `tests/integration/*.test.ts` — boot the app against a mocked
  Saleor signing key + real OST engine
- `README.md` with install + Test Connection walkthrough
- Apache-2.0 LICENSE + SPDX headers + CONTRIBUTING.md (DCO)

### v0.2 polish queue (after v0.1 alpha ships)

- Saleor App Store submission (their review process + listing)
- Tax category mapping (Saleor's tax classes → OST's six
  categories — same shape as the WooCom v0.3.3 / Odoo v0.1.13
  pattern)
- Per-state nexus filter (matches Odoo v0.3.0)
- Operator telemetry — last successful calc, failure streak,
  threshold-crossing webhook (Saleor App webhook events for
  admin alerts, or a separate notification channel)
- Exemption-certificate handling

## Spec-folder map

| File | Purpose |
|---|---|
| `specs/constitution.md` | Non-negotiable principles (license, architecture, USD-only) |
| `specs/current-state.md` | This file — snapshot for fresh sessions |
| `specs/handoff.md` | What the next session should pick up |
| `specs/research/saleor-tax-app.md` | Saleor's Tax App framework — webhook shapes, JWT, response payload |
| `specs/phase-01-alpha/spec.md` | v0.1.0 user stories + functional requirements |
| `specs/phase-01-alpha/plan.md` | Implementation plan — file layout, dependencies, test strategy |
| `specs/phase-01-alpha/tasks.md` | Atomic, ordered task list |

(The `phase-01-alpha/` directory is created when the design is
locked. As of 2026-05-10 it's not yet populated — that's the next
session's first job.)

## Sibling-project map

| Path | Stack | State |
|---|---|---|
| `opensalestax-Odoo/` | Planning hub | active (drives all connector projects) |
| `opensalestax-python/` | Python SDK | shipped to PyPI |
| `opensalestax-odoo-src/` | Odoo connector | v0.4.1 shipped on PyPI; OCA PR queued |
| `opensalestax-medusa/` | Medusa v2 plugin | shipped; NPM `@ejosterberg/medusa-plugin-opensalestax` |
| `opensalestax-woocommerce/` | WordPress plugin | shipped |
| `opensalestax-stripe-php/` | Stripe-PHP connector | shipped, private repo pending Packagist flip |
| `opensalestax-php/` | PHP SDK | shipped, private repo pending Packagist flip |
| `opensalestax-saleor/` | **THIS** — Saleor Tax App | pre-alpha, specs only |
