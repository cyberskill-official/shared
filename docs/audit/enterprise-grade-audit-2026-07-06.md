# @cyberskill/shared - enterprise-grade audit and strengthening plan

Date: 2026-07-06
Scope: full repository at `CyberSkill/shared` (v3.21.0, published as `@cyberskill/shared`)
Method: first-hand read of package/config/CI/docs and the security-relevant source (express, command, upload, storage, ws, mongo, cli), two module-level deep scans (node, react/util/config), downstream consumer scan across `~/Projects/CyberSkill`, npm registry checks, and current supply-chain practice research.

Every numbered finding below was verified against the actual files unless marked "flagged by module scan".

---

## 1. Verdict

The library is already far above average: SHA-pinned third-party actions, npm provenance, a semantic-release downgrade guard, license gating, prototype-pollution and NoSQL-operator blocking, CWE-annotated security comments, fail-closed WebSocket origins, 80% coverage thresholds, and 60 test files for 134 source files. The gap to "enterprise-grade" is not code quality. It is the package contract (dependencies model, published artifact), release-pipeline trust, CI depth (single OS, single Node version, no artifact-level tests), and consumer governance (version skew, no API-diff gate).

Scorecard (1-10):

| Area                              | Score | Main gap                                                        |
| --------------------------------- | ----- | --------------------------------------------------------------- |
| Code quality and security hygiene | 8.5   | isolated casts, shell-exec path                                 |
| Packaging and API contract        | 4     | no peerDependencies, npm README missing                         |
| Release and supply-chain security | 6.5   | long-lived tokens, mutable org actions, SBOM discarded, no SAST |
| CI depth                          | 6     | one OS, one Node version, no packed-artifact test               |
| Tests                             | 7.5   | no mutation/property/browser layer, e2e config drift            |
| Observability                     | 5     | console-only logging, no tracing hooks                          |
| Docs and governance               | 7     | stale API.md, no threat model, no support matrix                |
| Consumer governance               | 4     | 13-minor version skew, no alignment policy                      |

---

## 2. What is already strong (do not redo)

- Third-party GitHub Actions pinned to commit SHAs; `permissions: {}` default with narrow per-job grants.
- `publishConfig.provenance: true`; `pnpm audit` and `license-checker --failOn "GPL;AGPL;LGPL;SSPL"` in CI.
- `scripts/guard-no-downgrade.mjs` blocks semantic-release version regressions in `verifyRelease` (a real incident class, judging by the 1.0.0 release in git history).
- `scripts/validate-exports.ts` verifies every export entry resolves to a built file.
- Security-conscious defaults across the server surface: session store throws in production without a persistent store, MemoryStore opt-out is explicit, cookies are `httpOnly` + `secure` + `sameSite: lax`, helmet always on, `x-powered-by` disabled, WS origin checks fail closed in production (CWE-346 annotated), upload path-traversal checks cover `..`, absolute paths and baseDir anchoring (CWE-22), MIME mismatch rejected by default (CWE-434).
- `deepMerge`/`deepClone` guard `__proto__` and handle circular references; serializer reconstructs only an allowlist (Date, Map, Set, RegExp, BigInt) with RegExp source length limits; password generation uses rejection sampling over `crypto.getRandomValues()`.
- Renovate with `config:best-practices`, 3-day `minimumReleaseAge`, majors excluded from automerge.
- Docs set exists and is real: README, API.md, CODEBASE.md, CONTRIBUTING (510 lines), SECURITY.md with response SLAs, CODEOWNERS, PR/issue templates.

---

## 3. P0 - package contract (highest impact, do first)

### S1. Move framework dependencies to peerDependencies (v4 breaking change)

`package.json` declares zero `peerDependencies`. React 19.2.7, react-dom, mongoose, mongodb, express, @apollo/client, @apollo/server, graphql, i18next, react-i18next, next-intl, rxjs, @nestjs/common and @nestjs/core all sit in `dependencies` with exact pins.

