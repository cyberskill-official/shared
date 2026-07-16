# Wave 3 - v4 and code hardening (T15-T24)

The v4 train (T15, T16, T21) rides the `next` prerelease channel. Code tasks (T17-T20, T22-T24) are non-breaking and can land on main independently - do them first if running this wave in one session. Branch: `auto/shared-hardening-w3` (code tasks) and `next` (v4 train).

---

## T15 - v4: peerDependencies restructure on the `next` channel (S1, S27) - agent+human, XL

Why. `package.json` has zero `peerDependencies`; react 19.2.7, react-dom, mongoose, mongodb, express, @apollo/client, @apollo/server, graphql, i18next, react-i18next, next-intl, rxjs and @nestjs/\* are exact-pinned in `dependencies`. Consumers risk duplicate React copies (hook errors), cross-copy instanceof failures in mongoose, and every consumer installs the full server stack regardless of which export they use. Exact pins also block consumer-side patching of framework CVEs.

Design decisions (already made in the audit - do not relitigate):

- Peers with ranges: `react: ">=19"`, `react-dom: ">=19"`, `mongoose: "^9"`, `mongodb: "^7"`, `express: ">=5"`, `graphql: "^17"`, `@apollo/client: "^4"`, `@apollo/server: "^5"`, `i18next: ">=26"`, `react-i18next: ">=17"`, `next-intl: "^4"`, `rxjs: "^7"`, `@nestjs/common: "^11"`, `@nestjs/core: "^11"`, `ws: "^8"`, `graphql-ws: "^6"`.
- `peerDependenciesMeta` optional: true for module-specific peers so util-only consumers install nothing heavy: @nestjs/\*, next-intl, @userback/widget, migrate-mongo, mongoose-paginate plugins, @apollo/client-integration-nextjs, graphql-upload, i18next family (optional because only the i18n exports need them).
- Keep in `dependencies` (true internals): clsx, chalk, consola, date-fns, qs, envalid, fs-extra, yargs, path-to-regexp, helmet/cors/compression/cookie-parser/body-parser/express-session/express-rate-limit/express-useragent (middleware wrappers - decide per package: anything the consumer never imports directly stays a dependency; anything type-visible in the public API becomes a peer. Express itself is type-visible -> peer).
- Everything moved to peers gets a devDependency copy (same exact pin as today) so local dev, tests and the vite build keep working unchanged (`vite.config.ts` already externalizes all three groups).

Steps.

1. Create the `next` release branch config first: in `release.config.js`, `branches: ['main', { name: 'next', prerelease: true, channel: 'next' }]`.
2. Restructure package.json per the design above (single commit, `feat!:` with `BREAKING CHANGE:` footer describing the peer matrix).
3. Extend `scripts/smoke-pack.mjs` (from T07): read peers + optional peers, install required peers into the scratch project, then per optional-peer module group, import its export path only after installing that group (matrix of "with peers" / "without optional peers" verifying graceful absence).
4. Write `docs/MIGRATION-4.md`: per export path -> required packages to add; copy-paste `pnpm add` lines per consumer profile (frontend, backend, util-only).
5. Update API.md export tables with a "peers" column.
6. Ship `4.0.0-next.1` from the `next` branch (human pushes; release runs on workflow_dispatch).
7. Pilot: upgrade `ssl-be` to the next tag in a branch, run its gates (human or a follow-up session in that repo).

Acceptance.

- `attw --pack` and publint green under the new layout.
- Smoke matrix green (with and without optional peers).
- `pnpm install` in a scratch project with only `util` usage pulls no react/mongoose/express.
- MIGRATION-4.md exists; pilot consumer green before `latest` promotion.

Rollback. The `next` channel isolates everything; `latest` moves only when the human merges next -> main.

Review focus. The peer/dependency split table in the PR body - check each moved package against "is its type or instance visible in our public API"; range floors match what the code actually needs (Express 5 APIs, React 19 hooks, mongoose 9 APIs).

---

## T16 - API report gate (S28) - after T15 settles

Why. semantic-release derives semver purely from commit messages; a mistyped `fix:` that changes public types ships as a patch. An API-diff gate makes breaking-change detection mechanical.

Change.

1. Add `@microsoft/api-extractor` devDependency. One extractor config per top-level export family (util, typescript, constant, config, node/_, react/_ - start with the stable, high-traffic ones: util, typescript, node/mongo, node/express, react/apollo-client) rolling up `dist/**/*.d.ts` into committed reports under `etc/api/`.
2. `pnpm api:extract` script regenerating reports; `pnpm api:check` failing on uncommitted diffs.
3. CI step in `check.yml`: run `api:check`; a helper script inspects the PR's commits - if reports changed and no commit is `feat!`/contains `BREAKING CHANGE:`, fail with a message explaining the two legal fixes (revert the API change, or mark the commit breaking).

