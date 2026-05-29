# Publishing to npm

This project ships as the unscoped npm package `gsd-revamp` plus five native
engine packages under the `@gsd-revamp` organization scope:

- `gsd-revamp` — the CLI (bin: `gsd`, `gsd-cli`)
- `@gsd-revamp/engine-darwin-arm64`
- `@gsd-revamp/engine-darwin-x64`
- `@gsd-revamp/engine-linux-x64-gnu`
- `@gsd-revamp/engine-linux-arm64-gnu`
- `@gsd-revamp/engine-win32-x64-msvc`

The engine packages are prebuilt Rust binaries (`gsd_engine.node`), one per
platform. The root package depends on them via `optionalDependencies`, so a
user's machine installs only the binary matching its OS/CPU. End users install
with a single command:

```bash
npm install -g gsd-revamp@latest   # global, exposes the `gsd` command
npx gsd-revamp@latest              # run without installing
```

## Publishing is one manual workflow

All publishing happens through `.github/workflows/npm-publish.yml`, triggered
manually from the Actions tab. It builds the engine for all five targets,
publishes the five `@gsd-revamp/engine-*` packages, then builds and publishes
the root package, and finishes with an install smoke test.

`build-native.yml` only builds and uploads engine artifacts for validation; it
does not publish.

## One-time setup

1. **npm organization** — create the `gsd-revamp` org on npmjs.com
   (avatar -> Add an Organization -> Free, unlimited public packages). The org
   name must match the `@gsd-revamp` scope.

2. **npm publish token** — npmjs.com -> Access Tokens -> Generate New Token:
   - Granular token with **Read and write** on **All packages** (needed because
     the unscoped `gsd-revamp` does not exist yet and must be creatable), or a
     Classic **Automation** token.
   - Tick **Bypass two-factor authentication (2FA)** — the token runs in CI.
   - Leave Allowed IP ranges empty (runner IPs are dynamic).

3. **GitHub secret** — add the token as repository secret `NPM_TOKEN`
   (Settings -> Secrets and variables -> Actions).

## Releasing a version

1. **Bump the version** in the root `package.json` if needed (npm rejects
   republishing an existing version), or pass it via the workflow `version`
   input.

2. **Dry run first** — Actions -> "npm Publish" -> Run workflow (branch `main`):
   - `version`: blank (use `package.json`) or e.g. `1.0.1`
   - `dist_tag`: `auto`
   - `publish_auth`: `token`
   - `dry_run`: `true`

   Confirm all five builds pass and `npm publish --dry-run` reports no auth or
   packaging errors.

3. **Publish for real** — run again with `dry_run: false`.

4. **Verify**:

   ```bash
   npm view gsd-revamp version
   npx gsd-revamp@latest --version
   ```

## Notes and gotchas

- **First publish under a new scope is slow to propagate.** Newly published
  packages can take a few minutes to appear on npm's read API. The workflow's
  "Verify platform packages are published" step waits up to ~5 minutes
  (12 attempts with backoff). If a publish still fails verification, the engine
  packages are usually already live — simply re-run the workflow; already
  published versions are skipped ("Already published, skipping") and the run
  proceeds to publish the root package.

- **Every release needs a new version.** npm does not allow publishing over an
  existing version; bump to `1.0.1`, `1.1.0`, etc.

- **Prereleases.** A version containing `-next.` (e.g. `1.1.0-next.0`) is
  published under the `next` dist-tag automatically when `dist_tag: auto`.

## Trusted publishing (OIDC) — recommended

Trusted publishing lets the workflow authenticate to npm via GitHub OIDC, so no
`NPM_TOKEN` secret is needed and every release gets a signed provenance
attestation automatically (the repo is public). The workflow is already wired
for it: `permissions: id-token: write`, a Node/npm version that supports it, and
`publish_auth` defaulting to `trusted`. The package `repository.url` fields
already point at `qdzsh/gsd-revamp`, which OIDC matches against.

### One-time setup on npmjs.com (per package)

Trusted publishers are configured per package — do this for **all six**:
`gsd-revamp`, `@gsd-revamp/engine-darwin-arm64`, `@gsd-revamp/engine-darwin-x64`,
`@gsd-revamp/engine-linux-x64-gnu`, `@gsd-revamp/engine-linux-arm64-gnu`,
`@gsd-revamp/engine-win32-x64-msvc`.

For each, open the package on npmjs.com → **Settings → Trusted publishing**, then:

- **Organization or user**: `qdzsh`
- **Repository**: `gsd-revamp`
- **Workflow filename**: `npm-publish.yml`
- **Environment name**: leave blank
- **Allowed actions**: `npm publish`

### Switching over

1. After configuring all six, run a release with `publish_auth: trusted` and
   `dry_run: true` to confirm the OIDC exchange works, then `dry_run: false`.
2. Once a trusted publish succeeds, delete the `NPM_TOKEN` repository secret —
   token access is no longer needed and removing it reduces risk.

Requirements (all already met): npm CLI ≥ 11.5.1 and Node ≥ 22.14 on the runner,
`id-token: write` in the workflow, and `repository.url` matching the GitHub repo.
