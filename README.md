# opensalestax-saleor

> **Saleor Tax App connector** — destination-based US sales tax via
> the self-hosted [OpenSalesTax](https://github.com/ejosterberg/opensalestax) engine.
> No per-transaction fees. No SaaS lock-in. Apache-2.0.

## What this is

A [Saleor Tax App](https://docs.saleor.io/developer/app-store/getting-started/tax-app)
that routes Saleor's `CHECKOUT_CALCULATE_TAXES` and
`ORDER_CALCULATE_TAXES` webhooks through your own OpenSalesTax
engine and returns the destination-based US tax breakdown back to
Saleor.

You run both the Saleor Tax App and the OpenSalesTax engine on
your own infrastructure. Saleor calls the app over HTTPS; the app
calls the engine over your private network.

## Quickstart (≤10 minutes)

### Prerequisites
- A running Saleor instance, **v3.20 or later**, with the
  [Tax App framework](https://docs.saleor.io/developer/app-store/getting-started/tax-app)
- Docker + Docker Compose
- A network path from Saleor → this app (HTTPS in production)

### Steps

1. **Clone and configure**
   ```bash
   git clone https://github.com/ejosterberg/opensalestax-saleor.git
   cd opensalestax-saleor
   cp .env.example .env
   # Edit .env: set APP_API_BASE_URL to the public URL Saleor will reach
   ```

2. **Boot the stack**
   ```bash
   docker compose up -d
   ```
   Three containers start: the Saleor Tax App, the OpenSalesTax engine, and a Postgres for the engine.

3. **Verify the app is healthy**
   ```bash
   curl http://localhost:3000/health
   # → {"ok": true, "version": "...", "rtt_ms": ...}

   curl http://localhost:3000/api/manifest | jq .name
   # → "OpenSalesTax"
   ```

4. **Install into Saleor**
   In the Saleor Dashboard → **Apps → Install external app**, paste
   `${APP_API_BASE_URL}/api/manifest`. Review the requested
   permission (`HANDLE_TAXES`) and confirm.

5. **Capture the APL token**
   The app's stdout (`docker compose logs opensalestax`) prints
   the `SALEOR_API_URL`, `SALEOR_APP_ID`, and `SALEOR_APP_TOKEN`
   Saleor delivered. Copy those into `.env`, then `docker compose
   up -d` to make them survive restarts.

6. **Set the app as your channel's tax provider**
   In the Saleor Dashboard, go to your USD channel →
   **Configuration → Taxes**, set **Tax calculation strategy** to
   `TAX_APP`, and pick **OpenSalesTax** as the tax app.

7. **Run a test checkout**
   Create a checkout against a US ship-to address with a non-zero
   shipping cost. Saleor calls the app, the app calls the engine,
   and the response carries per-line + per-jurisdiction tax.

That's it.

## How it works

```
┌────────────┐   POST /api/webhooks/...   ┌──────────────────────┐
│   Saleor   │ ─────────────────────────► │  opensalestax-saleor │
│  (v3.20+)  │                            │   (this Tax App)     │
└──────┬─────┘                            └────────────┬─────────┘
       │      tax response (JSON)                      │
       │  ◄────────────────────────────────────────────│
       │                                               │ POST /v1/calculate
       │                                               ▼
       │                            ┌─────────────────────────────┐
       │                            │   OpenSalesTax engine       │
       │                            │   (your self-hosted copy)   │
       │                            └─────────────────────────────┘
```

For each `CHECKOUT_CALCULATE_TAXES` or `ORDER_CALCULATE_TAXES`
event, the app:
1. Verifies the Saleor JWT (delegated to `@saleor/app-sdk`)
2. Gates: requires `currency=USD`, `country=US`, valid ZIP. If
   any gate fails, returns an empty response so Saleor falls back
   to its catalog rates.
3. Transforms the Saleor payload into the OST engine's
   `POST /v1/calculate` request.
4. Calls the engine; on success transforms the response into
   Saleor's expected per-line tax breakdown.
5. On engine error (fail-soft, default): returns empty + logs a
   warning. Saleor falls back to its catalog rates and the
   checkout proceeds.

## Configuration

All configuration is via environment variables. See
[`.env.example`](.env.example) for the full list.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `APP_API_BASE_URL` | ✅ | — | Public URL Saleor will call. Must be http(s). |
| `OSTAX_API_URL`    | ✅ | — | OpenSalesTax engine base URL. |
| `PORT`             |    | `3000` | HTTP port the app listens on. |
| `OSTAX_API_KEY`    |    | — | Sent as `X-API-Key` if set. |
| `OSTAX_TIMEOUT_MS` |    | `5000` | Per-engine-request timeout. |
| `OSTAX_FAIL_HARD`  |    | unset | `"1"` opts into fail-hard mode. |
| `SALEOR_API_URL`   |    | — | APL seed (written by install). |
| `SALEOR_APP_ID`    |    | — | APL seed. |
| `SALEOR_APP_TOKEN` |    | — | APL seed. Treat as a secret. |

## What it does NOT do

- ❌ File tax returns
- ❌ Remit collected tax
- ❌ Validate addresses (call USPS / Smarty separately)
- ❌ Non-USD currency or non-US destinations (returns empty
  response; Saleor falls back to catalog rates)
- ❌ Marketplace-facilitator handling for NJ / CA seller-of-record
  edge cases (manual)

This is a calculation connector. Filing and remittance stay with
the merchant.

## Troubleshooting

### Install fails — "could not reach manifest URL"
Saleor must be able to reach `APP_API_BASE_URL/api/manifest`
from its own network. If Saleor runs in Docker on the same
host, use the docker-compose service name or the host's LAN IP
— `localhost` won't resolve to your machine from inside Saleor's container.

### Checkout hangs, then proceeds with zero tax
The app's fail-soft default returns empty tax on engine errors.
Check `docker compose logs opensalestax` for `engine_error`
entries. Common causes:
- `OSTAX_API_URL` not reachable from inside the app's container
- OST engine database down or migrating
- Engine returned 5xx (see the engine's own logs)

To make this loud instead of silent, set `OSTAX_FAIL_HARD=1`.
Saleor will then surface the engine error to the checkout flow,
blocking the order until the engine recovers.

### "Signature verification failed" in app logs
The `SALEOR_APP_TOKEN` in your env doesn't match the token
Saleor stored on install. Re-install the app from the Saleor
Dashboard, capture the new token from app stdout, and update
`.env`.

### Tax returns zero for what should be a taxed US cart
- Confirm `currency` is `USD` and `address.country.code` is `US`
  on the checkout. The app intentionally returns empty for
  non-USD / non-US (see "What it does NOT do").
- Confirm `address.postalCode` matches `^\d{5}(-\d{4})?$`.
  `12345`, `12345-6789` accept; `K1A 0B1` rejects.
- Confirm the OST engine has rate data loaded for the destination
  state. The engine's own admin tells you what's missing.

## Compatibility

| Component | Tested with |
|---|---|
| Saleor | v3.20+ (GA Tax App framework) |
| OpenSalesTax engine | v0.55.4 (HTTP API v1) |
| Node | v20 LTS |

The OST engine HTTP API is pinned to **v1**; the engine maintains
backwards compatibility within v1. Cross-major engine bumps will
land in a new minor of this connector.

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm test             # 51 tests, ~12s
npm run check        # lint + typecheck + test + audit (the merge gate)
```

The app boots locally with `npm run dev`. Tests against the
in-tree OST engine container are gated on the `OSTAX_API_URL`
env var — set it to the engine URL to enable the live integration
test.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). DCO sign-off (`git
commit -s`) is required on every commit. No AI co-author trailers.

## License

Apache-2.0. See [LICENSE](LICENSE).

## Related projects

| Project | Stack | Status |
|---|---|---|
| [opensalestax](https://github.com/ejosterberg/opensalestax) | OST engine (Python) | shipped |
| [opensalestax-python](https://github.com/ejosterberg/opensalestax-python) | Python SDK | shipped (PyPI) |
| [opensalestax-medusa](https://github.com/ejosterberg/opensalestax-medusa) | Medusa v2 plugin | shipped (NPM) |
| [opensalestax-woocommerce](https://github.com/ejosterberg/opensalestax-woocommerce) | WordPress plugin | shipped |
| [opensalestax-odoo-src](https://github.com/ejosterberg/opensalestax-odoo-src) | Odoo connector | shipped (PyPI) |
| **opensalestax-saleor** | **Saleor Tax App** | **this repo** |
