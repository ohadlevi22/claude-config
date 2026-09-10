A personal Reachy Mini ("Ricci") developer + operator.

Invoke the `personal-reachy-mini-developer-agent` subagent (defined at .claude/agents/reachy-mini/personal-reachy-mini-developer-agent.md) via the Agent tool, passing the user's request as the task: $ARGUMENTS

The agent handles two modes:
- DEV — build, scaffold, or debug a Reachy Mini app or behavior (voice, vision, motion, emotions, dances).
- OPS — power Ricci on via ricci-up.sh, deploy/restart the clawbody brain, read the Obsidian vault, and shut down.

IMPORTANT — robot SSH to Ricci (10.0.0.24) must be run by the user via the `!` prefix, since the sandbox blocks ssh; the agent hands over copy-paste commands and reads back the output. Mac-side actions (gateway, vault endpoint, ricci-up.sh) run directly.