Consequences for consumers: any consumer on a different React patch gets a second React copy (hook errors under npm/yarn, silent duplication under pnpm), mongoose instanceof checks can fail across copies, every consumer installs the full server stack even if they only use `util/string`, and exact pins block consumer-side security patching of transitive frameworks.

Action: in a v4, split into

- `peerDependencies` with ranges (`react: ">=19"`, `mongoose: ">=9"`, `graphql: "^17"`, `express: ">=5"`, ...) plus `peerDependenciesMeta.optional: true` for module-specific ones (nestjs, next-intl, @userback/widget, migrate-mongo), so a util-only consumer installs nothing heavy;
- `dependencies` for true internals only (clsx, chalk, consola, date-fns, qs, envalid...);
- document the mapping "export path -> required peers" in API.md.

This is the single change that most affects enterprise adoption. Ship it through a `next` dist-tag first (S38).

### S2. The npm package has no README

`npm view @cyberskill/shared readme` returns "No README data found!" and `readmeFilename` is empty, because the README lives at `docs/README.md` and npm only picks up a root-level README. The npmjs.com page for the package is blank, which is the first thing an enterprise evaluator sees.

Action: keep `docs/README.md` as the source and copy it to `README.md` in a `prepack`/`prepublishOnly` step (or in the release workflow before `semantic-release`). Also fixes the GitHub repo landing page and the `homepage: ...#readme` link.

### S3. Test the artifact you actually publish

`validate-exports.ts` checks file existence only. Nothing proves the packed tarball resolves and type-checks from a consumer's point of view.

Action: add to check.yml after build:

- `pnpm dlx publint` (packaging mistakes),
- `pnpm dlx @arethetypeswrong/cli --pack .` (types/ESM resolution per export),
- a pack-and-install smoke: `pnpm pack`, install the tarball into a temp project, dynamically `import()` every export path from `package.json#exports` and fail on any throw. This also catches the shebang, sideEffects and `dist` regressions that no current gate covers.

### S4. Pin the toolchain in the manifest

`package.json` has no `packageManager` field and no `.npmrc`. CONTRIBUTING says "pnpm >= 10" while CI resolves whatever the org action installs.

Action: add `"packageManager": "pnpm@<exact>"` (corepack), a repo `.npmrc` with `engine-strict=true` and `save-exact=true`, and optionally `engines.pnpm`. This makes local, CI and contributor environments converge.

### S5. Clean the export/imports metadata

- The published `imports` map (`#config/*` -> `./src/config/*` etc.) points at `src/`, which is not shipped (`files: ["dist", "public"]`). It is dead metadata in the published artifact; scope it to dev or rewrite to dist targets.
- Add `"./package.json": "./package.json"` to `exports` - bundlers, license scanners and tooling commonly need it and strict exports currently block it.
- API.md header still says "v3.10.0" while the package is 3.21.0; generate this line (or drop the version from the doc).

---

## 4. P1 - release and supply-chain security

### S6. Replace NPM_TOKEN with npm trusted publishing (OIDC)

deploy.yml already grants `id-token: write`, so the hard part is done. Configure the repo/workflow as a trusted publisher on npmjs.org, upgrade to a semantic-release/npm version with OIDC support, and delete the long-lived `NPM_TOKEN` secret. Provenance then comes for free and there is no token to leak or rotate. (npm CLI >= 11.5.1, already satisfied by Node 24.)

### S7. Close the mutable-ref hole in the release path

Third-party actions are SHA-pinned, but `cyberskill-official/.github/actions/env-deps@main` and `.../build@main` run at `@main` inside both workflows, with "keep @main, do not change" comments. Anyone who can push to that org repo can inject steps into the release job that holds npm publish rights.

Action (pick one): pin those uses to SHAs and let Renovate bump them; or keep `@main` but protect the `.github` repo with a ruleset (required review, no force push, CODEOWNERS) and state that explicitly in SECURITY.md. Today the tradeoff is undocumented.

### S8. Stop discarding the SBOM

deploy.yml generates `bom.json` with cdxgen and then never uploads it; the release contains no SBOM.

