# Wave 2 - supply chain and CI (T07-T14)

Target: about a week part-time. T07 first (other tasks reference its harness); the rest are independent. Branch: `auto/shared-hardening-w2`.

Workflow-editing rules for every task in this wave: new/edited third-party actions must be SHA-pinned with a version comment (match the existing style in `check.yml`), jobs get explicit `permissions`, and `timeout-minutes`.

---

## T07 - artifact verification: publint + attw + pack-install smoke (S3)

Why. `scripts/validate-exports.ts` only checks that files exist. Nothing proves the packed tarball resolves, type-checks and imports from a consumer's perspective.

Change.

1. Add devDependencies `publint` and `@arethetypeswrong/cli` (exact pins).
2. New script `scripts/smoke-pack.mjs`:
    - `pnpm pack` to a temp dir;
    - `npm init -y` a scratch project in a temp dir, `npm i <tarball>`;
    - read `exports` from the installed package.json, build the list of import specifiers (skip `./style.css`; import it via a separate existence check);
    - dynamically `import()` each specifier in a child node process; fail on any rejection;
    - print a table of specifier -> ok/fail.
    - Note: react component modules import react/react-dom - they are regular dependencies today so the tarball install brings them; after T15 (peers) extend the scratch install with the peer list read from package.json.
3. New CI job `artifact` in `check.yml` (needs: nothing, runs after build via `pnpm build` of its own or reuse cache): `pnpm exec publint`, `pnpm exec attw --pack . --profile esm-only`, `node scripts/smoke-pack.mjs`.
4. Wire `pnpm run verify:artifact` script in package.json running all three.

Acceptance.

- CI job green.
- Negative proof in the task evidence: temporarily rename one dist file locally and show smoke-pack fails (do not commit the breakage).

Review focus. attw profile choice (`esm-only` matches the ESM-only stance), smoke script cleanup of temp dirs, no network beyond the local tarball install.

---

## T08 - restore SAST with CodeQL (S9)

Why. Git history shows CodeQL was removed ("feat: remove codeql"); no static analysis runs today.

Change. New `.github/workflows/codeql.yml`: `github/codeql-action` init/analyze (SHA-pinned), `language: javascript-typescript`, triggers: PR to main, push to main, weekly schedule. `permissions: security-events: write, contents: read`. Exclude `dist/`, `docs/`, `node_modules` via config block. `timeout-minutes: 20`.

Acceptance. Workflow green on the PR; code-scanning tab shows the analysis. If a finding fires, triage it in the same task (fix or dismiss with justification), do not suppress wholesale.

Review focus. Permissions block, pinned SHA, query suite left at default (`security-and-quality` optional - default `security-extended` is noisy; start default).

---

## T09 - PR gates: dependency-review, gitleaks, audit signatures (S10) - agent+human

Why. PRs currently get no dependency-diff or secret gates; `pnpm audit` runs post-merge/push only, and registry signatures are never verified.

Agent steps.

1. New job in `check.yml` (PR-trigger only, guard with `if: github.event_name == 'pull_request'`): `actions/dependency-review-action` (SHA-pinned) with `fail-on-severity: moderate` and the same license deny list as the license-checker step (GPL;AGPL;LGPL;SSPL).
2. New job `secrets`: gitleaks official action (SHA-pinned), full history scan on PR (`fetch-depth: 0`).
3. Add `pnpm audit signatures` as a step after install in the check job.
4. Runbook `docs/improvement/runbooks/repo-settings.md`, section "secret scanning": enable GitHub secret scanning + push protection.

Human steps. Flip the two repo settings per runbook (requires admin).

Acceptance. Both jobs green on a test PR; runbook exists; a planted fake-secret test on a scratch branch is caught by gitleaks (document, do not merge the plant).

Review focus. dependency-review only on PRs (it errors on push events), gitleaks has no custom config silencing real detectors.

---

## T10 - pnpm minimumReleaseAge install delay (S11)

Why. Renovate waits 3 days on new releases but nothing stops `pnpm install` from pulling a minutes-old (potentially poisoned) version during lockfile updates.

Change. Add `minimumReleaseAge: 4320` (minutes = 3 days) to `pnpm-workspace.yaml`. Requires pnpm >= 10.16 - verify against T02's pin. Document the escape hatch for emergency security bumps (`minimumReleaseAgeExclude` list) in the same file as comments.

Acceptance. `pnpm install` green; a comment documents why and the exclusion mechanism; CONTRIBUTING dependency section mentions it.

