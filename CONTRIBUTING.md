# Contributing to opensalestax-saleor

Thanks for your interest. This is a small project — please follow
these conventions to keep merges fast.

## Developer Certificate of Origin (DCO)

Every commit must carry a DCO sign-off:

```bash
git commit -s -m "your message"
```

The `-s` flag appends `Signed-off-by: Name <email>` asserting your
right to contribute under the project license. PRs without DCO
sign-off on every commit will be asked to amend.

## No AI co-author trailers

Do not add `Co-Authored-By:` trailers attributing AI assistants.
Human authors take responsibility for their contributions.

## License

By contributing, you agree your contribution is licensed under
Apache-2.0 (see `LICENSE`).

## Quality gate

Before opening a PR, run the full quality gate locally:

```bash
npm run check
```

This runs lint + typecheck + tests + `npm audit`. PRs that fail
CI cannot merge.

## Branch model

Single-branch (`main`). Semver tags (`vX.Y.Z`). No long-lived
branches. Open a PR against `main`; squash-merge when CI is
green.

## Cutting a release

Releases publish to NPM automatically via GitHub Actions
[Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC + SLSA provenance) — no NPM tokens, no manual `npm
publish`, no 2FA prompts. To cut a release:

1. Make sure `CHANGELOG.md`'s `[Unreleased]` section accurately
   describes what's shipping. Promote it to the new version's
   section with today's date; open a fresh `[Unreleased]` above.
2. Bump the version in `package.json` AND `src/lib/version.ts`
   (the latter is the runtime-readable constant the app logs).
   Easiest: `npm version <patch|minor|major> --no-git-tag-version`
   for `package.json`, then hand-update `src/lib/version.ts` to
   match.
3. Commit the version bump on `main` with DCO sign-off.
4. Tag and push:

   ```bash
   git tag -a v1.2.3 -m "v1.2.3 — short summary"
   git push origin v1.2.3
   ```

5. The `release.yml` workflow fires on the tag push, re-runs the
   full quality gate, builds, and publishes to NPM via OIDC.
   Watch with `gh run watch`. When green, the new version is
   live at `https://www.npmjs.com/package/@ejosterberg/saleor-app-opensalestax`
   with a SLSA provenance attestation.
6. Create the GitHub release with `gh release create v1.2.3
   --notes-from-tag` (or paste release notes from the CHANGELOG
   entry).

Consumers can verify the supply-chain provenance of any release:

```bash
npm install @ejosterberg/saleor-app-opensalestax@<version>
npm audit signatures
```
