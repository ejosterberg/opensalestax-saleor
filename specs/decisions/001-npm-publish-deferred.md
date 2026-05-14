# Decision 001 — NPM publication deferred to v1.0.1

**Date:** 2026-05-13
**Author:** Kickoff plan executor (Claude session)
**Status:** **Resolved 2026-05-13** — package published to NPM as
v1.0.0 via interactive `npm login` from Eric's workstation;
Trusted Publishing configured for v1.0.1+ so future releases
flow through GitHub Actions OIDC without any long-lived tokens.

## Context

The v1.0 kickoff plan called for publishing
`@ejosterberg/saleor-app-opensalestax` to the public NPM registry
alongside the GitHub release at
<https://github.com/ejosterberg/opensalestax-saleor/releases/tag/v1.0.0>.

## Blocker

The NPM token in `~/.npmrc` on the workstation responds with HTTP
401 to `npm whoami` and HTTP 404 to `npm publish`. Without a
working token, the publish step cannot complete from this Claude
session.

## Decision

Ship v1.0.0 to GitHub only at first; complete the NPM publish
out-of-band when Eric had a workstation with working NPM auth.

## Resolution (2026-05-13)

The chosen path turned out cleaner than the original plan:

1. Eric ran `git pull && npm ci && npm run build && npm login`
   from his Windows shell. `npm login` opened a browser flow and
   used his 2FA — no long-lived token created, no 2FA bypass.
2. `npm publish --access public` published
   `@ejosterberg/saleor-app-opensalestax@1.0.0` successfully
   (https://www.npmjs.com/package/@ejosterberg/saleor-app-opensalestax).
3. With the package now existing, Eric configured a GitHub
   Actions Trusted Publisher on it:
   - org: `ejosterberg`
   - repo: `opensalestax-saleor`
   - workflow: `release.yml`
4. From v1.0.1 onward, releases flow through the OIDC trusted
   publishing path in `.github/workflows/release.yml`:
   - `npm version patch && git push --follow-tags` triggers
     the workflow on the new tag
   - No NPM token on disk anywhere; no 2FA bypass
   - Provenance attestation pins each published artifact to
     the exact commit + workflow run that produced it

## Alternatives considered

- **Block the v1.0 release on NPM.** Rejected — GitHub is the
  primary distribution channel for self-hosted merchants
  (they `git clone` and `docker compose up`); NPM is for
  programmatic consumers, which are a smaller audience at v1.0.
- **Republish under a different scope where my token works.**
  Rejected — `@ejosterberg/...` matches the convention used by
  `opensalestax-medusa@@ejosterberg/medusa-plugin-opensalestax`
  and is what the README + CHANGELOG advertise.

## Consequences

- v1.0.0 was published to NPM on the same day as the GitHub
  release; both artifacts are at version 1.0.0
- The Tier-1 "Publish v1.0.0 to NPM" entry in `specs/handoff.md`
  is removed in the v1.0.1 cleanup commit
- `.github/workflows/release.yml` exists and is the
  authoritative release path going forward; v1.0.1 is its first
  real test run