Acceptance. Reports committed; CI demo: a scratch commit changing a public type without `!` fails the gate (evidence in log, not merged).

Review focus. Extractor warnings triaged (missing release tags are noisy - set `ae-missing-release-tag` to off initially); the gate script's commit-message parsing matches commitlint's convention.

---

## T17 - e2e: real browser mode or honest docs (S15)

Why. `src/config/vitest/vitest.e2e.ts`'s JSDoc promises Playwright browser automation with Chromium/Firefox/WebKit instances, but the config only sets an include pattern - the four `.test.e2e.tsx` suites run in the default environment. Claim and config diverge.

Change (default decision: wire it, minimum viable).

1. Add `@vitest/browser` + `playwright` devDependencies; extend `vitestE2E()` to configure `test.browser = { enabled: true, provider: 'playwright', headless: true, instances: [{ browser: 'chromium' }] }` while still deep-merging caller options.
2. Update the JSDoc to describe exactly what is configured (chromium headless; firefox/webkit optional via options).
3. CI: e2e step installs playwright chromium (`pnpm exec playwright install chromium --with-deps`) - ubuntu job only.
4. If the four suites need jsdom-era fixes for real-browser semantics, fix them; if any suite is fundamentally jsdom-bound, rename it `.test.unit.tsx` honestly.

Acceptance. `pnpm test:e2e` runs in real chromium locally and in CI; docstring matches config; e2e suites pass.

Review focus. CI time impact (browser install cached?); the deepMerge of caller options still allows overriding instances.

---

## T18 - remove `as unknown as` casts in the mongoose controller (S18)

Why. `src/node/mongo/mongo.controller.mongoose.ts` `createOne` does `this.model.create(doc as unknown as Parameters<typeof this.model.create>[0])` and `(result as T)?.toObject?.() ?? result`; `createMany` repeats the pattern with `as T[]`. These casts silence the exact class of type error the controller exists to prevent.

Change.

