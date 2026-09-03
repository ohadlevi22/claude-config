# claude-config

Portable Claude Code setup — plugins, skills, agents, MCP servers and settings,
with nothing employer-specific in it.

```bash
git clone <this-repo> ~/claude-config && cd ~/claude-config && ./bootstrap-claude.sh
```

- **`CLAUDE-SETUP.md`** — the full inventory and manual rebuild instructions
- **`bootstrap-claude.sh`** — idempotent installer
- **`LEFT-BEHIND.md`** — what was deliberately not carried, and why
- **`portable/`** — 14 skills, 8 agents, `settings.json`, statusline script

No API keys or tokens are stored here. The bootstrap script reads them from the
environment and skips whatever isn't set.
