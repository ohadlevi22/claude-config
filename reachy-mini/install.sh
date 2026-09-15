#!/usr/bin/env bash
# Install the Reachy Mini ("Ricci") Claude Code pack.
#
#   ./install.sh            -> user scope (~/.claude), available in every project
#   ./install.sh <project>  -> project scope (<project>/.claude), matches the original layout
#
# Idempotent: re-run to refresh after a git pull.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HOME}/.claude"

say(){ printf '\033[1m==> %s\033[0m\n' "$*"; }

say "Installing Reachy Mini pack into $TARGET"
mkdir -p "$TARGET/skills/reachy-mini" "$TARGET/agents/reachy-mini" "$TARGET/commands"
rsync -a --delete "$HERE/skills/"  "$TARGET/skills/reachy-mini/"
rsync -a          "$HERE/agents/"  "$TARGET/agents/reachy-mini/"
rsync -a          "$HERE/commands/" "$TARGET/commands/"
echo "  + $(ls -1 "$HERE/skills" | wc -l | tr -d ' ') skills, 1 agent, 1 slash command"

say "Mac-side ops scripts -> ~/reachy-mini-agents"
mkdir -p "$HOME/reachy-mini-agents/vault-endpoint"
install -m 0755 "$HERE/mac-side/ricci-up.sh" "$HOME/reachy-mini-agents/ricci-up.sh"
install -m 0644 "$HERE/mac-side/vault-endpoint/vault_server.py" "$HOME/reachy-mini-agents/vault-endpoint/vault_server.py"

say "Runtime prerequisites for the OPS flow (not installed by this script)"
for f in "$HOME/.reachy_vault_token" "$HOME/.openclaw_openai_key"; do
  [ -f "$f" ] && echo "  ok      $f" || echo "  MISSING $f  (create it; see README)"
done
command -v openclaw >/dev/null && echo "  ok      openclaw CLI" || echo "  MISSING openclaw CLI"
command -v reachy-mini-app-assistant >/dev/null && echo "  ok      reachy-mini-app-assistant" || echo "  MISSING reachy-mini-app-assistant (pip install reachy-mini)"
echo
echo "Done. In Claude Code:  /personal-reachy-mini-developer-agent <request>"
