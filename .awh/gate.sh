#!/usr/bin/env sh
# Stage-0 evidence gate for @cyberskill/shared. The Stop/SubagentStop hook runs this
# and BLOCKS turn-end on a non-zero exit. Fast + deterministic checks only
# (e2e/build excluded). Requires deps installed: pnpm install.
set -e
echo "[awh-gate] pnpm lint…"
pnpm lint
echo "[awh-gate] pnpm typecheck…"
pnpm typecheck
echo "[awh-gate] pnpm test:unit…"
pnpm test:unit
# Canonical alternative if you prefer your own check: pnpm ready