1. Type create inputs properly: accept the model's create input type (mongoose 9: `RequireOnlyTypedId<T>`-style or derive from the model generic the class already carries) instead of `T | Partial<T>` + cast.
2. Normalize the toObject handling once in a typed private helper (`toPlain(doc): T`) instead of per-method casts.
3. Add type-level regression tests (`expect-type` or vitest's `expectTypeOf`) asserting: valid create input compiles, invalid field errors, return type is `I_Return<T>`.

Acceptance. `grep -n "as unknown as" src/node/mongo/*.ts` empty; typecheck + all mongo unit tests (722-line suite) green unchanged; new type tests in place.

Review focus. Public method signatures - the generics may not change (that would be breaking); if a signature must change, move the task into the T15 v4 train and say so in the evidence log.

---

## T19 - invert the shell-execution policy in command.util (S19)

Why. `src/node/command/command.util.ts` `executeCommand` routes any command containing shell metacharacters through full `exec` (a shell) and metachar-free commands through `execFile` - the riskier strings get the riskier executor. All call sites are internal today, but the design is one refactor away from injection.

Change.

1. Introduce an internal command type: `{ file: string, args: string[] }` built at call sites (the `command.*` factory in `src/node/path/`), executed via `execFile` always.
2. The few commands that genuinely need a shell (`echo y | ag-kit update` in cli/index.ts) get replaced: use `execFile('ag-kit', ['update'])` with stdin write of `y\n` via `spawn`, or the tool's non-interactive flag if it has one.
3. Keep `rawCommand` for backward compatibility but route it through a documented `shellAllowlist` check: the exact string must be a member of a module-level frozen set; anything else throws. Keep the existing control-char rejection.
4. Windows: preserve the current `shell: isWin` behavior only for the allowlisted set; argv execution works cross-platform for the rest (`.cmd` shims need `execFile` with `shell: true` on windows for pnpm/npx - keep that documented exception keyed on the binary name, not the argument string).
5. Unit tests: injection attempts (`"pnpm; rm -rf x"`, backtick payloads, `$(...)`) must be rejected or executed as literal arguments, asserted per platform branch.

Acceptance. No `exec(` (shell form) remains except behind the allowlist; existing command tests green; new injection tests green on ubuntu + windows cells (needs T14's matrix; if not landed yet, mark the windows assertion pending with a follow-up note).

Review focus. The allowlist contents (should be tiny and constant); pnpm/npx still work on windows.

---

## T20 - deduplicate the mongoose/native controllers (S20) - after T18

Why. `mongo.controller.mongoose.ts` (735 lines) and `mongo.controller.native.ts` mirror each other: CRUD, pagination, filter normalization, I_Return wrapping, catchError. Every fix lands twice or drifts.

Change.

1. Extract a shared core: filter normalization, I_Return wrapping, pagination shaping, error mapping into `mongo.controller.core.ts` (pure functions, no driver imports).
2. Reduce each controller to driver-specific calls + the core. Public classes, method names and signatures stay identical - this is internal refactoring only.
3. Coverage stays: the existing suites (controller, native, helpers - ~1500 lines of tests) must pass unmodified. Add core-level unit tests for the extracted pure functions.

Acceptance. Combined controller LOC drops materially (target: -30% or better); zero public API diff (T16's api report unchanged if already active); all existing tests pass without edits (edits to test files are a red flag - justify each in the evidence log).

Review focus. Behavioral parity - especially error paths and pagination edge shapes; no accidental export of the core module in package.json exports.

---

## T21 - rate limiter fails closed in production (S21) - v4 train

Why. `createSession` throws in production without a persistent store (with explicit `allowMemoryStore` opt-out); the rate limiter in the same file only warns, though MemoryStore limits are trivially bypassed across clustered workers. The two policies should match.

Change. In `setupMiddleware` (`src/node/express/express.util.ts` ~line 181): when `NODE_ENV === production` and no `rateLimitOptions.store`, throw with the same style of message and an `allowMemoryStore: true` opt-out on `I_RateLimitOptions`. Update the type, JSDoc remarks, and unit tests (both paths). This changes production behavior -> lands as part of the v4 train (`feat!` on `next`), not on main.

Acceptance. Tests for throw, opt-out warn, and dev no-op paths; MIGRATION-4.md gains a paragraph.

Review focus. The opt-out flag name matches the session one exactly (consistency is the point).

---

## T22 - CLI polish: version fallback, --json, DEBUG scoping (S24)

Why. Three small operator-facing defects in `src/node/cli/index.ts`: `getVersion()` falls back to `'1.0.0'` (a broken install masquerades as a real version); lint/test results print human-boxed output only (CI systems cannot parse); the ESLint timeout retry sets `process.env['DEBUG'] = 'true'` mid-run, mutating global state for everything after (~line 69).

Change.

1. Version fallback -> `'unknown'`.
2. Add a global `--json` flag: when set, `showCheckResult` prints `{ errors: [...], warnings: [...], summary: { errorCount, warningCount } }` as a single JSON line to stdout (schema documented in API.md CLI section) and suppresses boxes/spinners; exit codes unchanged.
3. DEBUG scoping: pass an env override into `runCommand`/`executeCommand` options (`{ env: { ...process.env, DEBUG: 'true' } }` on the retried child) instead of mutating `process.env`.

Acceptance. Unit tests: json output shape (parse and assert keys), fallback string, and that a retried command's env does not leak into subsequent commands (spy on exec options).

Review focus. The JSON goes to stdout with nothing else on stdout in that mode (logs to stderr), so `cyberskill lint --json | jq` works.

---

## T23 - I_Return ergonomics: docs + lint rule (S22)

Why. Controllers return `I_Return<T>` instead of throwing - good - but nothing stops a consumer from ignoring `.success`. Helpers `isSuccess()`/`unwrapResult()` exist yet API.md never shows them.

Change.

1. API.md: add a "working with I_Return" section - branch on `.success`, or `unwrapResult()` to throw-on-failure; one realistic controller example each.
2. Add a lint guard to the shared eslint config (`src/config/eslint/`): at minimum ensure `@typescript-eslint/no-floating-promises` and `no-unused-vars` catch the discard patterns; if a targeted rule is feasible without a custom plugin package, add a `no-restricted-syntax` selector flagging `await <controller call>` expression-statements whose result is unused. Ship as `warn` first.
3. CHANGELOG note that the rule arrives as warn and may become error in the next major.

Acceptance. Docs section merged; rule active in the exported config (verify via `eslint --print-config` on a fixture); self-repo lint still green.

Review focus. False-positive rate of the selector on this repo itself; keep it warn.

---

## T24 - verify or dismiss the mongo scan leads (S25)

Why. The module deep-scan flagged four leads the audit did not confirm first-hand: (a) swallowed rejections returning defaults without context in some storage/fs paths; (b) silent result truncation in a mongo list path; (c) N+1 in dynamic virtual population (`mongo.dynamic-populate.ts`); (d) slug-generation collision handling (`mongo.util.ts`). The storage key encoding lead was already checked and dismissed (encodeURIComponent + 200-char cap is sound).

Change. Half-day focused review. For each lead: reproduce with a unit test, or dismiss with a written rationale. Fix confirmed ones in place (each its own commit). Record verdicts in a table appended to this file:

| Lead                     | Verdict | Evidence |
| ------------------------ | ------- | -------- |
| (a) swallowed rejections |         |          |
| (b) silent truncation    |         |          |
| (c) N+1 dynamic populate |         |          |
| (d) slug collisions      |         |          |

Acceptance. All four rows filled with verdict + commit or rationale; any fix has a regression test.

Review focus. Dismissals must cite the exact code path that makes the lead a non-issue, not just "looks fine".
