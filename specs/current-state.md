# Current State — opensalestax-saleor

**Last updated:** 2026-05-13 (v1.0.0 release prep)
**Status:** **v0.1.0 alpha shipped; v1.0.0 release pending tag.**

## Where we are

- Public GitHub repo at https://github.com/ejosterberg/opensalestax-saleor
- v0.1.0 alpha implemented per `specs/handoff.md`'s 9-task list:
  manifest, register, two sync webhook handlers, two transformers,
  OST client, EnvAPL wiring, raw-Node HTTP server
- 55 unit tests + 1 live integration test against the OST engine,
  95% line coverage / 87% branch coverage
- ESLint + TypeScript strict mode (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`); 0 lint errors
- SonarQube clean at the v1.0 bar: 0 BLOCKER, 0 CRITICAL, security
  rating A, reliability rating A, 0 unreviewed hotspots
- OWASP A01-A10 manual review committed at
  `specs/security/audit-2026-05-13.md`
- `npm audit --omit=dev --audit-level=high` shows 0 vulnerabilities
- CI workflow at `.github/workflows/ci.yml` runs lint + typecheck
  + tests + audit on every push; consistently green on `main`
- Multi-stage Dockerfile (node:20-alpine, runs as non-root)
- docker-compose.yml validated on a fresh Debian 13 VM (saleor-demo,
  VMID 913, `10.32.161.172`) — clone → `docker compose up` → app
  manifest endpoint responds within ~6 minutes on a fresh host
- Live demo at http://10.32.161.172:3000 pointed at the shared OST
  engine; manifest + health endpoints verified working

## Where the upstream engine is

OpenSalesTax engine — shared dev instance at
`http://10.32.161.126:8080`, currently reporting v0.55.4 healthy.
The v1 HTTP API is the connector's contract surface:
`POST /v1/calculate`, `GET /v1/health`.

## Where the platform is

Saleor — **v3.20+** is the supported floor (Tax App framework GA
in 3.14, payload + JWKS stabilized at 3.20). The connector
subscribes to the sync webhooks `CHECKOUT_CALCULATE_TAXES` and
`ORDER_CALCULATE_TAXES`.

## What's shipped

### v0.1.0 — 2026-05-13 alpha

All nine handoff items landed:

1. ✅ Project bootstrap (package.json, tsconfig strict, Jest config, ESLint)
2. ✅ OST HTTP client (lifted from Medusa connector; added `healthCheck()`)
3. ✅ Saleor APL wiring (`EnvAPL`, single-tenant)
4. ✅ Manifest + register endpoints (delegated to `@saleor/app-sdk`)
5. ✅ Both sync webhook handlers + shared GraphQL subscription
6. ✅ Raw Node `http` server with a Web API adapter (no Next.js)
7. ✅ Unit + integration tests (51 → 55+2 after Stage 06 polish)
8. ✅ Dockerfile + docker-compose.yml + .dockerignore + .env.example
9. ✅ CHANGELOG entry + GitHub release pending v1.0.0 tag

### v1.0.0 — 2026-05-13 production release (pending tag)

Adds on top of v0.1.0:

- SonarQube static-analysis sweep with hotspot dispositions
- OWASP A01-A10 manual review captured in `specs/security/`
- Demo deployment validated on a fresh Proxmox VM (saleor-demo,
  VMID 913) — proves the docker-compose.yml is clone-and-run
- Minor TypeScript polish (codePointAt, optional chaining)

## What's planned (v1.1 candidates)

These were considered for v1.0 and deferred with documented
rationale:

- **Full Saleor integration demo** — pull saleor-platform docker
  stack on the demo VM, install the app via Saleor Dashboard,
  run a real `checkoutCreate` GraphQL mutation against a US
  channel, confirm tax surface. Deferred due to wall-clock cost
  of the full Saleor docker pull (~30-45 min) + brittle GraphQL
  setup; the engine path is already validated by the live
  integration test.
- **Saleor App Store submission** — Saleor's review cycle is
  weeks; not blocking v1.0.
- **GraphQL codegen** — typed payloads for the webhook subscription.
  Hand-typed in v1.0; codegen in v1.1 once payload shape stabilizes.
- **Postgres APL** — multi-tenant token storage. v1.0 uses EnvAPL
  (single-tenant), which is what merchant-self-hosted needs.
- **Settings UI** — currently env-var-only. v1.1 can add a small
  embedded settings page once the SDK's app-bridge story is settled.
- **Per-product tax category mapping** — currently every line gets
  `general`. v1.1 maps Saleor's tax classes to OST categories.
- **Per-state nexus filter** — opt-in/opt-out per US state.
- **ESM migration** — currently CommonJS for simpler Jest setup;
  ESM unlocks top-level await + modern Node module patterns.

## Spec-folder map

| File | Purpose |
|---|---|
| `specs/constitution.md` | Non-negotiable principles (license, architecture, USD-only) |
| `specs/current-state.md` | **This file** — snapshot for fresh sessions |
| `specs/handoff.md` | What the next session should pick up |
| `specs/demo-deployment.md` | Stage 05 — Proxmox VM, deferral rationale |
| `specs/research/saleor-tax-app.md` | Saleor's Tax App framework reference |
| `specs/security/audit-2026-05-13.md` | OWASP A01-A10 walkthrough + SonarQube dispositions |

## Sibling-project map

| Path | Stack | State |
|---|---|---|
| `opensalestax-Odoo/` | Planning hub | active |
| `opensalestax-python/` | Python SDK | shipped (PyPI) |
| `opensalestax-odoo-src/` | Odoo connector | v0.4.1 (PyPI) |
| `opensalestax-medusa/` | Medusa v2 plugin | shipped (NPM) |
| `opensalestax-woocommerce/` | WordPress plugin | shipped |
| `opensalestax-stripe-php/` | Stripe-PHP connector | shipped |
| `opensalestax-php/` | PHP SDK | shipped |
| **`opensalestax-saleor/`** | **Saleor Tax App** | **v1.0.0 release prep** |
