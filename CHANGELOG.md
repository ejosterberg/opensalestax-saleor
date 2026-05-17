# Changelog

All notable changes to this project are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

## [1.1.1] - 2026-05-17

### Changed

- **Dual-licensed Apache-2.0 OR GPL-2.0-or-later.** Adds GPL-2.0-or-later as
  an alternative license alongside the existing Apache-2.0 grant, enabling
  downstream redistribution in GPL-only ecosystems (WordPress.org plugin
  directory, OCA AGPL-track repositories) without giving up Apache
  compatibility. License files reorganized: `LICENSE-APACHE.txt` (existing
  Apache text, moved from `LICENSE`), `LICENSE-GPL.txt` (new, GNU GPL v2
  text), `LICENSE` (new dual-declaration). SPDX headers updated across
  source files. Brings this connector in line with the rest of the
  OpenSalesTax portfolio's dual-licensing standard.

  (Note: `.github/dependabot.yml` already shipped in v1.0.4 — no change
  to the supply-chain hygiene config in this release.)

## [1.1.0] - 2026-05-14

First minor since v1.0. Adds a second supported install channel
(prebuilt Docker image) and keeps the existing NPM publish path
unchanged.

### Added
- **Prebuilt multi-arch Docker images on GHCR.** New
  `.github/workflows/docker-publish.yml` builds and pushes
  `ghcr.io/ejosterberg/opensalestax-saleor:<version>` on every
  `v*` tag. Images are multi-arch (`linux/amd64`,
  `linux/arm64`) and carry SLSA provenance + SBOM attestations
  identical to the NPM publishing pipeline.
- Per-release Docker tags published: exact version (`1.1.0`),
  minor track (`1.1`), major track (`1`), and `latest`.

### Changed
- `docker-compose.yml` defaults to pulling the prebuilt
  `ghcr.io/...:latest` image rather than building from source.
  Drops typical first-boot time from ~3 minutes to ~30 seconds
  on a fresh Docker host. Merchants who prefer to audit + build
  locally swap the `image:` line for `build: .` (documented
  inline).
- README quickstart documents both install paths and the
  provenance/SBOM verification story.

## [1.0.4] - 2026-05-14

Quality + maintenance. No runtime behavior changes.

### Added
- **CI matrix over Node 20 / 22 / 24.** Until now CI only ran on
  the floor (`engines.node` = 20). The matrix now validates the
  whole supported range and the runner used by the release
  pipeline, catching forward-compat regressions if a dep
  silently drops Node 20 support.
- **Dependabot configuration.** Weekly auto-PRs for npm + GitHub
  Actions updates. Dev-dependency patch/minor bumps are grouped
  into a single PR to cut churn; major bumps surface individually
  for explicit review.
- **`CONTRIBUTING.md` — "Cutting a release" section.** Documents
  the new tag-and-push Trusted Publishing flow + how consumers
  can verify provenance via `npm audit signatures`.

## [1.0.3] - 2026-05-14

Trusted Publishing pipeline now works end-to-end. No runtime
behavior changes; pure release-plumbing fix.

