# Improvement program - enterprise hardening

This folder turns the audit at [`../audit/enterprise-grade-audit-2026-07-06.md`](../audit/enterprise-grade-audit-2026-07-06.md) into an executable backlog. It is designed for an agent to implement and a human to review.

## File map

| File                                 | Purpose                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `BACKLOG.md`                         | Single source of truth for task status. Master table + evidence log (ledger).      |
| `wave-1-quick-wins.md`               | Task specs T01-T06. Package contract and release-path fixes, ~1 day.               |
| `wave-2-supply-chain-ci.md`          | Task specs T07-T14. Supply-chain gates and CI depth, ~1 week part-time.            |
| `wave-3-v4-and-code.md`              | Task specs T15-T24. v4 peer-dependency break and code hardening.                   |
| `wave-4-governance-observability.md` | Task specs T25-T35. Fleet governance, observability, test depth, polish.           |
| `PROMPT.md`                          | Copy-paste prompt to trigger agent implementation, plus the human review protocol. |

## Workflow

1. A human triggers a run using the prompt in `PROMPT.md` (whole wave or named tasks).
2. The agent works on a dedicated branch (`auto/shared-hardening-w<N>`), one task per conventional commit, following each task spec exactly.
3. Per task, the agent runs the gates (below), updates the task status in `BACKLOG.md` and appends one line to the evidence log. No evidence, no done.
4. The agent never pushes, never publishes, never changes GitHub/npm settings. Tasks that need those are marked `human` in the backlog; the agent prepares runbooks instead.
5. A human reviews using the checklist in `PROMPT.md`, then pushes/merges/releases.

## Gates (must be green before a task is marked done)

```bash
pnpm lint
pnpm typecheck
pnpm build
npx tsx scripts/validate-exports.ts
pnpm test:unit
pnpm test:e2e   # only when the task touches src/react or e2e config
```

## Status legend

`todo` -> `in-progress` -> `in-review` -> `done`, plus `blocked(<reason>)` and `human` (agent must not attempt; prepare a runbook and move on).

## Conventions

- Commit format: `<type>(<scope>): <summary>` with `Task: T##` in the body. Breaking changes only inside the wave-3 v4 train, marked `!` + `BREAKING CHANGE:` footer.
- Do not upgrade unrelated dependencies inside a task. Do not reformat untouched files.
- Every task spec ends with "review focus" - the exact things the human should scrutinize in the diff.
