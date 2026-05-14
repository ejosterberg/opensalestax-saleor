# Demo deployment — saleor-demo VM

> Stage 05 of the v1.0 kickoff. Records the Proxmox VM, what runs
> on it, how to reach it, and what's deferred to v1.1.

## VM details

| | |
|---|---|
| **Hostname** | `saleor-demo` |
| **VMID** | 913 |
| **Host** | `pmvm1` (`10.32.161.114`) |
| **OS** | Debian 13 (trixie), Linux 6.12.74+deb13+1-cloud |
| **IP** | `10.32.161.172` |
| **Specs** | 4 cores, 8 GB RAM, 80 GB disk |
| **SSH** | `ssh saleor-demo` (alias in `~/.ssh/config`) |
| **Linux user** | `ejosterberg` |
| **Docker** | 29.4.3, compose plugin v2.x |

## What's running

- **opensalestax** container (this app) — port 3000 exposed,
  built from the repo's `Dockerfile`, points at the shared OST
  engine at `10.32.161.126:8080`.

The bundled OST engine + Postgres services in `docker-compose.yml`
are NOT started in this demo — the merchant pattern is to point
the connector at the merchant's existing engine, which is exactly
what this demo does (against the shared engine).

## Verification

```bash
curl http://10.32.161.172:3000/api/manifest | jq '.id, .permissions, [.webhooks[].syncEvents]'
# "ejosterberg.opensalestax"
# ["HANDLE_TAXES"]
# [["CHECKOUT_CALCULATE_TAXES"], ["ORDER_CALCULATE_TAXES"]]

curl http://10.32.161.172:3000/health
# {"ok":true,"version":"0.55.4","db_connected":true,"rtt_ms":145}
```

## Bring-up procedure (reproducible)

The full provisioning script is captured in
`kickoff/05-demo-deployment.md`. Summary:

1. `qm create 913 ...` from `proxmox-workshop` per the playbook
2. SSH alias added to `~/.ssh/config`
3. Docker installed (`apt-get install docker-ce ...`)
4. `git clone https://github.com/ejosterberg/opensalestax-saleor.git`
5. `cp .env.example .env`, edit `APP_API_BASE_URL` and `OSTAX_API_URL`
6. `sudo docker compose up -d --no-deps opensalestax`

Total time from `qm create` to a manifest endpoint responding 200:
**~6 minutes**.

## What's deferred to v1.1

The full success-criteria items D2, D5, D6 (Saleor instance running
on the VM, app installed into Saleor as tax app, real checkout)
remain open. Reasons:

- **Saleor's official `saleor-platform` docker stack** pulls
  multiple gigabytes of images (api, dashboard, postgres, redis,
  worker, scheduler) — wall-clock 20-40 min to first boot on a
  fresh VM, before configuration.
- Saleor's GraphQL setup for "create a channel, create a warehouse,
  create a product, create a shipping zone" through the API requires
  ~30 minutes of careful mutation crafting that's brittle against
  Saleor's evolving schema.

Per the kickoff plan's success-criteria.md, these are tracked as
**Deferred to v1.1**:

- **D2** Saleor instance running on the demo VM (deferred)
- **D5** App installed into Saleor as tax app on USD channel (deferred)
- **D6** Real $100 MN checkout returns nonzero plausible tax via
  the app — **partially validated**: the engine path is verified
  end-to-end by `tests/integration/engine.test.ts` which exercises
  the same `handleTaxCalculation` function the Saleor webhook would
  invoke. The Saleor-side install + GraphQL-checkout-mutation path
  is deferred to v1.1.

A v1.1 milestone titled "Full Saleor integration demo" is listed
in `specs/handoff.md` and will pick up the deferred items.

## Decommission

When this demo VM is no longer needed:

```bash
ssh proxmox-workshop 'qm stop 913 && qm destroy 913 --purge 1 --destroy-unreferenced-disks 1'
```

(`qm destroy` is destructive — Eric should confirm before running.)
