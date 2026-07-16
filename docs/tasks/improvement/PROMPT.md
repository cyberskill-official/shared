# Trigger prompts - implementation and review

Two prompts. Prompt A starts an agent implementation run (copy, set the SCOPE line, paste into a fresh session with access to this repo). Prompt B runs the human-side review, either manually as a checklist or pasted to a reviewer agent.

---

## Prompt A - implementation run (copy-paste)

```text
You are running an unattended enterprise-hardening session on the repo at
~/Projects/CyberSkill/shared (npm package @cyberskill/shared).

SCOPE: wave 1            # <- edit: "wave N", or "tasks T03, T07, T14", or "continue"

Read first, in this order (no skimming):
1. docs/improvement/README.md          - workflow rules
2. docs/improvement/BACKLOG.md         - task table + statuses; respect Depends-on
3. The wave spec file(s) for the SCOPE - each task's steps, acceptance, review focus
4. docs/audit/enterprise-grade-audit-2026-07-06.md - only the sections your tasks cite

Protocol (non-negotiable):
- Branch: work only on auto/shared-hardening-w<N> (create from latest main if absent).
  If SCOPE is "continue", resume the existing branch and pick the first task that is
  todo or in-progress in backlog order.
- One task = one conventional commit (feat/fix/ci/docs/test/refactor), body contains
  "Task: T##". Breaking changes only on the next branch per wave-3 rules, never on main
  or a w<N> branch.
- Per task, before marking done, ALL gates green:
    pnpm lint && pnpm typecheck && pnpm build
    npx tsx scripts/validate-exports.ts
    pnpm test:unit
    pnpm test:e2e        # only if the task touched src/react or e2e config
  A task's own acceptance criteria are additional, not alternative.
- Ledger: after each task, update its Status in BACKLOG.md (todo -> in-review; never
  set done - that is the human's transition) and append one evidence line:
  YYYY-MM-DD | T## | <branch>@<short-sha> | gates: ... | <one-line note>
  No evidence line, no status change. Never claim a gate you did not run.
- Tasks marked agent+human: do every agent step, write the runbook, set status
  blocked(human: <what>) and move on. Never touch GitHub settings, npm settings,
  secrets, or org repos. NEVER git push. NEVER publish.
- Self-verify loop: work continuously; do not pause to ask permission for anything
  inside these rules. Stop only when (a) SCOPE is complete, (b) a genuine decision
  fork appears that the specs do not answer - record it in BLOCKERS.md and continue
  with the next unblocked task, or (c) a gate stays red after 3 distinct fix attempts
  on one task - set blocked(<reason>), BLOCKERS.md entry, next task.
- Discipline: no unrelated dependency bumps, no reformatting untouched files, no
  scope creep beyond the task spec. If a spec conflicts with repo reality, reality
  wins - note the deviation in the evidence line.

End-of-run report (print, and save as docs/improvement/runs/RUN-<date>-w<N>.md):
- Tasks completed (id, commit, one line each)
- Tasks blocked (id, reason, what the human must do)
- Deviations from specs
- Exact commands for the human to review and push (git log range, diff hints)
Then stop. Do not push.
```

---

## Prompt B - human review protocol

Use directly as a checklist, or paste to a reviewer agent with the line "act as reviewer, produce a verdict per task; you may run read-only commands but change nothing".

```text
Review an enterprise-hardening run on ~/Projects/CyberSkill/shared.

Inputs: the run report in docs/improvement/runs/, the branch auto/shared-hardening-w<N>,
BACKLOG.md statuses, and the wave spec (each task ends with "review focus" - that is
your per-task checklist).

Per task in the run report:
1. git show <commit> - diff matches the task spec's Files/Steps; nothing unrelated.
2. Check the task's "review focus" items explicitly - they encode the known risks.
3. Verify the evidence line's gate claims: re-run at minimum
   pnpm lint && pnpm typecheck && pnpm build && pnpm test:unit on the branch head once
   (not per task).
4. Verdict per task: approve (flip BACKLOG status in-review -> done) | request-changes
   (set todo + note) | defer.

Wave-specific hot spots:
- Wave 1: T01 link targets from root; T05 MUST NOT be merged before the npmjs trusted
  publisher is configured (runbook docs/improvement/runbooks/trusted-publishing.md) -
  merging early breaks the next release with ENONPMTOKEN.
- Wave 2: workflow diffs - every new action SHA-pinned, permissions minimal, PR-only
  jobs guarded by event checks (dependency-review errors on push events). T12/T13 need
  your admin actions + a decision (pin vs protect) - record it in the evidence log.
- Wave 3: T15 peer/dependency split table - check each moved package against "is its
  type visible in our public API"; T18/T20 must not change public signatures; T21 is
  breaking and must sit on next, not main.
- Wave 4: T32 threat model - every claim needs a file reference; T33 zip must contain
  no secrets; T35 funding URL is your call.

After approval:
1. Human-only steps from BLOCKERS.md / runbooks (GitHub settings, npmjs config).
2. Push the branch, open the PR (CI must be green - the same gates plus new jobs).
3. Merge order within a wave: follow task ID order unless the report says otherwise.
4. For wave-3 v4 work: releases go through the next channel; latest moves only after
   the pilot consumer (ssl-be) is green on 4.0.0-next.x.
5. Flip approved tasks to done in BACKLOG.md (commit "docs(improvement): review w<N>").
```

---

## Quick-start lines

- First run: paste Prompt A with `SCOPE: wave 1`.
- Resume after interruption: `SCOPE: continue`.
- Cherry-pick: `SCOPE: tasks T08, T10, T11` (independent tasks only - check Depends-on).
- After each run: Prompt B, then trigger the next wave.
