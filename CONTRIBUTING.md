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
