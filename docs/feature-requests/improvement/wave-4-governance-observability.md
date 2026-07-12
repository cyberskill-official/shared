# Wave 4 - governance, observability, depth (T25-T35)

Quarter horizon; tasks are independent unless noted. Run in any order, but T26 wants T14's matrix results and T33 wants T04+T11 outputs. Branch: `auto/shared-hardening-w4` (one branch per session is fine).

---

## T25 - fleet version alignment (S26) - agent+human

Why. Consumers found in `~/Projects/CyberSkill`: ssl-fe-user 3.20.1, ssl-be 3.20.1, gam 3.21.0, ssl-fe-admin 3.8.0 - 13 minors behind. A shared library pays off only when the fleet tracks it.

Agent steps (inside this repo - cross-repo edits are out of scope for a shared-repo session).

1. `docs/improvement/runbooks/fleet-alignment.md`: the policy - consumers stay within 2 minors of latest; upgrade window 2 weeks after release; majors within 1 quarter via migration guide.
2. A reusable Renovate preset in this repo (`renovate-presets/consumer.json`, referenced as `github>cyberskill-official/shared//renovate-presets/consumer`): groups `@cyberskill/shared` updates, automerges minors/patches when CI green, 3-day minimum release age, majors manual.
3. `scripts/fleet-skew-report.mjs`: scans sibling checkouts (arg: root dir) for `@cyberskill/shared` versions, prints a skew table vs the local package.json version (reuse the audit's find/grep logic).
4. Runbook lists the human follow-ups: add the preset to each consumer repo's renovate config; open the ssl-fe-admin upgrade PR (3.8.0 -> latest, check CHANGELOG for the 3.9-3.21 delta - notable: env, upload validation and CSP behavior changes).

Human steps. Apply preset in consumer repos; drive the ssl-fe-admin upgrade.

Acceptance. Preset + script + runbook merged; skew report runs green locally (evidence: its output pasted into the log).

Review focus. Preset automerge scope (minors/patches only); script must not assume repo layout beyond `*/package.json` at depth <= 3.

---

## T26 - support matrix + deprecation policy (S29) - after T14

Why. SECURITY.md tables 3.x/2.x/1.x support but nothing states what is actually tested and required: Node versions, TS minimum, ESM-only stance, Express 5 and React 19 requirements. Enterprise evaluators need this on one page, with dates.

Change.

1. New section in README + expanded SECURITY.md table: supported Node versions = exactly the CI matrix from T14; TypeScript minimum (state the tested version from devDeps and the floor the types need); "ESM-only by design - CJS is not and will not be supported"; Express >= 5, React >= 19, mongoose >= 9 (post-T15 peers); browsers supported for react/\* (align with e2e reality from T17).
2. Deprecation policy: each major receives security fixes for N months after the next major GA (pick 6 months - matches the 2.x row's spirit); EOL dates written as absolute dates.
3. Runbook snippet: the `npm deprecate @cyberskill/shared@"<x"` command flow for EOL majors.

Acceptance. Docs merged, no contradiction with engines field or CI matrix (cross-check in review).

Review focus. Dates are absolute (not "in 6 months"); the Node list equals the matrix, nothing aspirational.

---

## T27 - structured JSON logging transport (S30)

Why. `node/log` writes human-formatted console output (consola). Production consumers (ssl-be) cannot ship machine-readable logs to an aggregator without re-wrapping the shared logger; there is no level control beyond DEBUG and no correlation id.

Change.

1. Extend `node/log` with an opt-in JSON mode: factory `createLog({ format: 'pretty' | 'json', level, context })` or env `CYBERSKILL_LOG_FORMAT=json`; keep the existing `log` export defaulting to pretty (zero behavior change for current consumers).
2. JSON lines schema: `{ time (ISO), level, msg, ...context, correlationId? }` - one line per entry to stdout; errors serialize `name/message/stack`.
3. Level filtering: `error|warn|info|debug` honoring `CYBERSKILL_LOG_LEVEL`.
4. Correlation: `log.child({ correlationId })` returning a bound logger (plain object spread, no async-context magic in this task).
5. Unit tests assert exact JSON shape and level filtering.

Acceptance. Existing log tests untouched and green (default path unchanged); new mode covered; API.md log section documents the schema as stable.

Review focus. No new runtime dependency (consola may already support a JSON reporter - prefer wiring it over hand-rolling; if hand-rolled, keep it under ~100 lines).

---

## T28 - opt-in OpenTelemetry hooks (S31) - after T15

Why. Every consumer re-instruments the same shared code independently or ships blind. Controllers and the express factory are the natural interception points.

Change.

1. New export path `node/otel` (exports map + entry): `withTracing(controller, tracer?)` wrapping MongooseController/MongoController methods in spans (`db.operation`, `db.mongodb.collection` attributes per semantic conventions), and `createTraceMiddleware()` for express extracting/propagating W3C `traceparent`.
2. `@opentelemetry/api` as an optional peer (fits the T15 model); the module throws a clear error if imported without it; zero cost for consumers who never import `node/otel`.
3. Tests with `@opentelemetry/sdk-trace-base` in-memory exporter (devDependency): spans emitted with expected names/attributes; error paths set span status.
4. Usage example in API.md.

Acceptance. New export passes T07 artifact checks (including the optional-peer-absent smoke); tests green; no other export path's bundle grows (size-limit from T30 if present, else manual `du` note).

Review focus. The wrapper must not change I_Return semantics or swallow errors; attribute names follow current OTel semconv for MongoDB.

---

## T29 - machine-readable error taxonomy (S32)

Why. `catchError` normalizes errors into `I_Return` with message + HTTP-ish code from RESPONSE_STATUS. Consumers cannot branch on causes without string matching, which blocks precise alerting.

Change.

1. `E_ErrorCode` enum in `src/typescript/` (additive): VALIDATION, NOT_FOUND, DUPLICATE, DB_CONNECTION, TIMEOUT, IO, PERMISSION, UPLOAD_VALIDATION, UNKNOWN (extend as the mapping work reveals categories).
2. `catchError` gains best-effort classification (mongoose ValidationError -> VALIDATION, E11000 -> DUPLICATE, AbortError/ETIMEDOUT -> TIMEOUT, ENOENT/EACCES -> IO/PERMISSION, ...) attaching `errorCode` to the failure branch of `I_Return`; type updated additively (optional field) so it is non-breaking.
3. Mapping table documented in API.md; codes declared stable (append-only enum).
4. Unit tests per classification rule.

Acceptance. All existing catchError call sites compile untouched; new field present and tested; docs merged.

Review focus. Classification is conservative - misclassification is worse than UNKNOWN; every rule has a test with a realistic error object.

---

## T30 - test depth: property, mutation, bench, size, coverage trend (S16) - XL, run as five sub-sessions

Why. 80% line coverage says little about assertion strength, perf regressions in shared hot paths propagate to every consumer, and bundle growth is invisible today.

Subtasks (each independently committable; backlog tracks T30 as one row - note sub-progress in the evidence log).

T30a - property-based tests (fast-check devDependency): deepMerge (associativity-ish laws, idempotence on self-merge, pollution attempts with `__proto__`/`constructor` payloads asserting clean prototypes), serializer round-trip (`parse(stringify(x))` deep-equals x for generated structures of the five allowed types), string utils, `regexSearchMapper` (arbitrary input never throws, output regex always safe per its own limits).

T30b - mutation testing: Stryker with the vitest runner, scoped to `src/util/**` and `src/node/mongo/mongo.util.ts` + helpers; weekly scheduled workflow (not per-PR - too slow), report-only with score in the job summary; set a break threshold only after two baseline runs.

T30c - benchmarks: `vitest bench` suites for deepMerge, serializer stringify/parse, regexify, normalizeMongoFilter; a committed baseline JSON and a compare script warning on >25% regression; run in the scheduled workflow, not per-PR.

T30d - size budgets: `size-limit` (or `esbuild --metafile` + a small check script, given the ESM-preserve-modules layout size-limit handles import cost well) with budgets per high-traffic export (`util`, `typescript`, `constant`, `react/*` paths); CI gate failing on exceeded budget; initial budgets = current size +10%.

T30e - coverage trend: upload lcov to Codecov (or the org's chosen service) in check.yml, PR comment/status on delta, badge in README; raise per-module thresholds where the global 80 hides cold spots (`coverage.thresholds` per-glob for `src/util/**` at 90 - it is near that already).

Acceptance per subtask; overall done when all five merged. Each new workflow SHA-pins actions and sets minimal permissions.

Review focus. Scheduled jobs must not block PRs; budgets and thresholds start achievable (green on day one) - the point is the trend gate, not an immediate wall.

---

## T31 - run the unit suite against dist once per PR (S17) - after T07

Why. Unit tests import `src/` via aliases; only file existence is checked on `dist`. Bundler-introduced breakage (dropped side effects, stripped directives) reaches consumers unseen. T07's smoke covers resolution; this covers behavior.

Change.

1. A vitest config variant (`vitest.dist.config.ts`) mapping the `#`-aliases to `dist/` instead of `src/` (same alias keys, dist targets).
2. Run the pure-logic suites against it (util, constant, typescript, node/mongo helpers - exclude suites that import `.scss` or test source-only concerns; maintain an explicit include list).
3. CI step after build: `vitest run -c vitest.dist.config.ts`.
4. Document one known bundler-breakage class it guards (e.g. tree-shake dropping a side-effectful setup import) in a comment.

Acceptance. CI step green; deliberately breaking one dist file locally fails it (evidence, not committed).

Review focus. The include list - it should cover the exports consumers actually hit hardest (util + mongo helpers minimum) without doubling CI time (budget: +2 min).

---

## T32 - threat model document (S33) - agent+human

Why. The code carries CWE annotations (346, 434, 22, 78, 79) but no document ties the surfaces together; enterprise questionnaires ask for one.

Change. `docs/security/threat-model.md`, STRIDE-lite per surface: express factory (headers, session, rate limit, CORS), upload (traversal, MIME spoofing, size), ws (origin, auth), mongo (operator injection, filter normalization), command/cli (injection, allowlist), storage (key encoding), serializer (type allowlist). For each: assets, trust boundary, mitigations already in code (link file:line to the CWE comments), residual risks (link backlog task IDs where covered - T19, T21), and explicit non-goals (e.g. this library does not do authn). Link from SECURITY.md.

Human step. 30-minute review pass with Stephen for the residual-risk judgments before marking done.

Acceptance. Doc merged, every mitigation claim carries a file reference, residual risks map to backlog IDs or are accepted in writing.

Review focus. No claim without a code reference - this document gets shown to customers.

---

## T33 - compliance evidence pack per release (S34) - after T04, T11

Why. Customer due-diligence asks arrive as questionnaires; today the answers live in five places. One generated artifact per release turns that into a link.

Change.

1. `scripts/evidence-pack.mjs`: collects into `evidence-pack.zip` - `bom.json` (SBOM), `license-checker --json` output, coverage summary (lcov summary txt), a GENERATED.md with: version, commit, CI run link, scorecard badge/link, SECURITY.md pointer, support matrix pointer.
2. deploy.yml: generate the pack after SBOM, attach via the same `@semantic-release/github` assets list (`evidence-pack.zip`).
3. CONTRIBUTING release section documents it.

Acceptance. Dry-run generates the zip locally with all files present; next real release carries both assets (human observes).

Review focus. Nothing secret enters the zip (no env dumps, no tokens in CI links).

---

## T34 - typedoc site on GitHub Pages (S35) - agent+human

Why. API.md drifts (the stale version line proved it). Generated reference docs remove a whole class of drift; API.md stays as the curated overview.

Change.

1. `typedoc` devDependency; config with entry points = the export map's source entries (or `dist` d.ts entries), excluding tests/types-only duplicates; markdown-free default HTML theme is fine.
2. `.github/workflows/docs.yml`: on release published (or push of `v*` tag), build typedoc to `site/`, deploy via `actions/deploy-pages` (SHA-pinned; `permissions: pages: write, id-token: write` job-scoped).
3. README gains the docs link; API.md header links "full generated reference".

Human steps. Enable Pages (source: GitHub Actions) in repo settings - once.

Acceptance. Workflow green after human enables Pages; site renders the util + mongo modules with JSDoc content (the codebase is JSDoc-rich already - `jsdoc/require-jsdoc` is an error rule, so coverage is high).

Review focus. No `docs/` folder collision (Pages builds from the workflow artifact, not the folder); typedoc warnings triaged.

---

## T35 - polish batch (S36-S38)

Why. Small hygiene signals scanners and evaluators look for.

Change (one commit each, tiny).

1. `CODE_OF_CONDUCT.md` at root: Contributor Covenant v2.1 text with the existing contact (support@cyberskill.world); CONTRIBUTING links it instead of inlining.
2. package.json: `keywords` (typescript, esm, react, mongoose, express, apollo, utilities, cyberskill - pick ~8 honest ones), `funding` (GitHub sponsors or company URL - confirm target with Stephen; default `https://cyberskill.world`).
3. `.editorconfig`: root, utf-8, lf, final newline, 4-space indent to match the current style (verify against `.antfu` config indent - the repo uses 4).
4. lint-staged guard: reject any staged `.DS_Store` (config lives in `src/config/lint-staged/` - add a check + test); `git rm --cached` any strays currently tracked (audit found none tracked, they are ignored - verify and note).

Acceptance. All four merged; hook demo: staging a test .DS_Store gets rejected (evidence log, then unstage).

Review focus. keywords honest, funding URL confirmed by Stephen (mark that sub-item human if unconfirmed).
