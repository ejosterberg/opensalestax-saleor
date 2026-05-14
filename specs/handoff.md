# Handoff — opensalestax-saleor

> **Read first if you're a fresh agent.** Constitution + current
> state + this file are the canonical bring-up sequence.

## You are here — 2026-05-13 (post-v1.0)

v1.0.0 shipped. The connector is production-ready by the
acceptance bar in `kickoff/success-criteria.md`:

- GitHub release v1.0.0 published
- CI green on `main` HEAD
- SonarQube clean (0 BLOCKER / 0 CRITICAL / A security / 0 hotspots)
- 55 tests + 2 live integration tests; 95% line coverage
- OWASP A01-A10 manual review committed
- Live demo deployment at http://10.32.161.172:3000 (VMID 913)
- README walks merchant from clone to live checkout in ≤10 min

For the deeper "where we are" snapshot read
`specs/current-state.md`.

## What's next — v1.1 candidates

The order below is a recommendation; the order isn't load-bearing
once v1.0 is shipped. Pick whichever interests you next.

### Tier 1 — likely shipped first

1. **Full Saleor integration demo on the VM.** Stage 05 in the
   v1.0 kickoff stopped short of pulling the full saleor-platform
   docker stack. Pick that back up: pull
   <https://github.com/saleor/saleor-platform>, boot it on the
   demo VM, install our app, run a real `checkoutCreate` mutation
   against a US ship-to address, confirm tax surfaces. This closes
   success-criteria.md D2/D5/D6.

2. **GraphQL codegen for the webhook payloads.** Replace the
   hand-typed `TaxesCalculationPayload` interface with one
   generated from Saleor's schema via `graphql-codegen`. Adds
   `@graphql-codegen/cli` + `@graphql-codegen/typescript` as dev
   deps; a single `npm run codegen` regenerates against the
   committed schema. Catches schema drift in CI.

3. **GHCR image publication.** Build + push tagged Docker images
   to `ghcr.io/ejosterberg/opensalestax-saleor:vX.Y.Z` so the
   docker-compose can pull pre-built instead of building from
   source. Adds a `release.yml` workflow gated on tag push.

### Tier 2 — when there's user demand

4. **Per-product tax category mapping.** v1.0 sends every line as
   category `general`. Map Saleor's tax classes to the OST
   engine's six categories. Same shape as WooCom v0.3.3 and
   Odoo v0.1.13.

5. **Per-state nexus filter.** Merchant configures a list of US
   states they have nexus in; checkouts to other states return
   empty tax. Matches Odoo v0.3.0.

6. **Postgres APL** — multi-tenant token storage. Required if
   anyone ever hosts this as a SaaS (Decision Y), unnecessary for
   self-host. Lower priority than features that benefit the
   merchant directly.

### Tier 3 — long-running / external

7. **Saleor App Store submission.** Submit to Saleor's official
   app directory. Their review cycle is weeks; the connector
   should accumulate some real-world deployments first.

8. **ESM migration.** Move package.json to `"type": "module"`,
   adjust tsconfig + Jest ESM config, switch promise chains to
   top-level await. SonarQube has been nudging this with one
   MAJOR code smell since v0.1.0.

9. **Settings UI.** Embedded app page where merchants configure
   OST engine URL, fail-hard toggle, etc. — without touching env
   vars. Needs `@saleor/app-sdk`'s `app-bridge` story to mature.

## Standing rules

- Apache-2.0; DCO sign-off mandatory; no AI co-author trailers
- Constitution §5: USD-only; non-US / non-USD → empty tax response
- Constitution §7: JWT verification mandatory; never bypass
- Constitution §8: fail-soft default; fail-hard opt-in via env
- Semver tags on a single `main` branch; squash-merge from PRs

## Pre-flight for the next session

1. Read `specs/constitution.md`
2. Read `specs/current-state.md`
3. Read `specs/research/saleor-tax-app.md`
4. Skim recent commits and the most-recent
   `specs/security/audit-YYYY-MM-DD.md`
5. Pick a Tier 1 item above and write a phase-NN-<slug>/ spec
   before writing code

When v1.1 ships, log it in `current-state.md` and update this
handoff for v1.2 candidates.
