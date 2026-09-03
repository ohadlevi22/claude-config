# Claude Code — Portable Setup

Everything worth carrying from my old machine, with enough detail to rebuild from
scratch. Taboola-internal plugins, MCP servers, skills and history are deliberately
excluded — see `LEFT-BEHIND.md`.

**Fast path:** `./bootstrap-claude.sh` (see [Bootstrap](#bootstrap) for the env vars it wants).

Captured from Claude Code `2.1.259` on macOS, 2026-09-03.

---

## Bootstrap

```bash
git clone <this-repo> ~/claude-config
cd ~/claude-config

export CONTEXT7_API_KEY=...        # rotate; do not reuse the old key
export OBSIDIAN_VAULT="$HOME/Documents/<vault>"
export BRIGHTDATA_API_TOKEN=...    # optional
export SPOONACULAR_API_KEY=...     # optional

./bootstrap-claude.sh
```

The script is idempotent and backs up any existing `~/.claude/settings.json`.

---

## Prerequisites

| Tool | Why |
|---|---|
| `node` / `npm` | Claude Code itself, cmem hooks, most MCP servers |
| `uv` | `basic-memory` MCP and other Python-backed tools |
| `git`, `jq`, `rsync` | bootstrap script, statusline |
| `tmux` | used by a few interactive skills |
| Homebrew | how the npm globals below were installed |

Global npm packages actually used by this config:

```bash
npm i -g @anthropic-ai/claude-code @colbymchenry/cmem
# optional, personal tooling that was on the old machine:
npm i -g @openai/codex mcporter openclaw playwright chrome-remote-interface \
         langfuse-cli ts-node typescript vercel
```

```bash
uv tool install basic-memory
uv tool install nano-pdf        # optional
```

---

## Marketplaces (10, all public)

| Marketplace | Source |
|---|---|
| `superpowers-marketplace` | `obra/superpowers-marketplace` (autoUpdate) |
| `claude-plugins-official` | `anthropics/claude-plugins-official` |
| `anthropic-agent-skills` | `anthropics/skills` |
| `claude-code-plugins` | `anthropics/claude-code` |
| `claude-community` | `anthropics/claude-plugins-community` |
| `obsidian-skills` | `kepano/obsidian-skills` |
| `claude-scheduler` | `jshchnz/claude-code-scheduler` |
| `social-media-skills` | `charlie947/social-media-skills` |
| `a5c.ai` | `a5c-ai/babysitter` (autoUpdate) |
| `dev-gom-plugins` | `https://github.com/Dev-GOM/claude-code-marketplace.git` |

## Plugins (15)

Versions are what was running on the old machine — pin to these if a newer release
misbehaves, otherwise take latest.

### Superpowers family — the core of the setup

| Plugin | Ver | What it gives you |
|---|---|---|
| `superpowers` | 6.3.0 | The skill discipline itself: brainstorming, writing-plans, executing-plans, systematic-debugging, TDD, code review, git worktrees, subagent-driven development. Injects `using-superpowers` at session start. |
| `superpowers-chrome` | 3.0.5 | CDP browser control (`use_browser`) + `browser-user` subagent. |
| `superpowers-developing-for-claude-code` | 0.3.1 | Full Claude Code docs as a skill — plugins, hooks, MCP, settings. Useful whenever you build tooling. |
| `superpowers-lab` | 0.5.0 | tmux for interactive CLIs, duplicate-function finder, mcp-cli, windows-vm. |
| `elements-of-style` | 1.0.0 | Strunk's rules applied to any prose the agent writes. |
| `episodic-memory` | 1.4.2 | Searches past Claude Code / Codex conversations. **Starts empty on a new machine** — that's intentional. |

### Everything else

| Plugin | Ver | What it gives you |
|---|---|---|
| `babysitter@a5c.ai` | 6.0.3 | Process orchestration — `/babysitter:call`, `plan`, `resume`, `doctor`. The engine behind long structured runs. Public repo; the *processes* I ran on it were Taboola's and stay behind. |
| `document-skills` | (git `53048666`) | `docx`, `xlsx`, `pptx`, `pdf` creation and editing. |
| `obsidian` | 1.0.0 | JSON Canvas, Obsidian Bases, Obsidian-flavoured markdown. |
| `scheduler` | 0.2.0 | Native OS scheduling (launchd/cron) for recurring Claude runs. |
| `frontend-design` | latest | Frontend design guidance. |
| `telegram` | 0.0.7 | Telegram channel for reaching the agent. Needs a fresh bot token. |
| `browser-pilot` | 1.10.0 | Alternative CDP automation: screenshots, scraping, form filling, PDF export. |
| `social-media-skills` | 1.0.0 | Post writing, hooks, carousels, thumbnails, voice building. |
| `eli5` | 1.0.0 | `/eli5 <topic>` — dead-simple explainers. |

---

## Personal skills (14)

Twelve were installed by a skill manager into `~/.agents/skills/` and symlinked into
`~/.claude/skills/`. This bundle vendors the resolved copies, so no symlinks to fix up.
`portable/skills/.skill-lock.json` keeps the original provenance.

| Skill | Upstream | Path in repo |
|---|---|---|
| `data-storytelling` | wshobson/agents | `plugins/business-analytics/skills/data-storytelling/SKILL.md` |
| `find-skills` | vercel-labs/skills | `skills/find-skills/SKILL.md` |
| `grill-me` | mattpocock/skills | `skills/productivity/grill-me/SKILL.md` |
| `handoff` | mattpocock/skills | `skills/productivity/handoff/SKILL.md` |
| `obsidian-vault` | mattpocock/skills | `skills/personal/obsidian-vault/SKILL.md` |
| `prototype` | mattpocock/skills | `skills/engineering/prototype/SKILL.md` |
| `remotion-best-practices` | remotion-dev/skills | `skills/remotion/SKILL.md` |
| `tdd` | mattpocock/skills | `skills/engineering/tdd/SKILL.md` |
| `to-prd` | mattpocock/skills | `skills/engineering/to-prd/SKILL.md` |
| `ux-heuristics` | wondelai/skills | `ux-heuristics/SKILL.md` |
| `write-a-skill` | mattpocock/skills | `skills/productivity/write-a-skill/SKILL.md` |
| `zoom-out` | mattpocock/skills | `skills/engineering/zoom-out/SKILL.md` |
| `graphify` | self-authored | — turns any input into a persistent knowledge graph |
| `nano-banana-prompt-builder` | self-authored | — interactive image-prompt builder for Gemini 2.5 Flash Image |

> `nano-banana-prompt-builder` was 49 MB on disk because a `.browser-pilot`
> `node_modules` had been vendored inside it. That's excluded here; the skill itself
> is a few KB.

## Personal agents (8)

| Agent | Role |
|---|---|
| `bmad-analyst` | business analysis, market/competitive research, requirements |
| `bmad-architect` | architecture, distributed systems, API design, trade-offs |
| `bmad-developer` | implementation, TDD, debugging |
| `bmad-pm` | product decisions, PRDs, prioritisation |
| `bmad-tester` | test strategy, quality gates, risk-based testing |
| `bmad-code-reviewer` | critical review of commits above a base commit |
| `frontend-component-documenter` | full technical docs for a TS/React component |
| `support-researcher` | answers support questions from docs + code + QA material |

The last three had hardcoded paths to old projects; those are genericised in this copy.

---

## MCP servers

Register with `claude mcp add --scope user`. **No keys are stored in this repo.**

### Portable

| Server | Transport | Setup |
|---|---|---|
| `context7` | stdio | `npx -y @upstash/context7-mcp --api-key $CONTEXT7_API_KEY` — library docs |
| `basic-memory` | stdio | `uvx basic-memory mcp` — durable notes; new empty store |
| `obsidian` | stdio | `npx @mauricio.wolff/mcp-obsidian@latest <vault-path>` |
| `remotion` | stdio | `npx @remotion/mcp@latest` |
| `cmem` | stdio | `cmem mcp` — session memory; paired with the three hooks below |
| `mixpanel` | stdio | `npx -y mcp-remote https://mcp.mixpanel.com/mcp --allow-http` |
| `figma` | http | `https://mcp.figma.com/mcp` — OAuth, no key |
| `BrightData` | stdio | `npx @brightdata/mcp`, env `API_TOKEN` |
| `apify` | stdio | `npx mcp-remote https://mcp.apify.com/ --header "Authorization: Bearer <token>"` |
| `spoonacular` | stdio | `spoonacular-mcp`, env `SPOONACULAR_API_KEY` |

### Not carried over

`jira`, `atlassian`, `bitbucket`, `claude-network-hub`, `ada`, `mcp-server-starrocks`,
`multi-sql-mcp` — all point at Taboola infrastructure or credentials.

> **Rotate before reuse.** On the old machine the context7 and apify keys sat in
> plaintext inside `~/.claude.json` args, so treat both as exposed. Generate new ones.

---

## Settings

`portable/settings.json` → `~/.claude/settings.json`. Carried over:

- **Preferences** — `theme: dark`, `tui: fullscreen`, push-to-talk voice,
  `autoMemoryEnabled`, `autoDreamEnabled`, `skipDangerousModePermissionPrompt`,
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- **cmem hooks** — `UserPromptSubmit` consults memory, `Stop` and `PreCompact` sync it.
  Requires the `@colbymchenry/cmem` npm global.
- **Statusline** — `portable/statusline-command.sh`, a p10k-style line showing
  dir / git / user@host / model / context. Needs `jq`.
- **enabledPlugins / extraKnownMarketplaces** — the 15 + 10 above.

Dropped: the `daily-dash` SessionStart hook, the `claude-network-hub` status hook
(also pointed at a stale cached version `1.6.0` while `1.8.1` was installed), the
`bmad-agent-metrics` PostToolUse hook, and the five `team-ui` team hooks. The last two
depend on local-only directories — see `LEFT-BEHIND.md` for how to revive them if the
rescue repos come with you.

---

## Not migrated by design

Conversation history (`~/.claude/projects`, `history.jsonl`), auto-memory,
the episodic-memory index and the `~/.config/superpowers` archive all stay behind.
They're thick with previous-employer project detail and none of it helps on the new
machine. Episodic memory and cmem both rebuild themselves from day one.