Review focus. Value matches the Renovate window; exclusion list empty by default.

---

## T11 - OpenSSF Scorecard workflow + badge (S12)

Why. The diligence already done (pinning, provenance, audits) is invisible to evaluators. Scorecard converts it into a public, checkable signal and flags remaining gaps automatically.

Change. New `.github/workflows/scorecard.yml`: `ossf/scorecard-action` (SHA-pinned), weekly schedule + push to main, `publish_results: true`, `permissions: security-events: write, id-token: write` (job-scoped). Add the badge to README (after T01, badge path root README).

Acceptance. Workflow green; badge renders; note the initial score in the evidence log.

Review focus. Permissions minimal at workflow level with job-level grants; no PAT used.

---

## T12 - branch/tag protection rulesets (S13) - agent+human

Why. CODEOWNERS only bites with required reviews; nothing today prevents force-pushes to main or deletion/recreation of `v*` tags that semantic-release depends on.

Agent steps.

1. Author `docs/improvement/runbooks/rulesets.md` + `rulesets/main.json` + `rulesets/tags.json` (GitHub ruleset JSON) encoding: main - require PR, 1 review, required status checks (the check.yml job names exactly as reported, plus new T07/T08/T09 jobs), block force pushes, restrict deletions; tags `v*` - creation by maintainers only, no deletion, no update.
2. Include the `gh api /repos/{owner}/{repo}/rulesets --input ...` apply commands in the runbook.
3. Add a decision note on required signed commits: recommended on, but requires all committers (including semantic-release bot commits via GH_TOKEN) to sign - document the `@semantic-release/git` implication and leave the default off until verified.

Human steps. Run the apply commands (admin), confirm a test PR shows the required checks.

Acceptance. JSON + runbook merged; human confirms rulesets active (screenshot or `gh api` output pasted into the evidence log).

Review focus. Status check names match the real job names (they are matrix-expanded - use the check run names GitHub reports, e.g. `🧪 Check (Node 24.16.0)`), otherwise merges deadlock.

---

## T13 - org composite-action trust decision (S7) - agent+human

Why. `check.yml` and `deploy.yml` run `cyberskill-official/.github/actions/{env-deps,build}@main` - a mutable ref inside the job that holds publish rights. Third-party actions are SHA-pinned; the org's own are not. Whoever can push to the org `.github` repo can inject steps into the release path.

Agent steps - prepare both options as commits/docs, human picks one.

- Option A (recommended): pin both `uses:` to the current commit SHA of `cyberskill-official/.github` with a `# main @ YYYY-MM-DD` comment; extend `renovate.json` so the github-actions manager also bumps these digests; remove the "keep @main, do not change" comments.
- Option B: keep `@main`, and instead author a ruleset JSON for the `.github` repo (require PR + review, block force push) plus a SECURITY.md paragraph stating the org repo is protected and why `@main` is accepted.

Human steps. Choose A or B; if A, merge the pin commit; if B, apply the ruleset on the `.github` repo and merge the docs commit. Record the decision in the evidence log.

Acceptance. Exactly one option merged; SECURITY.md documents the resulting trust model either way.

Review focus. If A: the pinned SHA actually is the current main of the org repo; Renovate coverage proven by a dry-run log or config validation.

---

## T14 - CI matrix: Node x OS (S14)

Why. CI runs one cell (ubuntu, Node 24.16.0) while `engines` claims `>=24.0.0` and `src/node/command/command.util.ts` has a win32-only execFile branch (~line 265) that has never executed in CI. The library ships fs/path/command code where OS differences are real.

Change.

1. Split `check.yml`: keep lint/build/audit/license on ubuntu only; give the test steps their own job with `strategy.matrix`: `node: [24.16.0, 25.x-current]` x `os: [ubuntu-latest, windows-latest, macos-latest]` (prune to ubuntu-full-matrix + windows/macos on the primary Node version if minutes are a concern: 4 cells total).
2. Fix whatever breaks: path separators in tests, shell assumptions in scripts (`scripts/*.mjs` run under node - fine; watch `npx tsx` invocations on windows), line endings (add `.gitattributes` with `* text=auto eol=lf` if needed).
3. Quarantine genuinely flaky cells only with a linked issue and an `if` guard, never silently.

Acceptance. All matrix cells green twice in a row (re-run to catch flake); the command.util win32 branch shows as covered in the windows cell (grep the coverage output) or has a windows-marked test.

Review focus. No test skipped on windows/macos without an issue link; total CI time still under ~10 min via caching.
