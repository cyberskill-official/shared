# Wave 1 - quick wins (T01-T06)

Target: one working day. All tasks are independent; execute in ID order. Branch: `auto/shared-hardening-w1`.

---

## T01 - root README so npm renders one (S2)

Why. `npm view @cyberskill/shared readme` returns "No README data found!". The README lives at `docs/README.md`; npm and the GitHub landing page only pick up a root-level `README.md`. The package page is blank.

Change. Make the root the canonical location.

Steps.

1. `git mv docs/README.md README.md`.
2. Fix relative links inside it: `../LICENSE` -> `LICENSE`, `CODEBASE.md` -> `docs/CODEBASE.md`, and any other `./` references that assumed `docs/`.
3. Leave a 3-line pointer at `docs/README.md` linking to the root file (other docs link to it).
4. Grep the repo for `docs/README.md` references (`package.json`, workflows, docs) and update them.

Acceptance.

- `pnpm pack --dry-run` (or `npm pack --dry-run`) lists `README.md` in the tarball.
- All links in the README resolve on GitHub (relative paths correct from root).
- `docs/CHANGELOG.md` path untouched (release config points there).

Verification. `pnpm pack --dry-run | grep README` plus the standard gates.

Risk. Low. Broken relative links are the only realistic failure; click through them in review.

Review focus. Link targets, no content loss in the move, tarball listing.

---

## T02 - packageManager field + .npmrc engine hygiene (S4)

Why. No `packageManager` field and no `.npmrc` exist; CONTRIBUTING says "pnpm >= 10" while CI installs whatever the org action resolves. Local, CI and contributor toolchains can drift.

Change.

1. Add `"packageManager": "pnpm@<exact version currently used in CI>"` to `package.json` (check the org `env-deps` action or use the version in `pnpm-lock.yaml` metadata; pick the exact current stable if ambiguous).
2. Create `.npmrc` at repo root with `engine-strict=true` and `save-exact=true`.
3. Align the CONTRIBUTING prerequisites section with the exact pin.

Acceptance.

- `corepack enable && pnpm --version` resolves the pinned version.
- `pnpm install` under a wrong Node major fails fast (engine-strict) - document, do not test destructively in CI.
- Gates green.

Risk. CI uses its own pnpm setup; if the org action pins a different version, the field wins under corepack. Note the CI-observed version in the commit body.

Review focus. The exact pnpm version chosen; that CI still installs cleanly.

---

## T03 - exports/imports metadata cleanup + API.md version line (S5)

Why. Three small contract defects: (a) the published `imports` map points `#config/*` etc. at `./src/*`, which is not shipped (`files: ["dist", "public"]`) - dead metadata in the artifact; (b) `exports` lacks `"./package.json"`, which bundlers and license scanners need under strict exports; (c) `docs/API.md` header says "v3.10.0" while the package is 3.21.0.

Change.

1. Add `"./package.json": "./package.json"` to `exports`.
2. Verify no built file references `#`-specifiers at runtime: `grep -r "from '#" dist/ ; grep -r 'require("#' dist/` must be empty. If empty, keep `imports` for dev-time use but add a `// dev-only` note in CODEBASE.md; if not empty, rewrite those `imports` targets to `./dist/*` equivalents.
3. Remove the hardcoded version from the API.md header line (make it "current major: 3.x" or drop it).

Acceptance.

- `node -e "console.log(require.resolve('@cyberskill/shared/package.json'))"` works against a packed install (full proof lands with T07; here assert the exports entry exists and validate-exports passes - note `validate-exports.ts` iterates entries whose values are objects, and this entry is a string; confirm the script handles the string form, it already has a `typeof entryValue === 'string'` branch).
- No dist file references `#` specifiers.
- API.md no longer carries a stale version.

Review focus. The grep evidence in the commit body; validate-exports output.

---

## T04 - attach the SBOM to GitHub releases (S8)

Why. `deploy.yml` generates `bom.json` with cdxgen and then discards it. Releases ship no SBOM, although enterprise reviews ask for exactly this artifact.

Change. In `release.config.js`, replace the bare `'@semantic-release/github'` entry with:

```js
['@semantic-release/github', {
    assets: [
        { path: 'bom.json', label: 'SBOM (CycloneDX)' },
    ],
}],
```

Confirm step order in `deploy.yml` keeps SBOM generation before the Deploy step (it currently does: Build -> Generate SBOM -> Security Audit -> Deploy).

Acceptance.

- `pnpm exec semantic-release --dry-run` passes plugin config validation (dry run cannot attach assets; full proof is the next real release).
- A note is added to the release runbook section of CONTRIBUTING (Release Process) that each release carries `bom.json`.

Review focus. Plugin option shape (assets array), no other release.config behavior changed.

---

## T05 - npm trusted publishing (OIDC), remove NPM_TOKEN (S6) - agent+human

Why. Publishing uses a long-lived `NPM_TOKEN` secret. npm trusted publishing (OIDC) removes the token entirely, and `deploy.yml` already grants `id-token: write`. Provenance then flows automatically.

Agent steps.

1. Verify the `@semantic-release/npm` version in the lockfile supports OIDC trusted publishing (needs a 2025+ release; bump `semantic-release` or the npm plugin if not).
2. Edit `deploy.yml`: remove `NPM_TOKEN: ${{ secrets.NPM_TOKEN }}` from the Deploy step env (keep `GH_TOKEN`).
3. Update `docs/SECURITY.md` best-practices list: replace the token mention with trusted publishing + provenance.
4. Write `docs/improvement/runbooks/trusted-publishing.md` with the exact npmjs.com clicks: package settings -> Trusted publishers -> GitHub Actions -> repo `cyberskill-official/shared`, workflow `deploy.yml`, environment `production`.

Human steps (before merging this task's commit).

1. Configure the trusted publisher on npmjs.com per the runbook.
2. After the first successful OIDC release, delete the `NPM_TOKEN` secret from the repo/environment.

Acceptance.

- `deploy.yml` has no `NPM_TOKEN` reference; runbook exists.
- First post-merge release publishes successfully with provenance (human observes; keep the old token unrevoked until then).

Ordering guard. Do not merge before the npmjs side is configured, or the next release fails with ENONPMTOKEN. The commit can sit on the branch; flag it in the run report.

Review focus. That id-token permission remains; rollback = re-add the env line.

---

## T06 - fix the pre-push hook generator (S23)

Why. The generated pre-push hook runs `git pull && pnpm run --if-present test`. A plain `git pull` inside a hook can create surprise merge commits mid-push.

Change. The committed `.simple-git-hooks.json` is generated output (gitignored). Fix the source: `createGitHooksConfig` in `src/node/path/` (exported via `../path/index.js`, used by `gitHookSetup` in `src/node/cli/index.ts`). Change the pre-push command to `git pull --ff-only && pnpm run --if-present test`.

Steps.

1. Locate `createGitHooksConfig` (grep `pre-push` under `src/node/path/`).
2. Change the command; update the matching unit test snapshot/assertions (`path.test.unit.ts` or wherever hooks config is asserted).
3. Regenerate the local hook file to confirm output (`pnpm exec tsx src/node/cli/index.ts` is not needed; assert via unit test).

Acceptance. Unit test asserts the generated pre-push string contains `--ff-only`; gates green.

Review focus. Only the pre-push entry changed; pre-commit and commit-msg untouched.
