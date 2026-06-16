# auto-work-harness — Stage 0/1 adoption for @cyberskill/shared

Additive setup — your `.agent/`, `.serena/`, and `.simple-git-hooks.json` are
untouched. The harness Claude Code hooks fire during an agent's tool use (not on
commit), separate from your git hooks.

## Step 0 — fix `pnpm install` first (it's currently timing out)

`node_modules` is empty and `pnpm i` aborts downloading large tarballs
(next + `@next/swc-darwin-arm64`, ~34 MB) because there was no `.npmrc`, so pnpm
used its 60 s default timeout. Create one:

```bash
cat > ~/Projects/CyberSkill/shared/.npmrc <<'EOF'
fetch-timeout=600000
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=180000
network-concurrency=5
EOF

cd ~/Projects/CyberSkill/shared
pnpm store prune          # clear any corrupted/partial store entry
pnpm install
```

### If installs run at ~1 KiB/s ("speed … is below 50 KiB/s" / ECONNRESET)

That's a network-bandwidth/reachability problem to `registry.npmjs.org`, not a
config issue — no timeout can pull a 34 MB tarball at 1 KiB/s. In order of impact:

1. **Check for a proxy/VPN throttling npm**, then retry:
    ```bash
    npm config get proxy; npm config get https-proxy; echo "$HTTP_PROXY $HTTPS_PROXY"
    # if a stale proxy is set and you don't need it:
    npm config delete proxy; npm config delete https-proxy
    # turn off any VPN, or switch network (a mobile hotspot often fixes 1 KiB/s instantly)
    ```
2. **Use a closer registry mirror** (you're in HCMC — npm's default CDN node may be
   far/slow). Add to `.npmrc`, then `pnpm install`:
    ```
    registry=https://registry.npmmirror.com
    ```
    `npmmirror` (Alibaba/cnpm) mirrors the full _public_ npm registry and is fast in
    Asia. Caveat: it's a third-party mirror — fine here since all of shared's deps are
    public, but for private/company packages prefer a self-hosted cache (Verdaccio) or
    your company registry. Revert to `https://registry.npmjs.org` if you change your mind.
3. **Lower parallelism** so the few bytes/sec aren't split 16 ways:
   `pnpm install --network-concurrency 1`.

(`.npmrc` and `.claude/settings.json` are credential-/exec-sensitive, so the agent
can't write them for you — you create them, as below.)

## Step 1 — wire the Stage-0 hooks

```bash
# generates .claude/settings.json with the correct harness path on this Mac
# (keeps the .awh/gate.sh shipped here; doesn't clobber it)
~/Projects/auto-work-harness/install.sh ~/Projects/CyberSkill/shared
```

## Step 2 — baseline + commit

```bash
pip install -e ~/Projects/auto-work-harness          # once, gives `awh`
cd ~/Projects/CyberSkill/shared
pnpm lint && pnpm typecheck && pnpm test:unit         # sanity-check the gate
awh eval .awh/goldenset.yaml --seeds 1 --out .awh/eval-baseline.json
git add .awh .claude .npmrc && git commit -m "chore: fix pnpm timeout + adopt auto-work-harness Stage 0/1"
```

## What's here

| File                 | Purpose                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `gate.sh`            | The Stop hook runs `pnpm lint && pnpm typecheck && pnpm test:unit`; the agent can't end its turn while it's red. |
| `policy.json`        | Test files read-only during agent runs (reads allowed). `.env` already blocked by harness defaults.              |
| `goldenset.yaml`     | Stage-1 golden set (lint, typecheck, unit) for the CI regression gate.                                           |
| `eval-baseline.json` | Generated in Step 2 (needs a Mac with deps installed).                                                           |

## Verify the gate locally

```bash
echo '{"tool_name":"Read","tool_input":{"file_path":".env"}}' \
  | python3 ~/Projects/auto-work-harness/harness/stage0_verification/hooks/pretooluse_deny.py; echo $?  # 2 = blocked
```
