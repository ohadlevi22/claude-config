# Cursor 3 Pro Guide: Must-Haves, Workflows, and Leverage

**Cursor 3** is agent-first: the win is orchestrating many agents (Agents Window, worktrees, cloud, Design Mode)—not one smarter chat. Must-haves first, then pro habits.

Primary sources: [Changelog 3.0](https://cursor.com/changelog/3-0) · [Agents Window](https://cursor.com/docs/agent/agents-window.md) · [Customize](https://cursor.com/docs/customize-cursor.md) · [Agent overview](https://cursor.com/docs/agent/overview.md)

---

## Must-haves

1. **Agents Window** — `Cmd/Ctrl+Shift+P` → “Open Agents Window”. Parallel local / worktree / cloud agents, diffs, commit/PR, handoff. Keep the IDE for deep editing.
2. **Customize panel** — rules, skills, MCP, plugins, hooks in one place. Install only what you use.
3. **Project memory**
   - `AGENTS.md` at the repo root (how to run/test, architecture do/don’t, pointers to key files)
   - Thin `.cursor/rules/*.mdc` when the agent keeps repeating the same mistake
4. **Modes** (`Shift+Tab`) — Agent / Plan / Ask / Debug. Wrong mode wastes more than the wrong model.
5. **MCP (2–5 max)** — tools you already live in (Jira, GitHub, docs, Datadog, Figma). Unused MCP burns context.
6. **Skills** — package repeatable plays (`/create-skill`). Sync skills for cloud agents in Settings.
7. **Worktrees setup** — `.cursor/worktrees.json` so `/worktree` and `/best-of-n` actually boot cleanly.

### Core shortcuts

| Action | Mac | Win/Linux |
| --- | --- | --- |
| Toggle Agent sidepanel | `Cmd+I` / `Cmd+L` | `Ctrl+I` / `Ctrl+L` |
| Inline edit | `Cmd+K` | `Ctrl+K` |
| Mode menu | `Cmd+.` | `Ctrl+.` |
| Rotate Agent modes | `Shift+Tab` | `Shift+Tab` |
| Cycle models | `Cmd+/` | `Ctrl+/` |
| Accept Tab | `Tab` | `Tab` |
| Design Mode (Agents Window) | `Cmd+Shift+D` | (same family) |

**Pro habit:** Memorize `Shift+Tab` (modes) and `Cmd+/` (models). Mode + model selection is half of “using Cursor like a pro.”

---

## What Cursor 3 is (vs prior Cursor)

| Before (IDE-centric) | Cursor 3 (agent-centric) |
| --- | --- |
| Agent lived mainly in the sidepane (`Cmd/Ctrl+I`) | **Agents Window** is a full workspace for many agents |
| Parallelism was limited / awkward | Parallel agents across **local, worktrees, cloud, remote SSH** |
| Cloud agents from the Editor | Manage cloud agents from Agents Window / Cloud surfaces |
| Worktree / best-of-n as Editor pickers | **`/worktree`** and **`/best-of-n`** commands |
| UI feedback mostly via text | **Design Mode**: click/draw/voice on the live browser UI |

### Cursor 3–specific highlights

1. **Agents Window** — Multi-workspace agent hub; diffs, commit/PR, local↔cloud handoff, parallel cloud agents
2. **Design Mode** — Annotate UI, target elements (`Cmd+Shift+D`)
3. **Agent Tabs** — Multiple chats side-by-side or in a grid
4. **`/worktree`** — Isolated Git checkout for a task
5. **`/best-of-n`** — Same prompt across models, each in its own worktree, then compare
6. **Cloud subagents / autopilot** — e.g. `/in-cloud`, put a PR on `/autopilot`
7. Better long-running job monitoring, past chats in `@` search, MCP structured content

**Practical takeaway:** Use the **Agents Window** when coordinating many agents or cloud work. Use the **IDE** when you need classic VS Code extensions, multi-file layout, and deep editing. Open both at once if you want.

---

## Use it like a pro

| Situation | Move |
| --- | --- |
| Big / unclear feature | **Plan** → refine → Build |
| “How does X work?” | **Ask** (read-only) |
| Flaky / hard-to-see bug | **Debug** + real repro steps |
| Routine impl / fix | **Agent** |
| UI polish | Agents Window + **Design Mode** (`Cmd+Shift+D`) |
| Dirty tree / risky change | `/worktree …` |
| Ambiguous impl quality | `/best-of-n` across models |
| Long / leave-desk work | Cloud agent + local↔cloud handoff |
| PR babysitting | `/autopilot` |

### Context like a pro (`@` mentions)

Type `@` for:

- Files/folders: `@auth.ts`, `@src/api/`
- `@Terminals`, `@Browser`
- `@Chats` / past transcripts
- `@Commit (Diff of Working State)`, `@Branch (Diff with Main)`

**Rule:** `@` when you *know* the files. Skip `@` when you don’t—Agent’s search is better than wrong context.

Watch the **context ring** next to the input; click it to see Rules / Skills / MCP / tools token cost. Prune MCP and always-on rules if the ring stays red.

### Steering a running agent

- **Enter** — queue next instruction
- **Cmd+Enter** — send now / steer
- Steering delivers at the next tool boundary (preserves in-flight work)

After bad runs, fix `AGENTS.md`/rules instead of re-explaining forever.

### Agents Window workflow

1. Kick several agents (feature A local, bug B in `/worktree`, chore C in **Cloud**).
2. Review in the diffs view; commit/PR without leaving the window.
3. **Handoff:** cloud → local to finish/test; local → cloud so it keeps running while you leave.
4. UI work: open browser → **Design Mode** → click/draw → prompt.
5. Pin long-running chats; use demos/screenshots from cloud agents to verify without reading every line.

### Isolation & comparison

```text
/worktree fix failing auth tests without touching my dirty main tree
/best-of-n sonnet,gpt,composer implement the caching layer
```

After picking a winner: commit from the worktree or `/apply-worktree`; clean up with `/delete-worktree`.

### Parallelism

- **`/multitask`** — async subagents instead of a serial queue
- Plan → **Build in Parallel** for independent steps
- Built-in subagents: **Explore**, **Bash**, **Browser** (auto)
- Custom subagents in `.cursor/agents/`

---

## Get more value (leverage order)

1. Encode the repo once (`AGENTS.md` + nested ones in monorepos).
2. Turn stable workflows into **skills** (not giant always-on rules).
3. Default to **parallel**: explore vs implement vs review; `/multitask`; Agents Window grid.
4. **Hooks** for format, secret scans, dangerous-command gates (same gates for cloud).
5. **Team plugins** so rules/skills/MCP ship with the org.
6. **Canvas** for analytical deliverables; Design Mode for UI; Agent Review / Bugbot on PRs.
7. Model fit: fast (e.g. Composer) for UI iteration; stronger models for architecture/debug; `/best-of-n` when variance is high.

### Project memory: Rules + `AGENTS.md`

| Mechanism | Use for | Where |
| --- | --- | --- |
| **Project Rules** (`.cursor/rules/*.mdc`) | Scoped, structured conventions | Always / Intelligent / Globs / Manual |
| **`AGENTS.md`** | Simple, readable project playbook | Root + nested dirs |
| **User Rules** | Personal tone/prefs across repos | Customize → Rules |
| **Team Rules** | Org standards (Teams/Enterprise) | Dashboard |

**Must-have content (keep short):**

- How to run/test the app
- Architecture “do / don’t”
- Style only where linters can’t encode it
- Pointers to canonical files (`@path`) instead of pasting huge guides

Start with one `AGENTS.md`. Add `.mdc` rules when Agent repeats the same mistake.

### Skills (workflows on demand)

Skills live in `.cursor/skills/` or `.agents/skills/` (and user `~/.cursor/skills/`). Invoke with `/skill-name` or let Agent pick them up.

**Built-ins worth knowing:** `/create-rule`, `/create-skill`, `/create-hook`, `/create-subagent`, `/review`, `/review-security`, `/canvas`, `/loop`, `/automate`, `/autopilot`, `/split-to-prs`, `/migrate-to-skills`.

**Cloud tip:** Settings → Agents → **Sync Skills for Cloud Agents** so personal skills travel to cloud VMs.

### MCP

Configure via Customize or `.cursor/mcp.json` / `~/.cursor/mcp.json`.

**Must-have pattern:** 2–5 high-value servers you authenticate once—not every community MCP. Prefer Team MCP / marketplace for shared setups.

### Hooks

`.cursor/hooks.json` for format-on-edit, secret scanning, policy gates. Commit so Cloud Agents get the same gates.

---

## Daily loop

1. **Agents Window** open for parallel / cloud work; IDE when editing deeply.
2. **Ask** or **Plan** before big Agent runs.
3. **`AGENTS.md` + 1–2 rules** kept current; fix Agent mistakes by updating rules, not re-prompting forever.
4. **`@`** the branch diff or key files when reviewing or finishing a PR.
5. Risky work → **`/worktree`**; ambiguous implementation → **`/best-of-n`**.
6. Long tasks → **Cloud** + handoff; PRs → **`/autopilot`**.
7. UI → **Design Mode**; analysis → **Canvas**.
8. After merge patterns stabilize → **skill** or **plugin** so the team inherits them.

---

## Doc map

| Topic | URL |
| --- | --- |
| Cursor 3 changelog | https://cursor.com/changelog/3-0 |
| Agents Window | https://cursor.com/docs/agent/agents-window.md |
| Agent overview | https://cursor.com/docs/agent/overview.md |
| Plan / Debug / Design | https://cursor.com/docs/agent/plan-mode.md · debug-mode.md · design-mode.md |
| Prompting & `@` | https://cursor.com/docs/agent/prompting.md |
| Customize | https://cursor.com/docs/customize-cursor.md |
| Rules / Skills / MCP / Hooks / Subagents | https://cursor.com/docs/rules.md · skills.md · mcp.md · hooks.md · subagents.md |
| Worktrees | https://cursor.com/docs/configuration/worktrees.md |
| Cloud Agents + best practices | https://cursor.com/docs/cloud-agent.md · cloud-agent/best-practices.md |
| Canvas | https://cursor.com/docs/agent/tools/canvas.md |
| Plugins | https://cursor.com/docs/plugins.md |
| Multi-agent help | https://cursor.com/help/ai-features/multi-agent.md |
| Shortcuts | https://cursor.com/help/customization/keyboard-shortcuts.md |
| Docs index | https://cursor.com/llms.txt |

---

**Bottom line:** Cursor 3’s distinctive power is **orchestrating many agents** (Agents Window, worktrees, cloud handoff, Design Mode)—not a single smarter chat box. The multipliers: **project memory (rules/`AGENTS.md`)**, **skills**, **MCP**, **hooks**, and **deliberate mode/model choice**. Set those up first; then run parallel isolated agents as the default workflow.
