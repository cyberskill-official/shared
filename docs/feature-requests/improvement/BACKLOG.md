# Backlog - enterprise hardening

Source: [`../audit/enterprise-grade-audit-2026-07-06.md`](../audit/enterprise-grade-audit-2026-07-06.md). Task specs live in the wave files; this table is the single source of truth for status. The agent updates Status and the evidence log; humans flip `in-review` -> `done` after review.

Effort: S < 1h, M = half day, L = 1-2 days, XL = split before starting.
Executor: `agent` (fully automatable), `agent+human` (agent prepares, human applies/decides), `human`.

## Wave 1 - quick wins (spec: wave-1-quick-wins.md)

| ID  | Task                                                   | Source | Effort | Executor    | Depends on | Status |
| --- | ------------------------------------------------------ | ------ | ------ | ----------- | ---------- | ------ |
| T01 | Root README so npm renders one                         | S2     | S      | agent       | -          | todo   |
| T02 | packageManager field + .npmrc engine-strict            | S4     | S      | agent       | -          | todo   |
| T03 | Exports/imports metadata cleanup + API.md version line | S5     | S      | agent       | -          | todo   |
| T04 | Attach SBOM to GitHub releases                         | S8     | S      | agent       | -          | todo   |
| T05 | npm trusted publishing (OIDC), remove NPM_TOKEN        | S6     | M      | agent+human | -          | todo   |
| T06 | Fix pre-push hook generator (`--ff-only`)              | S23    | S      | agent       | -          | todo   |

## Wave 2 - supply chain and CI (spec: wave-2-supply-chain-ci.md)

| ID  | Task                                                       | Source | Effort | Executor    | Depends on | Status |
| --- | ---------------------------------------------------------- | ------ | ------ | ----------- | ---------- | ------ |
| T07 | Artifact verification: publint + attw + pack-install smoke | S3     | M      | agent       | T01        | todo   |
| T08 | Restore SAST (CodeQL workflow)                             | S9     | S      | agent       | -          | todo   |
| T09 | PR gates: dependency-review, gitleaks, audit signatures    | S10    | M      | agent+human | -          | todo   |
| T10 | pnpm minimumReleaseAge install delay                       | S11    | S      | agent       | -          | todo   |
| T11 | OpenSSF Scorecard workflow + badge                         | S12    | S      | agent       | -          | todo   |
| T12 | Branch/tag protection rulesets (script + apply)            | S13    | M      | agent+human | -          | todo   |
| T13 | Org composite-action trust decision (pin vs protect)       | S7     | M      | agent+human | -          | todo   |
| T14 | CI matrix: Node x OS (exercise win32 paths)                | S14    | L      | agent       | -          | todo   |

## Wave 3 - v4 and code hardening (spec: wave-3-v4-and-code.md)

| ID  | Task                                                | Source  | Effort | Executor    | Depends on | Status |
| --- | --------------------------------------------------- | ------- | ------ | ----------- | ---------- | ------ |
| T15 | v4: peerDependencies restructure on `next` channel  | S1, S27 | XL     | agent+human | T07        | todo   |
| T16 | API report gate (api-extractor diff vs commit type) | S28     | L      | agent       | T15        | todo   |
| T17 | e2e: wire real browser mode (or fix docstring)      | S15     | M      | agent       | -          | todo   |
| T18 | Remove `as unknown as` casts in mongoose controller | S18     | M      | agent       | -          | todo   |
| T19 | Invert shell-execution policy in command.util       | S19     | M      | agent       | -          | todo   |
| T20 | Deduplicate mongoose/native controllers             | S20     | L      | agent       | T18        | todo   |
| T21 | Rate limiter fails closed in production             | S21     | S      | agent       | T15        | todo   |
| T22 | CLI polish: version fallback, --json, DEBUG scoping | S24     | M      | agent       | -          | todo   |
| T23 | I_Return ergonomics: docs + lint rule               | S22     | M      | agent       | -          | todo   |
| T24 | Verify or dismiss mongo scan leads                  | S25     | M      | agent       | -          | todo   |

## Wave 4 - governance, observability, depth (spec: wave-4-governance-observability.md)

| ID  | Task                                                               | Source  | Effort | Executor    | Depends on | Status |
| --- | ------------------------------------------------------------------ | ------- | ------ | ----------- | ---------- | ------ |
| T25 | Fleet version alignment (renovate preset + skew report)            | S26     | M      | agent+human | -          | todo   |
| T26 | Support matrix + deprecation policy docs                           | S29     | S      | agent       | T14        | todo   |
| T27 | Structured JSON logging transport                                  | S30     | M      | agent       | -          | todo   |
| T28 | Opt-in OpenTelemetry hooks (`node/otel`)                           | S31     | L      | agent       | T15        | todo   |
| T29 | Machine-readable error taxonomy in catchError                      | S32     | M      | agent       | -          | todo   |
| T30 | Test depth: fast-check, Stryker, bench, size-limit, coverage trend | S16     | XL     | agent       | T14        | todo   |
| T31 | Run unit suite against dist once per PR                            | S17     | M      | agent       | T07        | todo   |
| T32 | Threat model document (STRIDE-lite)                                | S33     | M      | agent+human | -          | todo   |
| T33 | Compliance evidence pack per release                               | S34     | M      | agent       | T04, T11   | todo   |
| T34 | Typedoc site on GitHub Pages                                       | S35     | M      | agent+human | -          | todo   |
| T35 | Polish batch: CoC, keywords/funding, editorconfig, DS_Store guard  | S36-S38 | S      | agent       | -          | todo   |

## Icebox (decision deferred, do not start)

| ID  | Item                                | Source | Note                                                 |
| --- | ----------------------------------- | ------ | ---------------------------------------------------- |
| X01 | Monorepo split into scoped packages | S39    | Revisit only after v4 (T15) has soaked in the fleet. |

## Evidence log (ledger - append only)

Format: `YYYY-MM-DD | T## | <branch>@<short-sha> | gates: lint,typecheck,build,exports,unit[,e2e] | <notes>`

<!-- agent appends below this line -->