Action: attach it via the `@semantic-release/github` `assets` option (`{ path: 'bom.json', label: 'SBOM (CycloneDX)' }`), and optionally also `actions/attest-sbom` for a signed attestation. Enterprise security reviews ask for exactly this file.

### S9. Restore static analysis

Git history shows "feat: remove codeql"; no SAST runs today. Re-add CodeQL (JS/TS) or Semgrep CI with a small curated ruleset. The codebase already annotates CWEs; a scanner keeps that honest over time.

### S10. Add the missing PR-time gates

- `actions/dependency-review-action` on pull requests (blocks known-vulnerable or license-violating dep changes before merge; complements the push-time `pnpm audit`).
- Secret scanning: enable GitHub secret scanning + push protection on the repo, and add a gitleaks job for defense in depth.
- `pnpm audit signatures` step to verify registry signatures/attestations of installed packages.

### S11. Add an installation-time supply-chain delay

Renovate already waits 3 days on new releases. pnpm can enforce the same at install time: set `minimumReleaseAge` in pnpm config (pnpm >= 10.16) so a freshly-poisoned package version cannot enter local or CI installs during the window when most npm attacks are caught.

### S12. Publish an OpenSSF Scorecard

Add `ossf/scorecard-action` (weekly + badge). The repo would already score well; the badge converts invisible diligence into a signal customers and partners can check, and the report will point at the remaining gaps (token permissions, pinning) automatically.

### S13. Branch and tag protection as code

Adopt GitHub rulesets: require check.yml green + one review on `main`, forbid force pushes, protect `v*` tags (semantic-release creates them), and consider requiring signed commits. CODEOWNERS exists but only bites with required reviews enabled.

---

## 5. P1 - CI depth

### S14. Test the platforms you claim to support

check.yml runs one matrix cell: ubuntu + Node 24.16.0. But `engines` says `>=24.0.0`, and `command.util.ts` contains a win32-specific execFile branch (line ~265) that no CI has ever executed.

Action: matrix Node `[24, current]` x OS `[ubuntu, windows, macos]` for the unit-test job (the node/fs/path/command modules are the reason); keep lint/build on ubuntu only to control minutes.

### S15. Make e2e real or make the docs honest

`vitest.e2e.ts`'s JSDoc promises "browser automation with Playwright, multiple browser instances (Chromium, Firefox, WebKit)", but the config contains only an include pattern - the four `.test.e2e.tsx` suites run in the default environment. Either wire `@vitest/browser` with the Playwright provider (real value for the react/ modules) or correct the docstring. Today the gap between claim and config is the kind of drift an auditor flags.

### S16. Deepen the test techniques where they pay off

- Property-based tests (fast-check) for `deepMerge` (merge laws, pollution attempts), serializer round-trips, string utils and `regexSearchMapper`.
- Mutation testing (Stryker, vitest runner) as a weekly scheduled job on `util/` and the mongo helpers - 80% line coverage says little about assertion strength.
- Benchmarks (`vitest bench`) for deepMerge/serializer/regexify with a stored baseline, so a perf regression in a shared hot path fails loudly.
- Bundle budgets: `size-limit` with per-export budgets (e.g. `util` < 10 kB, react modules per-path) gated in CI; consumers inherit every regression here.
- Coverage trend: upload lcov to Codecov (or similar) for PR deltas and a badge; per-module thresholds where 80 global hides cold spots.

### S17. Run tests against dist once per PR

Unit tests import `src/` through aliases; only `validate-exports` touches `dist`. The packed-tarball smoke in S3 covers resolution; additionally running the fastest unit suite once with aliases mapped to `dist/` catches bundler-introduced breakage (tree-shake dropping a side effect, RSC directive stripping, etc.).

---

## 6. P2 - code-level items (verified)

### S18. Remove the `as unknown as` in the mongoose controller