### Changed
- Bump release-workflow runner Node version from 22 to 24 LTS.
  Diagnosed via `npm publish --loglevel verbose` (per NPM
  support's debugging guidance): Node 22.22.2 ships npm 10.9.7,
  but NPM Trusted Publishing requires npm ≥ 11.5 for the OIDC
  auth handshake (npm 10.x can sign provenance attestations but
  can't authenticate the publish itself via OIDC, falling back to
  no-auth which NPM rejects as E404). Node 24 LTS ships npm 11.x
  natively, sidestepping the in-place `npm install -g npm@latest`
  step that self-corrupts on the runner.
- Release workflow now binds to the `npm-publish` GitHub
  Environment, matching the NPM Trusted Publisher's
  Environment field. Adds a runtime-env diagnostic block before
  publish for future support visibility.

### Note
v1.0.3 is the first release published via Trusted Publishing
(OIDC); v1.0.0 through v1.0.2 were published from a local
terminal or via granular token. v1.0.3's NPM artifact will be
the first to carry a provenance attestation tying it
cryptographically to this exact commit + workflow run.

## [1.0.2] - 2026-05-13

Maintenance patch. No runtime behavior changes; pure dev-time
hygiene + CI plumbing.

### Changed
- Bump GitHub Actions to Node-24-compatible majors:
  `actions/checkout@v4 → @v6`, `actions/setup-node@v4 → @v6`,
  `actions/upload-artifact@v4 → @v7`. Removes the deprecation
  banner on every CI/release run.
- Migrate ESLint 8 → 9. Replaces `.eslintrc.cjs` with flat-config
  `eslint.config.js`; swaps separate `@typescript-eslint/*`
  packages for the unified `typescript-eslint` meta-package.
  `npm ci` deprecation-warning count drops from 6 to 2 (the
  remaining two come from Jest 29 internals; queued for v1.1).

### Added
- `prepublishOnly` npm script — runs `npm run build` before any
  `npm publish`. Closes the empty-`dist/` footgun.

## [1.0.1] - 2026-05-13

Housekeeping cut — same runtime code as v1.0.0, plus the
release-pipeline polish that landed after v1.0.0 shipped.

### Added
- NPM publication via GitHub Actions Trusted Publishing (OIDC).
  `.github/workflows/release.yml` triggers on `vX.Y.Z` tag push,
  re-runs the quality gate, builds, and publishes with
  `--provenance` attestation. No long-lived NPM tokens anywhere.
- README badges (NPM version, CI status, license)
- README "Installing as a library" section pointing at the NPM
  package for programmatic consumers

### Changed
- `specs/handoff.md` reorganized: NPM-publish task dropped from
  Tier 1 (resolved at v1.0.0); ESLint 8 → 9 migration added at
  Tier 2 (deprecation warnings during `npm ci`, not security-
  sensitive but worth doing before plugins drop ESLint 8 support)
- `specs/decisions/001-npm-publish-deferred.md` marked Resolved

### Security
- Trusted Publishing replaces any need for a long-lived NPM
  token. Future releases will never write an NPM credential to
  disk or to a repo secret.

## [1.0.0] - 2026-05-13

First production release. Same code surface as v0.1.0 plus
hardening: SonarQube + OWASP audit clean, demo deployment
validated, minor TypeScript polish (`codePointAt`, optional
chaining).

### Added
- SonarQube scan baseline: 0 BLOCKER, 0 CRITICAL, security
  rating A (1.0), reliability A (1.0), 0 unreviewed hotspots
- OWASP A01-A10 manual review committed at
  `specs/security/audit-2026-05-13.md`
- Demo deployment on a fresh Proxmox VM (VMID 913,
  `10.32.161.172`); `docker compose up` boots the app against the
  shared OST engine in ~6 minutes from a clone
- `specs/demo-deployment.md` records the VM details + the items
  deferred to v1.1 (full Saleor docker stack install, real
  checkoutCreate GraphQL mutation)

### Changed
- `src/lib/url.ts:stripTrailingSlashes` switches from
  `String#charCodeAt` to `String#codePointAt` to match the
  TypeScript style guide preference
- `src/transformers/saleor-to-ost.ts` collapses the ZIP regex
  match check into an optional-chain expression
- docker-compose: app service now defaults to `build: .` so a
  fresh clone runs without pulling a registry image; the
  pre-built GHCR pull is documented as an opt-in for v1.1

### Security
- SonarQube clean (0 BLOCKER / 0 CRITICAL / security rating A)
- OWASP A01-A10 walked; no findings
- `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities
- Three SonarQube hotspots (typescript:S5852, regex backtracking
  on trailing-slash strip) dispositioned by lifting the operation
  into a non-regex helper (`stripTrailingSlashes`). The regex was
  mathematically O(n) safe; refactor was a clean-code preference

## [0.1.0] - 2026-05-13

### Added
- Initial alpha release of the OpenSalesTax connector for Saleor's
  Tax App framework
- Sync webhook handlers for `CHECKOUT_CALCULATE_TAXES` and
  `ORDER_CALCULATE_TAXES`, routing tax calculation through the
  self-hosted OpenSalesTax engine's `POST /v1/calculate` endpoint
- App manifest endpoint at `/api/manifest` declaring the
  `HANDLE_TAXES` permission and the two webhook subscriptions
- App install endpoint at `/api/register` (delegated to
  `@saleor/app-sdk`'s built-in `createAppRegisterHandler`)
- USD-only / US-only gating per constitution §5: non-USD or non-US
  payloads return empty tax response so Saleor falls back to
  catalog rates
- Fail-soft default per constitution §8: engine errors return
  empty tax + warn log. `OSTAX_FAIL_HARD=1` opts into fail-hard
- ZIP5 / ZIP5+4 validation; transformer strips the +4
- Shipping handling: shipping price > 0 appends a synthetic OST
  line with category `shipping`
- Raw Node HTTP server (no Next.js / Express — Decision B)
- EnvAPL for single-tenant token storage
- Dockerfile (multi-stage, runs as non-root `node` user) and
  example `docker-compose.yml` with bundled OST engine + Postgres
- 51 tests (50 unit + 1 live-engine integration); 95% line
  coverage, 87% branch coverage

### Security
- All webhook requests JWT-verified against Saleor's JWKS by the
  SDK (constitution §7 — never bypass)
- No customer addresses, line item descriptions, or full payloads
  in logs (negative-tested)
- Container runs as the unprivileged `node` user

[Unreleased]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.0.4...v1.1.0
[1.0.4]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ejosterberg/opensalestax-saleor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ejosterberg/opensalestax-saleor/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ejosterberg/opensalestax-saleor/releases/tag/v0.1.0
