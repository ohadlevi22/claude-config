#!/usr/bin/env bash
# Rebuild the portable Claude Code setup on a fresh machine.
# Idempotent: safe to re-run. Never overwrites an existing settings.json without backing it up.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }

command -v claude >/dev/null || { warn "claude CLI not found. Install it first: npm i -g @anthropic-ai/claude-code"; exit 1; }

# ---------------------------------------------------------------- prerequisites
say "Checking prerequisites"
for c in node npm git jq rsync; do
  command -v "$c" >/dev/null || warn "missing: $c"
done
command -v uv  >/dev/null || warn "missing: uv (needed for basic-memory MCP)"
command -v tmux >/dev/null || warn "missing: tmux (optional, used by some skills)"

# ---------------------------------------------------------------- marketplaces
say "Adding marketplaces"
add_mp() {
  claude plugin marketplace add "$1" >/dev/null 2>&1 && echo "  + $1" || echo "  = $1 (already present)"
}
add_mp obra/superpowers-marketplace
add_mp anthropics/claude-plugins-official
add_mp anthropics/skills
add_mp anthropics/claude-code
add_mp anthropics/claude-plugins-community
add_mp kepano/obsidian-skills
add_mp jshchnz/claude-code-scheduler
add_mp charlie947/social-media-skills
add_mp a5c-ai/babysitter
add_mp https://github.com/Dev-GOM/claude-code-marketplace.git

# ---------------------------------------------------------------- plugins
say "Installing plugins"
install_pl() {
  claude plugin install "$1" >/dev/null 2>&1 && echo "  + $1" || echo "  = $1 (already installed or failed — check manually)"
}
install_pl superpowers@superpowers-marketplace
install_pl superpowers-chrome@superpowers-marketplace
install_pl superpowers-developing-for-claude-code@superpowers-marketplace
install_pl elements-of-style@superpowers-marketplace
install_pl superpowers-lab@superpowers-marketplace
install_pl episodic-memory@superpowers-marketplace
install_pl browser-pilot@dev-gom-plugins
install_pl document-skills@anthropic-agent-skills
install_pl obsidian@obsidian-skills
install_pl scheduler@claude-scheduler
install_pl babysitter@a5c.ai
install_pl frontend-design@claude-plugins-official
install_pl telegram@claude-plugins-official
install_pl social-media-skills@social-media-skills
install_pl eli5@claude-community

# ---------------------------------------------------------------- files
say "Installing skills, agents, statusline"
mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents"
rsync -a "$REPO/portable/skills/"  "$CLAUDE_DIR/skills/"
rsync -a "$REPO/portable/agents/"  "$CLAUDE_DIR/agents/"
install -m 0755 "$REPO/portable/statusline-command.sh" "$CLAUDE_DIR/statusline-command.sh"
echo "  + $(ls -1 "$REPO/portable/skills" | grep -cv skill-lock) skills, $(ls -1 "$REPO/portable/agents" | wc -l | tr -d ' ') agents"

say "Installing settings.json"
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  cp "$CLAUDE_DIR/settings.json" "$CLAUDE_DIR/settings.json.bak.$(date +%Y%m%d%H%M%S)"
  echo "  backed up existing settings.json"
fi
cp "$REPO/portable/settings.json" "$CLAUDE_DIR/settings.json"

# ---------------------------------------------------------------- npm/uv tools
say "Installing CLI tools used by hooks and skills"
npm i -g @colbymchenry/cmem @anthropic-ai/claude-code >/dev/null 2>&1 \
  && echo "  + cmem (memory hooks)" || warn "npm global install failed — run manually"
if command -v uv >/dev/null; then
  uv tool install basic-memory >/dev/null 2>&1 && echo "  + basic-memory" || echo "  = basic-memory"
fi

# ---------------------------------------------------------------- MCP servers
say "Registering MCP servers"
# Keys are read from the environment. Export them before running, or add the
# servers by hand afterwards. Nothing secret is stored in this repo.
mcp_add() { claude mcp add --scope user "$@" >/dev/null 2>&1 && echo "  + $1" || echo "  = $1 (already present)"; }

[ -n "${CONTEXT7_API_KEY:-}" ] \
  && mcp_add context7 -- npx -y @upstash/context7-mcp --api-key "$CONTEXT7_API_KEY" \
  || warn "CONTEXT7_API_KEY unset — skipping context7"

mcp_add basic-memory -- uvx basic-memory mcp
mcp_add remotion     -- npx @remotion/mcp@latest
mcp_add cmem         -- cmem mcp
mcp_add mixpanel     -- npx -y mcp-remote https://mcp.mixpanel.com/mcp --allow-http

if [ -n "${OBSIDIAN_VAULT:-}" ]; then
  mcp_add obsidian -- npx @mauricio.wolff/mcp-obsidian@latest "$OBSIDIAN_VAULT"
else
  warn "OBSIDIAN_VAULT unset — skipping obsidian (set it to your vault path)"
fi

[ -n "${BRIGHTDATA_API_TOKEN:-}" ] \
  && mcp_add BrightData --env "API_TOKEN=$BRIGHTDATA_API_TOKEN" -- npx @brightdata/mcp \
  || warn "BRIGHTDATA_API_TOKEN unset — skipping BrightData"

[ -n "${SPOONACULAR_API_KEY:-}" ] \
  && mcp_add spoonacular --env "SPOONACULAR_API_KEY=$SPOONACULAR_API_KEY" -- spoonacular-mcp \
  || warn "SPOONACULAR_API_KEY unset — skipping spoonacular"

say "Done. Run 'claude' and check /plugin and /mcp."
echo "Figma MCP (OAuth, no key) if you want it:  claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp"