`mongo.controller.mongoose.ts` `createOne` does `this.model.create(doc as unknown as Parameters<typeof this.model.create>[0])` and `(result as T)?.toObject?.() ?? result`. This silences the exact class of type error the controller exists to prevent. Type the input as the model's `InferSchemaType`/create-input instead. Same file, `createMany` repeats the pattern with `as T[]`.

### S19. Invert the shell-execution policy in command.util.ts

`executeCommand` routes any command containing shell metacharacters through full `exec` (a shell), and only metachar-free commands through `execFile`. So the riskier strings get the riskier executor. All call sites are internal today, and `rawCommand` rejects control characters, but the design is one refactor away from an injection.

Action: construct argv arrays at the call sites, run everything through `execFile`, and keep an explicit allowlist for the few internal commands that genuinely need a shell (`echo y | ag-kit update`). Forbid shell execution for any string that incorporates env- or user-derived input.

### S20. Deduplicate the two mongo controllers

`mongo.controller.mongoose.ts` (735 lines) and `mongo.controller.native.ts` largely mirror each other (CRUD + pagination + I_Return wrapping). Extract the shared shape into one core with two thin adapters; today every fix must be applied twice, and drift between them is invisible.

### S21. Align the production-store policies

`createSession` throws in production without a store (with an explicit opt-out); the rate limiter only warns in the same situation, even though MemoryStore rate limiting is trivially bypassed across clustered workers. Make the rate limiter throw with the same `allowMemoryStore`-style opt-out, so both follow "fail closed, opt out explicitly".

### S22. I_Return ergonomics

Every controller returns `I_Return<T>` instead of throwing - a good decision - but nothing stops a consumer from ignoring `.success`. `isSuccess()`/`unwrapResult()` exist; promote them in API.md examples, and consider an eslint rule in the shared config that flags unused `I_Return` results (the config package is the natural delivery vehicle).

### S23. Pre-push hook mutates the working tree

`.simple-git-hooks.json` pre-push runs `git pull && pnpm test`. A hook that pulls can create surprise merge commits mid-push. Use `git pull --ff-only` at most, or drop the pull and keep the tests.

### S24. Small CLI polish

- `getVersion()` falls back to `'1.0.0'` when package.json is unreadable; return `'unknown'` so a broken install cannot masquerade as a real version.
- Add `--json` output mode to `lint`/`test` commands so other CI systems can consume results; the boxed console output is human-only today.
- ESLint timeout fallback flips `process.env['DEBUG'] = 'true'` mid-run (cli/index.ts:69), mutating global state for everything after; scope it to the retried child process env instead.

### S25. Flagged by module scan (confirm before acting)

The node-module deep scan additionally reported: swallowed rejections where `catchError` returns a default without surfacing context in a few storage/fs paths; silent result truncation in a mongo list path; possible N+1 in dynamic virtual population; slug-generation collision handling. I verified the storage key encoding (encodeURIComponent, traversal-safe, 200-char cap) and found it sound. Treat the rest as leads for a focused half-day review of `mongo.dynamic-populate.ts` and `mongo.util.ts`, not as settled findings.

---

## 7. P2 - versioning and consumer governance

### S26. Fix the version skew in the fleet

Consumers found: ssl-fe-user 3.20.1, ssl-be 3.20.1, gam 3.21.0, ssl-fe-admin 3.8.0 (13 minors behind). A shared library only pays off when the fleet tracks it.

Action: add Renovate to every consumer repo with a grouped preset for `@cyberskill/shared`, define a max-skew policy (e.g. no consumer more than 2 minors behind), and track skew in a dashboard or a scheduled report.

### S27. Add a prerelease channel before v4

`release.config.js` releases only from `main`. Add a `next` branch publishing to the `next` dist-tag so the S1 peer-dependency break can soak in one consumer (ssl-be is the natural candidate) before `latest` moves.

### S28. Gate breaking changes on an API diff, not just commit messages

semantic-release derives semver purely from commit messages - a mis-typed `fix:` that actually breaks the public types ships as a patch. Add Microsoft api-extractor (or an attw + `.d.ts` snapshot diff) producing a committed API report; CI fails when the report changes without a `feat!`/`BREAKING CHANGE` commit. This is the strongest single guarantee you can give consumers.

