## 1.0.0 (2026-06-16)

### ✨ Features

* init project ([b351cd7](https://github.com/cyberskill-official/shared/commit/b351cd73b5d5ce12132b254c4af6fe731f47f5c6))
* point workflow to main ([03feedc](https://github.com/cyberskill-official/shared/commit/03feedc85957a8f9bdcf00d6ce68601f42e09b5b))
* remove codeql ([bc1b544](https://github.com/cyberskill-official/shared/commit/bc1b5445c602c3382c30346607d27501a9e908b5))
* update libs ([944d25b](https://github.com/cyberskill-official/shared/commit/944d25bb2dba3f4bb2aeccbcfaa4a56af9b1f571))

### 🐛 Bug Fixes

* allow credentials to call api ssr ([7dc7652](https://github.com/cyberskill-official/shared/commit/7dc76520c82a2f984c6430776c912fc3eae9584d))
* lint clean (path.join in vitest config) + refresh awh baseline ([155801c](https://github.com/cyberskill-official/shared/commit/155801cd64dcf119c8190716d0a5bdcfcebdd4ea))
* lint, security audit (next/esbuild), graphql-codegen test ([bc7b5b4](https://github.com/cyberskill-official/shared/commit/bc7b5b40e1ffadf973d7383210777a7e002559bb))
* type ([b64c4a7](https://github.com/cyberskill-official/shared/commit/b64c4a71c7119cf40ba1f6559a8100c40e06d020))
* **yamllint:** indent languages seq + strip trailing space in .serena/project.yml ([2865413](https://github.com/cyberskill-official/shared/commit/2865413576024352a88c9f30bc1bc444868e6f19))

### 🔧 CI

* add yamllint config; make .awh/goldenset.yaml yamllint-clean ([94010fb](https://github.com/cyberskill-official/shared/commit/94010fb74a6f58f56e37824bdec70a5bff7897a7))
* add yamllint config; make .awh/goldenset.yaml yamllint-clean ([9c96707](https://github.com/cyberskill-official/shared/commit/9c96707a1a32b7e20225c2c0e10199672ee0e9b1))

### 🧹 Chores

* fix pnpm install (mirror+timeouts) + adopt auto-work-harness Stage 0/1 ([fedaeba](https://github.com/cyberskill-official/shared/commit/fedaeba1335e621e592dfb5c5ae9c7cced3f2c8b))
* resolve npm vulnerabilities in uuid and postcss ([4f7427a](https://github.com/cyberskill-official/shared/commit/4f7427a2bb6eb4e5066f29874d2786c2cf74e02d))

### Fixed
- **deploy.yml:** [CI] Add `--ignore-registry-errors` to `pnpm audit` in deploy workflow, consistent with `check.yml`. Prevents transient npm registry issues from blocking production deployments. (AUDIT-1776270477-5) (@Agent)

### Tests
- **serializer.test.unit.ts:** [TEST] Add 3 security boundary tests for deserialization type guards (non-string RegExp flags, non-object RegExp value, non-string BigInt value). (AUDIT-1776270477-1) (@Agent)
- **ws.test.unit.ts:** [TEST] Add 2 WebSocket upgrade path normalization tests (query-string URL matching, encoded path rejection). (AUDIT-1776270477-2) (@Agent)
- **validate.test.unit.ts:** [TEST] Add 4 IP validation edge-case tests (empty string, port injection, garbage input, extra octets). (AUDIT-1776270477-3) (@Agent)
- **merge-changelog-unreleased.test.unit.mjs:** [TEST] Add 1 test for merge with no trailing `---` separator boundary. (AUDIT-1776270477-4) (@Agent)
- **upload.test.unit.ts:** [TEST] Add 2 SVG exclusion security tests asserting `svg` is NOT in default IMAGE config. (AUDIT-1776269499-3) (@Agent)
- **upload.test.unit.ts:** [TEST] Add 4 mimetype advisory warning tests (IMAGE mismatch, AUDIO mismatch, matching prefix, no-mimetype) covering the advisory log path. (AUDIT-1776269499-2) (@Agent)
- **upload.test.unit.ts:** [TEST] Add 3 path traversal protection tests (dot-dot rejection, baseDir escape, baseDir allow) verifying the security boundary at upload time. (AUDIT-1776269499-1) (@Agent)

## [3.19.0](https://github.com/cyberskill-official/shared/compare/v3.18.0...v3.19.0) (2026-04-13)

### ✨ Features

* **apollo-error:** add keyboard scroll support to error details ([1339f9d](https://github.com/cyberskill-official/shared/commit/1339f9d7741ed2e0fb870b801eee5151dc61dc46))
* code audit 11th April 2026 ([c871540](https://github.com/cyberskill-official/shared/commit/c871540594ca24ef3380213982ff605b84f608e8))
* code audit 12th April 2026 ([be39f25](https://github.com/cyberskill-official/shared/commit/be39f2588e31d4f64489095e5b44801801ef9235))
* code audit 13th April 2026 ([814fbe9](https://github.com/cyberskill-official/shared/commit/814fbe96eedf90e1e8fb478ebeec60c40440cf6a))
* code audit 14th April 2026 ([c76bfaa](https://github.com/cyberskill-official/shared/commit/c76bfaa1d7bc244572496791bfa25bab8251c32d))
* code audit 5th April 2026 ([0497f36](https://github.com/cyberskill-official/shared/commit/0497f368a10fef66147e9579980e1e59be2081dd))
* implement remaining audit tasks from 5th April ([12092ac](https://github.com/cyberskill-official/shared/commit/12092acab6e4240368ae2357b152998cf2fbfb55))
* test audit 5th April 2026 ([1e2d115](https://github.com/cyberskill-official/shared/commit/1e2d115b0c2c2f510a4c11dea75e2032dea17fcc))

### 🐛 Bug Fixes

* apply review feedback - storage test assertions and changelog .agent paths ([7498625](https://github.com/cyberskill-official/shared/commit/74986251e05092b3e31b363a034ac622b6db6a37))
* apply review feedback - watch flag, changelog wording, extra blank lines ([13698c6](https://github.com/cyberskill-official/shared/commit/13698c68c208c64835054caa48f38dea6208c988))
* remove redundant guard, add x-powered-by disabled test, update Nest mock ([89a3d18](https://github.com/cyberskill-official/shared/commit/89a3d18591d22546d13a8ff897ecff116fcaf2dc))

### ⚡ Performance

* **string:** optimize getFileName URL parsing ([b56c48e](https://github.com/cyberskill-official/shared/commit/b56c48e6158423d3afe6394f38615c224eb7d3af))
* **string:** optimize getFileName URL parsing ([c28c551](https://github.com/cyberskill-official/shared/commit/c28c5516ae2c3e299e1fecd3fb49f4f05a605f91))

### ✅ Tests

* **apollo-error:** add a11y attribute assertions and extract focusable selector helper ([3430fd5](https://github.com/cyberskill-official/shared/commit/3430fd5ef9402f2409d4c11b2e7f64381013863f))
* **apollo-error:** add JSDoc comment to getFocusableElements to fix lint error ([0663ffc](https://github.com/cyberskill-official/shared/commit/0663ffcfd490ef2fb414f3aa735ea5a2428de0a5))
* **loading:** fix intermittent e2e test failure ([079d843](https://github.com/cyberskill-official/shared/commit/079d84332e40377635b6c47d4f9f8a7610e819fb))

### 🧹 Chores

* **deps:** pin cyberskill-official/.github action to a39693a ([#320](https://github.com/cyberskill-official/shared/issues/320)) ([b612e57](https://github.com/cyberskill-official/shared/commit/b612e579693fc5eb60f41c18f14c35e39c34ffd4))
* **deps:** update actions/cache action to v5 ([1744dd5](https://github.com/cyberskill-official/shared/commit/1744dd55b6b935a92a5bb844690af13af72815dc))
* **deps:** update all non-major dependencies ([#321](https://github.com/cyberskill-official/shared/issues/321)) ([16f73d6](https://github.com/cyberskill-official/shared/commit/16f73d6cf65fb505620b296f98784c9bd50edd4c))
* **deps:** update cyberskill-official/.github digest to a914c67 ([6a35248](https://github.com/cyberskill-official/shared/commit/6a35248d32be23071cd00f892a0114f0635c3aaa))
* **deps:** update cyberskill-official/.github digest to dce044c ([#324](https://github.com/cyberskill-official/shared/issues/324)) ([47c2a2f](https://github.com/cyberskill-official/shared/commit/47c2a2fd542b56fee51b8b8543d95643fe98861d))
* **deps:** update dependency vite to v8.0.5 [security] ([#325](https://github.com/cyberskill-official/shared/issues/325)) ([27a3f9f](https://github.com/cyberskill-official/shared/commit/27a3f9f3a38579961f86be643719dacc572a0655))

### Fixed

- **loading.component.tsx:** [SEC] Replace `style.innerHTML` with `style.textContent` for defense-in-depth XSS prevention. (AUDIT-1744487553-2) (@Agent)
- **loading.module.scss:** [UX] Fix broken `prefers-reduced-motion` selector — animations now correctly pause for reduced-motion users. (AUDIT-1744487553-3) (@Agent)
- **codeql.yml:** [SEC] Add `persist-credentials: false` to CodeQL checkout step, consistent with all other workflows. (AUDIT-1744487553-4) (@Agent)
- **common.util.ts:** [FIX] Remove empty JSDoc blocks from `debounce` function that confused documentation generators. (AUDIT-1776101022-2) (@Agent)
- **apollo-error.module.scss:** [UX] Add `prefers-reduced-motion` media query to suppress button transitions for motion-sensitive users. (AUDIT-1776101022-3) (@Agent)
- **loading.component.tsx:** [UX] Add `aria-busy="true"` to status region for improved screen reader loading-state announcements. (AUDIT-1776101889-3) (@Agent)

### Security (2026-04-15 Session 3)

- **express.util.ts:** [SEC] Remove `'unsafe-eval'` from GraphQL preset CSP `scriptSrc` directive — closes XSS vector via `eval()` in GraphQL-enabled deployments. Modern playgrounds (Apollo Studio, GraphiQL v2+) no longer require it. (AUDIT-1776267789-4) (@Agent)

### Fixed (2026-04-15 Session 3)

- **common.util.ts:** [FIX] Remove residual empty JSDoc blocks from `debounce` function (lines 277–279, 290–292) that confuse documentation generators. (AUDIT-1776267789-5) (@Agent)

### Tests (2026-04-15 Session 3)

- **ws.test.unit.ts:** [TEST] Add input validation tests for `createWSServer` — covers missing `server` and invalid `path` error branches. (+2 tests) (AUDIT-1776267789-1) (@Agent)
- **express.test.unit.ts:** [TEST] Add test for `createCorsOptions` isDev+production safety-net warning log. (+1 test) (AUDIT-1776267789-2) (@Agent)
- **express.test.unit.ts:** [TEST] Add test for `createSession` missing-store-in-production warning log. (+1 test) (AUDIT-1776267789-3) (@Agent)
- **express.test.unit.ts:** [TEST] Add assertion that GraphQL CSP preset does NOT include `'unsafe-eval'`. (+1 test) (AUDIT-1776267789-4) (@Agent)

### Security
- **upload.constant.ts:** [SEC] Remove `svg` from default IMAGE allowed extensions — SVGs can contain embedded JavaScript (`<script>`, event handlers), closing an XSS vector in file upload handling. (AUDIT-1776269499-3) (@Agent)

- **serializer.util.ts:** [SEC] Add input validation to `BigInt` deserialization — rejects oversized strings (>1000 chars) and non-numeric values to prevent DoS via arbitrary-precision memory exhaustion. (AUDIT-1776101889-1) (@Agent)
- **apollo-error.component.tsx:** [SEC] Sanitize GraphQL error extensions before rendering — filters out `stacktrace`, `exception`, `stack`, and `originalError` keys to prevent information disclosure. (AUDIT-1776101022-4) (@Agent)
- **.gitignore:** [SEC] Add `.agent/` to `.gitignore` to prevent agent diagnostic metadata from being committed. (AUDIT-1776101022-1) (@Agent)

### Changed

- **vite.config.ts:** [PERF] Replace O(n) `allDeps.some()` sub-module scan with O(1) Set+prefix lookup in `isExternal()`. (AUDIT-1744487553-1) (@Agent)
