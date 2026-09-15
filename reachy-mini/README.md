# Reachy Mini ("Ricci") — Claude Code pack

Everything needed to develop for and operate the Reachy Mini robot from Claude
Code: 7 skills, 1 agent, 1 slash command, and the two Mac-side scripts the ops
flow depends on. Snapshot taken 2026-09-10 from `~/work/products/.claude/`
(the most complete copy — includes `reachy-ops`, which the
`reachy-mini-agents` repo did not have).

```bash
cd ~/claude-config/reachy-mini
./install.sh              # user scope: ~/.claude  (recommended on a new machine)
./install.sh ~/some/repo  # or project scope
```

## What's inside

| Path | What |
|------|------|
| `agents/personal-reachy-mini-developer-agent.md` | Dev + operator agent. DEV: build/scaffold/debug apps. OPS: power on, deploy/restart clawbody, vault reads, shutdown. |
| `commands/personal-reachy-mini-developer-agent.md` | `/personal-reachy-mini-developer-agent <request>` — dispatches to the agent. |
| `skills/reachy-sdk-core` | Connect, safe head 6-DOF / body-yaw / antenna targets. Refs: api-cheatsheet, joint-limits. |
| `skills/reachy-motion-emotions` | Library emotions/dances, sound-synced and procedural moves, non-blocking. Ref: moves-cheatsheet. |
| `skills/reachy-audio-voice` | Mic, speaker, sound files, DoA, volume via REST, STT→LLM→TTS loop. Ref: volume-and-audio. |
| `skills/reachy-vision` | Camera frames, vision models, look-at / face tracking. |
| `skills/reachy-app-template` | plan.md-first convention, `reachy-mini-app-assistant` CLI, `ReachyMiniApp` subclass, daemon REST/WS. Refs: plan-template, rest-api. |
| `skills/python-app-quality` | pyproject + .venv, ruff, pytest vs `MockReachyMini` (joint-limit enforcing). Refs: mock_reachy.py, pyproject-shape. |
| `skills/reachy-ops` | Operate Ricci: `ricci-up.sh` flow, clawbody restart/deploy, vault endpoint, shutdown. |
| `mac-side/ricci-up.sh` | Brings Ricci online: OpenClaw gateway → vault endpoint → clawbody on robot → verify. Installed to `~/reachy-mini-agents/`. |
| `mac-side/vault-endpoint/vault_server.py` | Read-only, token-gated HTTP server over an Obsidian vault subset (port 8890). |

## Home-network facts baked into the ops skill

| Thing | Value | Override |
|-------|-------|----------|
| Robot (CM4), ssh user `pollen` | `10.0.0.24` | `ROBOT_IP` |
| Mac | `10.0.0.9` | `MAC_IP` |
| OpenClaw gateway | `:18795` | `GATEWAY_PORT` |
| Vault endpoint | `:8890` | `VAULT_PORT` |
| Vault root | `~/Documents/ohad vault` | `VAULT_ROOT` |
| Vault allowlist | `projects/Reachy Mini:DeeperDive` | `VAULT_ALLOW` |

If the LAN changes, either export the env overrides before `ricci-up.sh` or
edit the topology table in `skills/reachy-ops/SKILL.md` and the agent file.

## Secrets (NOT in this repo — create on the new machine)

- `~/.reachy_vault_token` — any random string; the vault endpoint and
  `ricci-up.sh` read it. `openssl rand -hex 24 > ~/.reachy_vault_token`
- `~/.openclaw_openai_key` — OpenAI key for the OpenClaw gateway.
- Passwordless ssh to `pollen@10.0.0.24` (`ssh-copy-id`).

## Related repos

- `ohadlevi22/reachy-mini-agents` — clawbody (voice app, robot-side), OpenClaw
  skill, tutorial, sample apps. The skills here were originally authored there;
  this pack is the canonical Claude Code install now.
- Fork of `clawbody/reachy-claw` — robot brain.
- Obsidian: `projects/Reachy Mini/` — spec and design notes.

## Known constraint

SSH to the robot is blocked inside the Claude Code sandbox. The agent hands you
copy-paste `ssh pollen@10.0.0.24 …` commands to run via the `!` prefix; Mac-side
actions run directly.
