# Decision 001 — NPM publication deferred to v1.0.1

**Date:** 2026-05-13
**Author:** Kickoff plan executor (Claude session)
**Status:** Deferred — v1.0 ships GitHub-only; NPM follow-up
required from Eric

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

Ship v1.0.0 to GitHub only. Document the deferral here and in
`specs/handoff.md`. Eric refreshes the NPM token on his next
workstation session and runs:

```bash
cd opensalestax-saleor
npm publish --access public
```

The published artifact will tag as v1.0.0 on NPM (the source of
truth — git tag, GitHub release, CHANGELOG entry — already
records v1.0.0; the NPM publish is a distribution mechanism).

If Eric prefers, the NPM publish can also be wired into a
`release.yml` GitHub Actions workflow gated on tag push (using
`NPM_TOKEN` as a repository secret), which would obviate the
manual step for v1.0.1+.

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

- v1.0.0 release notes mention NPM publish is a follow-up step
- `specs/handoff.md` lists "Publish v1.0.0 to NPM" as the very
  first v1.1 task
- Merchants who would consume via NPM are pointed at the GitHub
  release tarball for v1.0.0 (URL in the README's Quickstart)