### S29. Publish a support matrix and deprecation policy

SECURITY.md already tables 3.x/2.x/1.x support. Extend it into a real support matrix: Node versions tested (after S14), TypeScript minimum, ESM-only stance (state explicitly that CJS is unsupported by design), Express 5 requirement, React 19 requirement, and dates for end of security fixes per major. Add an `npm deprecate` step to the runbook for EOL majors.

---

## 8. P2 - observability

### S30. Structured logging option

`node/log` writes human-formatted console output (consola). Production services need machine-readable logs: add an opt-in JSON transport (level, timestamp, message, context fields, correlation id) selected via env or factory option, keeping the pretty output as the dev default. Consumers like ssl-be currently cannot ship these logs to an aggregator without re-wrapping.

### S31. Tracing hooks

Offer an opt-in OpenTelemetry integration: a factory wrapper that spans MongooseController operations and an Express middleware that propagates trace context. Ship as a separate export path (`node/otel`) so the dependency stays out of every other consumer's graph. Without hooks, every consumer re-instruments the same shared code independently.

### S32. Error taxonomy

`catchError` normalizes errors into `I_Return` with a message and code. Add a stable machine-readable `errorCode` enum (beyond HTTP-ish codes in RESPONSE_STATUS) so consumers can branch on causes without string matching - a prerequisite for SLO alerting on specific failure classes.

---

## 9. P3 - enterprise polish

- S33. Threat model document (STRIDE-lite) covering express/upload/ws/mongo surfaces, linking the existing CWE annotations; half a day, and it answers a whole section of enterprise security questionnaires.
- S34. Compliance evidence pack per release: SBOM (S8), license summary, scorecard link, coverage report, generated into the GitHub release. Turns customer due-diligence from a week of email into a link.
- S35. Generated API docs: typedoc to GitHub Pages on release, replacing manual drift-prone API.md sections (keep API.md as the curated overview).
- S36. Standalone CODE_OF_CONDUCT.md (CONTRIBUTING references the Covenant inline; scanners look for the file).
- S37. package.json `keywords` and `funding` fields; minor npm discoverability and OSS-hygiene signals.
- S38. Repo cleanliness: `.DS_Store` copies exist in the working tree (`src/`, `.github/`); they are gitignored, but add a lint-staged guard so they can never land, and add `.editorconfig`.
- S39. Strategic option, only if module count keeps growing: split into scoped packages (`@cyberskill/eslint-config`, `@cyberskill/mongo`, `@cyberskill/react-*`) in a pnpm workspace. S1's peer-dependency split removes most of the pain that would motivate this; revisit after v4 rather than before.

---

## 10. Suggested execution order

| Wave      | Items                                                                                              | Effort       | Outcome                                         |
| --------- | -------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| Week 1    | S2 npm README, S4 packageManager, S5 metadata, S8 attach SBOM, S6 trusted publishing, S23 hook fix | ~1 day total | visible artifact fixed, release path de-tokened |
| Weeks 2-3 | S3 publint/attw/pack-smoke, S9 SAST, S10 PR gates, S12 scorecard, S13 rulesets, S14 CI matrix      | ~3 days      | supply chain and CI at enterprise baseline      |
| Month 1   | S1 peer deps on `next` (S27), S28 api-extractor, S15 e2e, S18-S19 code fixes                       | ~1 week      | v4 candidate hardened and soaking               |
| Quarter   | S26 fleet alignment, S16 test depth, S30-S32 observability, S29 support matrix, S33-S35 polish     | ongoing      | v4 GA + evidence pack                           |

Sources for the trusted-publishing recommendation: [npm docs - trusted publishers](https://docs.npmjs.com/trusted-publishers/), [semantic-release/npm](https://github.com/semantic-release/npm), [Speakeasy - transitioning to trusted publishing](https://www.speakeasy.com/blog/npm-trusted-publishing-security).
