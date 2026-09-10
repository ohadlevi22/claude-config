#!/usr/bin/env bash
# ricci-up.sh — bring Ricci (Reachy Mini) fully online.
#
# Run this on your Mac AFTER powering on the robot (give it ~30-60s to boot).
# It starts: (1) the OpenClaw gateway, (2) the read-only Obsidian vault endpoint,
# (3) clawbody on the robot — then verifies the voice session comes up.
#
# Re-runnable: it kills stale copies first, so running it twice is safe.

set -uo pipefail

# ---- config (override via env if needed) ----
ROBOT_IP="${ROBOT_IP:-10.0.0.24}"
MAC_IP="${MAC_IP:-10.0.0.9}"
GATEWAY_PORT="${GATEWAY_PORT:-18795}"
VAULT_PORT="${VAULT_PORT:-8890}"
VAULT_ROOT="${VAULT_ROOT:-$HOME/Documents/ohad vault}"
VAULT_ALLOW="${VAULT_ALLOW:-projects/Reachy Mini:DeeperDive}"
VAULT_SERVER="${VAULT_SERVER:-$HOME/reachy-mini-agents/vault-endpoint/vault_server.py}"
OPENAI_KEY_FILE="${OPENAI_KEY_FILE:-$HOME/.openclaw_openai_key}"
VAULT_TOKEN_FILE="${VAULT_TOKEN_FILE:-$HOME/.reachy_vault_token}"

SSH="ssh -n -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3"
say(){ printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# ---- 0. wait for the robot daemon ----
say "0/4  Robot daemon at $ROBOT_IP:8000"
robot_ok=""
for i in $(seq 1 20); do
  if curl -s -o /dev/null --max-time 3 "http://$ROBOT_IP:8000/api/daemon/status"; then
    echo "  reachable"; robot_ok=1; break
  fi
  echo "  not up yet ($i/20)…"; sleep 3
done
[ -z "$robot_ok" ] && echo "  WARN: robot still unreachable — is it powered on and on Wi-Fi?"

# ---- 1. OpenClaw gateway (LAN-bound, valid key) ----
say "1/4  OpenClaw gateway :$GATEWAY_PORT"
openclaw config set gateway.bind lan >/dev/null 2>&1 || true
pkill -f "openclaw.*gateway" 2>/dev/null; sleep 1
OPENAI_API_KEY="$(tr -d ' \t\r\n' < "$OPENAI_KEY_FILE")" \
  nohup openclaw gateway >/tmp/oc_gw_bg.log 2>&1 &
sleep 8
if lsof -nP -iTCP:"$GATEWAY_PORT" -sTCP:LISTEN 2>/dev/null | grep -q "\*:$GATEWAY_PORT"; then
  echo "  gateway LISTEN *:$GATEWAY_PORT (LAN)"
else
  echo "  WARN: gateway not LAN-listening — see /tmp/oc_gw_bg.log"
fi

# ---- 2. Vault endpoint (read-only, allowlisted) ----
say "2/4  Vault endpoint :$VAULT_PORT  allow=[$VAULT_ALLOW]"
lsof -ti tcp:"$VAULT_PORT" 2>/dev/null | xargs kill 2>/dev/null; sleep 1
VAULT_ROOT="$VAULT_ROOT" VAULT_ALLOW="$VAULT_ALLOW" VAULT_PORT="$VAULT_PORT" \
  nohup python3 "$VAULT_SERVER" >/tmp/vault_endpoint.log 2>&1 &
sleep 2
T="$(cat "$VAULT_TOKEN_FILE" 2>/dev/null)"
if curl -s --max-time 5 "http://127.0.0.1:$VAULT_PORT/health?token=$T" | grep -q '"ok": true'; then
  echo "  vault endpoint healthy"
else
  echo "  WARN: vault endpoint not healthy — see /tmp/vault_endpoint.log"
fi

# ---- 3. clawbody on the robot ----
say "3/4  clawbody on the robot"
$SSH "pollen@$ROBOT_IP" "ps -eo pid,args | grep '[b]in/clawbody' | grep -w python | awk '{print \$1}' | xargs -r kill" 2>/dev/null
sleep 2
$SSH "pollen@$ROBOT_IP" "cd ~/clawbody && setsid /venvs/apps_venv/bin/clawbody --no-face-tracking </dev/null >/tmp/clawbody.log 2>&1 & echo '  launched'"

# ---- 4. verify the voice session ----
say "4/4  Waiting for Ricci's voice session"
ok=""
for i in $(seq 1 12); do
  sleep 5
  line="$($SSH "pollen@$ROBOT_IP" "grep -E 'session configured with|Traceback|Error' /tmp/clawbody.log | tail -1" 2>/dev/null)"
  [ -n "$line" ] && echo "  $line"
  case "$line" in
    *"session configured with"*) ok=1; break;;
  esac
done

echo
if [ -n "$ok" ]; then
  echo "✅ Ricci is UP — talk to him."
else
  echo "⚠️  No voice session confirmed yet. Check:  ssh pollen@$ROBOT_IP 'tail -30 /tmp/clawbody.log'"
fi
