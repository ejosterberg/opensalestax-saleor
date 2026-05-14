# Changelog

All notable changes to this project are documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-05-13

### Added
- Initial alpha release of the OpenSalesTax connector for Saleor's
  Tax App framework.
- Sync webhook handlers for `CHECKOUT_CALCULATE_TAXES` and
  `ORDER_CALCULATE_TAXES`, routing tax calculation through the
  self-hosted OpenSalesTax engine's `POST /v1/calculate` endpoint.
- App manifest endpoint at `/api/manifest` declaring the
  `HANDLE_TAXES` permission and the two webhook subscriptions.
- App install endpoint at `/api/register` (delegated to
  `@saleor/app-sdk`'s built-in `createAppRegisterHandler`).
- USD-only / US-only gating per constitution §5: non-USD or non-US
  payloads return empty tax response so Saleor falls back to
  catalog rates.
- Fail-soft default per constitution §8: engine errors return
  empty tax + warn log. `OSTAX_FAIL_HARD=1` opts into fail-hard.
- ZIP5 / ZIP5+4 validation; transformer strips the +4.
- Shipping handling: shipping price > 0 appends a synthetic OST
  line with category `shipping`.
- Raw Node HTTP server (no Next.js / Express — Decision B).
- EnvAPL for single-tenant token storage.
- Dockerfile (multi-stage, runs as non-root `node` user) and
  example `docker-compose.yml` with bundled OST engine + Postgres.
- 51 tests (50 unit + 1 live-engine integration); 95% line
  coverage, 87% branch coverage.

### Security
- All webhook requests JWT-verified against Saleor's JWKS by the
  SDK (constitution §7 — never bypass).
- No customer addresses, line item descriptions, or full payloads
  in logs (negative-tested).
- Container runs as the unprivileged `node` user.

[Unreleased]: https://github.com/ejosterberg/opensalestax-saleor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ejosterberg/opensalestax-saleor/releases/tag/v0.1.0
