# Handoff — opensalestax-saleor

> **Read first if you're a fresh agent.** Constitution + current
> state + this file are the canonical bring-up sequence.

## You are here — 2026-05-10 (project scaffold)

The Saleor Tax App is **pre-alpha** — specs are written; no
TypeScript yet. Eric confirmed two architecture decisions on
2026-05-10:

- **Decision B**: raw Node HTTP server + `@saleor/app-sdk`. No
  Next.js, no React. Container target ~50 MB.
- **Decision X**: merchant-self-hosted. Docker + docker-compose.
  No SaaS tier in v0.x.

## What's next — implement v0.1.0 alpha

The order below is the order to do it in. Each task fits a single
focused work block (15–60 min).

### 1. Project bootstrap

- [ ] `npm init -y` then edit `package.json`:
  - `name`: `@ejosterberg/saleor-app-opensalestax`
  - `version`: `0.1.0`
  - `license`: `Apache-2.0`
  - `engines.node`: `>=20`
  - Dependencies (research-validated names):
    - `@saleor/app-sdk` — latest 1.x (≥1.x, <2.x)
    - `jose` — JWT verification (already a peer of app-sdk; pin
      same major)
  - DevDependencies: `typescript`, `tsx`, `jest`, `@types/jest`,
    `@types/node`, `ts-jest`
- [ ] `tsconfig.json` — target `ES2022`, module `Node16`, strict
- [ ] `jest.config.js` — ts-jest preset, `testMatch:
  ["**/tests/**/*.test.ts"]`
- [ ] `.gitignore`, `.editorconfig`
- [ ] `LICENSE` (Apache-2.0 text), SPDX headers on all source
  files
- [ ] `CONTRIBUTING.md` — DCO sign-off mandatory, no AI co-author
  trailers, branch model (single-branch, semver tags)
- [ ] `SECURITY.md` — vulnerability reporting

### 2. OST HTTP client

- [ ] Copy `opensalestax-medusa/src/providers/opensalestax/client.ts`
  → `opensalestax-saleor/src/lib/ostax-client.ts`. The client is
  small (~130 lines), uses global `fetch`, and is platform-agnostic
  — minimal porting needed. Just update the SPDX header and any
  Medusa-specific type imports.
- [ ] Add a small `healthCheck()` method (the Medusa version
  doesn't have one; the Saleor app's startup probe needs it).
- [ ] Unit test the client against `nock` or a Node fetch mock.

### 3. Saleor app wiring

- [ ] `src/lib/saleor-app.ts`: instantiate `SaleorApp` from
  `@saleor/app-sdk`. Configure `EnvAPL` for v0.1
  (single-tenant). Read `OSTAX_ENGINE_URL`, `OSTAX_API_KEY`,
  `SALEOR_APP_TOKEN`, `SALEOR_API_URL` from `process.env`.
- [ ] `src/lib/config.ts` — typed env-var loader with
  validation. Fail-fast on missing required vars at boot.

### 4. App manifest + install endpoints

- [ ] `src/handlers/manifest.ts` — serves
  `/api/manifest` per the spec in `research/saleor-tax-app.md`
  §7. Declares the two webhook subscriptions.
- [ ] `src/handlers/register.ts` — handles
  `/api/register` (Saleor's install POST). Uses app-sdk's
  built-in `createAppRegisterHandler`.

### 5. Tax webhook handlers

- [ ] `src/transformers/saleor-to-ost.ts`:
  - Gate: `currency === "USD"`, `address.country.code === "US"`,
    `address.postalCode` matches `^\d{5}(-\d{4})?$`.
  - Map: each Saleor line → OST `LineItem` (amount = totalPrice,
    category = "general" for v0.1).
  - Shipping: append one extra OST line with the shipping price
    and category "shipping" (or "general" if engine doesn't yet
    support a shipping category).
- [ ] `src/transformers/ost-to-saleor.ts`:
  - Build per-line `{total_net_amount, total_gross_amount,
    tax_rate}` from OST's response.
  - Net = OST line's pre-tax amount; gross = net + tax; rate =
    tax / net (decimal, not percent).
  - Shipping rolled up the same way.
- [ ] `src/handlers/checkout-calculate-taxes.ts` and
  `src/handlers/order-calculate-taxes.ts`: use app-sdk's
  `createSyncWebhookHandler`. JWT verification handled by the
  SDK. Each handler: gate → transform → engine call → transform
  → respond.

### 6. Server entrypoint

- [ ] `src/server.ts`: minimal Node `http` server (or `fastify`
  if we want better routing — adds ~100 KB to the container).
  Listens on `process.env.PORT || 3000`. Wires the four routes
  above. Boot-time `console.log` of the OST engine URL +
  Saleor API URL for ops visibility.

### 7. Tests

- [ ] Unit tests for both transformers (USD/non-USD gate, US/non-US
  gate, ZIP regex, shipping handling, rate-decimal math).
- [ ] Unit test for the OST client.
- [ ] Integration test: boot the server with a mocked Saleor
  signing key + a real OST engine container. Send a synthetic
  webhook POST. Assert the response shape.
- [ ] Target ≥10 tests at v0.1.0 ship time.

### 8. Packaging

- [ ] `Dockerfile`: multi-stage (build → slim runtime). Final
  image based on `node:20-alpine`. Target ≤50 MB.
- [ ] `docker-compose.yml`: this app + an OST engine + the
  Saleor backend stack from
  <https://github.com/saleor/saleor-platform>. Wire ports so
  Saleor can reach the Tax App at
  `http://opensalestax:3000/api/manifest`.
- [ ] Document the install flow in `README.md`: docker-compose
  up, open Saleor dashboard, Apps → Install from URL, paste
  manifest URL, confirm. Screenshots optional for v0.1.

### 9. Release

- [ ] `CHANGELOG.md` v0.1.0 entry
- [ ] Tag `v0.1.0`, push to GitHub
- [ ] Publish to NPM as `@ejosterberg/saleor-app-opensalestax`
  (if Eric wants NPM distribution — could also ship Docker-only).

## What's deferred to v0.2

- Settings UI (currently env-vars-only)
- Per-product tax category mapping
- Per-state nexus filter
- Operator telemetry (failure streak, mail.activity-equivalent
  alerts — Saleor doesn't have mail.activity; webhook to
  email/Slack instead)
- Saleor App Store submission
- GraphQL codegen for typed payloads
- Multi-tenant Postgres APL

## Standing rules

- Apache-2.0; DCO sign-off mandatory; no AI co-author trailers
- Constitution §5: USD-only; non-US / non-USD = empty tax
  response (let Saleor fall back)
- Constitution §8: fail-soft default; fail-hard opt-in via env
- Constitution §7: JWT verification mandatory — never trust
  webhook source IP

## Pre-flight for the next session

1. Read `specs/constitution.md`
2. Read `specs/current-state.md`
3. Read `specs/research/saleor-tax-app.md`
4. Skim recent commits (`git log --oneline -10`)
5. Start at task 1 above

When the alpha ships, log it in `current-state.md` and replace
this handoff with the v0.2 starting list.
