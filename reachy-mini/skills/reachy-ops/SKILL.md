---
name: reachy-ops
description: >-
  Operate the Reachy Mini robot "Ricci" — power on Ricci / bring the robot
  online, start Ricci, check if Ricci is up, restart Ricci / restart clawbody,
  deploy clawbody (patched files Mac → robot), read my Obsidian vault via Ricci,
  and shut down Ricci. Use this whenever the user wants to bring the robot
  online, verify it's running, restart or redeploy the clawbody voice app, drive
  the read-only vault endpoint, or tear the session down. Covers the Mac-side
  ricci-up.sh flow and the robot-side ssh commands the USER must run.
---

# reachy-ops — Operate Ricci (Reachy Mini)

Ops runbook for the user's Reachy Mini robot **"Ricci"**. Organized by task.
Every command is copy-pasteable. Each block says **who runs it** — the Mac (this
machine, i.e. commands the agent may run) or the **USER via ssh**.

## ⚠️ CRITICAL — SSH to the robot is blocked in the agent sandbox

**Any `ssh pollen@10.0.0.24 ...` command must be run by the USER, not the agent.**
SSH from inside the Claude Code sandbox is blocked. The user runs robot commands
either:
- with the `!` prefix in the Claude Code prompt (runs in their shell, output
  returns to chat), or
- in their own terminal.

Passwordless SSH is already set up, so no password is needed. When a task below
is marked **USER via ssh**, present the exact command and ask the user to run it.

## Topology (facts)

| Thing | Where | Address / path |
|-------|-------|----------------|
| Mac (this machine) | LAN | `10.0.0.9` |
| Robot (Reachy Mini CM4) | LAN | `10.0.0.24`, ssh user `pollen` |
| OpenClaw gateway | Mac | port `18795` (LAN-bound) |
| Vault read endpoint | Mac | port `8890` (read-only, token-gated) |
| clawbody (voice app) | Robot CM4 | `~/clawbody`, editable-installed in `/venvs/apps_venv` |

---

## Power on / bring Ricci online (main flow)

**The ritual:** power on the robot → wait ~30s → run the script on the Mac →
talk to Ricci once it prints `✅ Ricci is UP`.

**Run on the Mac:**
```bash
~/reachy-mini-agents/ricci-up.sh
```

What it does (idempotent — kills stale copies first):
1. Waits for the robot daemon.
2. Starts the OpenClaw gateway (LAN, valid key from `~/.openclaw_openai_key`).
3. Starts the vault endpoint (allow folders: `projects/Reachy Mini` + `DeeperDive`).
4. Launches clawbody on the robot.
5. Waits for `session configured with N tools`.

Takes ~1–2 min. If launched via `!` it may exceed the 120s prompt cap and
**background — that's fine**; wait for `✅ Ricci is UP`.

---

## Check if Ricci is up

**Vault endpoint health (Mac):**
```bash
curl -s "http://127.0.0.1:8890/health?token=$(cat ~/.reachy_vault_token)"
```

**clawbody process on the robot — USER via ssh (own separate command):**
```bash
ssh -n pollen@10.0.0.24 "ps -eo pid,args | grep '[b]in/clawbody' | grep -w python"
```

**clawbody log tail — USER via ssh (own separate command):**
```bash
ssh -n pollen@10.0.0.24 "tail -n 40 /tmp/clawbody.log"
```

> GOTCHA: run every robot LOG/STATUS read as its **own separate** `ssh` command.
> Chaining a read right after a launch hangs the ssh (CM4 CPU spike).

---

## Restart clawbody on the robot

**USER via ssh.** Run kill and launch as their own commands.

**Kill:**
```bash
ssh -n pollen@10.0.0.24 "ps -eo pid,args | grep '[b]in/clawbody' | grep -w python | awk '{print \$1}' | xargs -r kill"
```

**Launch:**
```bash
ssh -n pollen@10.0.0.24 "cd ~/clawbody && setsid /venvs/apps_venv/bin/clawbody --no-face-tracking </dev/null >/tmp/clawbody.log 2>&1 & echo launched"
```

GOTCHAS:
- Use the **double-quoted `setsid` form** exactly as above.
- **Do NOT `pkill -f clawbody`** — it can kill the parent shell.
- Read the log as a **separate** ssh command afterwards (see Check if Ricci is up).

---

## Deploy a patched clawbody file (Mac → robot)

clawbody is an **editable install**, so replacing a `.py` and restarting picks
it up. Pipe the file over ssh (**USER via ssh**), then restart clawbody:

```bash
cat <local file> | ssh pollen@10.0.0.24 "cat > ~/clawbody/<same relative path>"
```
Then restart clawbody (see **Restart clawbody** above).

The **GA OpenAI-Realtime patch** and the **Obsidian-vault tools** live in the Mac
working copy at:
```
~/reachy-mini-agents/clawbody/src/reachy_mini_openclaw/
```
A fresh `git clone` of upstream `tomrikert/clawbody` will **NOT** have these —
they must be re-applied. See runbook §6 (GA patch) and §10 (vault).

---

## Vault read endpoint (read my Obsidian vault via Ricci)

Read-only, token-gated endpoint on the Mac (port `8890`) that serves the user's
Obsidian notes in `projects/Reachy Mini` + `DeeperDive` (recursive) so Ricci can
read them by voice. **Started automatically by `ricci-up.sh`** — no separate
start needed for the default scope.

**Health check (Mac):**
```bash
curl -s "http://127.0.0.1:8890/health?token=$(cat ~/.reachy_vault_token)"
```

- Server code: `~/reachy-mini-agents/vault-endpoint/vault_server.py`
- **Widen scope** via the `VAULT_ALLOW` env var — colon-separated, vault-relative
  folders (e.g. `VAULT_ALLOW="projects/Reachy Mini:DeeperDive:some/other/folder"`).

---

## Shut down Ricci

**Mac side** (agent may run these):
```bash
lsof -ti tcp:8890 | xargs kill 2>/dev/null   # vault endpoint
pkill -f "openclaw.*gateway"                 # OpenClaw gateway
```

**Robot side:** powering off the robot stops clawbody.

---

## Source of truth (full detail)

Do not duplicate the runbook — reference it. Full detail lives in the Obsidian
vault:

> **`projects/Reachy Mini/Reachy Mini - OpenClaw + Robot Connection Runbook.md`**

- §3 — cold start
- §6 — GA OpenAI-Realtime patch
- §10 — vault endpoint
- §11 — `ricci-up.sh`

When something here is ambiguous or a deeper procedure is needed, open the
runbook at the referenced section.
