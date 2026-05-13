# CLAUDE.md — opensalestax-saleor

> Project memory for Claude sessions on the Saleor Tax App
> connector. Read this AND `specs/constitution.md` +
> `specs/handoff.md` before writing code.

## Mission

Ship a free, self-hostable Saleor Tax App routing
`CHECKOUT_CALCULATE_TAXES` + `ORDER_CALCULATE_TAXES` webhooks
through an OpenSalesTax engine for destination-based US sales
tax. Same value prop as the other OST connectors.

## Stack

- **Language:** TypeScript (Node 20+)
- **Framework:** Raw Node HTTP server + `@saleor/app-sdk`
  (Decision B, locked 2026-05-10 — no Next.js, no React)
- **Distribution:** Docker / docker-compose; merchant
  self-hosted (Decision X)
- **License:** Apache-2.0
- **Tests:** Jest + ts-jest

## Architectural anchors

- **JWT verification is mandatory** on every webhook
  (constitution §7). Never bypass.
- **USD-only / US-only**: non-USD or non-US payloads get an
  empty tax response (constitution §5). Saleor falls back to
  its own catalog rates.
- **Fail-soft default**: engine errors return empty taxes +
  log a warning. `OSTAX_FAIL_HARD=1` env var opts into
  fail-hard (return webhook error, blocks checkout).
- **Calculation only**: no filing, no remittance, no address
  validation (constitution §6, §10).

## File layout (planned)

```
opensalestax-saleor/
├── CLAUDE.md             # this file
├── README.md             # user-facing
├── LICENSE               # Apache-2.0
├── CONTRIBUTING.md       # DCO sign-off mandatory
├── SECURITY.md
├── CHANGELOG.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── Dockerfile
├── docker-compose.yml
├── specs/
│   ├── constitution.md
│   ├── current-state.md
│   ├── handoff.md
│   ├── research/saleor-tax-app.md
│   └── phase-01-alpha/{spec,plan,tasks}.md
├── src/
│   ├── server.ts                          # HTTP entrypoint
│   ├── lib/
│   │   ├── ostax-client.ts                # lifted from medusa
│   │   ├── saleor-app.ts                  # @saleor/app-sdk wiring
│   │   └── config.ts                      # env-var loader
│   ├── handlers/
│   │   ├── manifest.ts                    # /api/manifest
│   │   ├── register.ts                    # /api/register
│   │   ├── checkout-calculate-taxes.ts    # sync webhook
│   │   └── order-calculate-taxes.ts       # sync webhook
│   └── transformers/
│       ├── saleor-to-ost.ts               # payload → OST request
│       └── ost-to-saleor.ts               # OST response → Saleor
└── tests/
    ├── unit/
    │   ├── saleor-to-ost.test.ts
    │   ├── ost-to-saleor.test.ts
    │   └── ostax-client.test.ts
    └── integration/
        └── webhook.test.ts
```

## What NOT to do

- Don't import Next.js / React. Architecture B locked it out.
- Don't bypass JWT verification (§7). Even "for local dev."
- Don't ship a copy of the OST engine — point at the merchant's
  instance via env var.
- Don't add an SDK dependency on a private npm registry — keep
  every dep public.
- Don't accept commits without DCO sign-off (`-s` flag).
- Don't ship UI in v0.1. Settings live in env vars.

## Releasing

- Semver tags `vX.Y.Z` on the single `main` branch (no
  branch-per-major like Odoo; Saleor stays mostly compatible
  across minor versions).
- GitHub release on each tag.
- Publish to NPM as `@ejosterberg/saleor-app-opensalestax` if
  Eric wants NPM distribution; otherwise Docker-only.

## Sibling-project map

See `specs/current-state.md` "Sibling-project map" section.
