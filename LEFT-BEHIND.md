# Left Behind — and why

So future-me doesn't hunt for a command that never came.

## Taboola plugins (11)

| Plugin | Marketplace | Was |
|---|---|---|
| `audience-agents` 1.9.2 | taboola-marketplace | Blake/Dana/Fiona/Ivan/Maestro/Sally/Winston/Bob-T + DeeperDive skills |
| `claude-network-hub` 1.8.1 | taboola-marketplace | internal agent hub |
| `team-review` 1.1.0 | taboola-marketplace | parallel PR review with Taboola specialists |
| `elasticsearch-logs` 1.0.0 | taboola-marketplace | internal log search |
| `langfuse-cli` 1.0.0 | taboola-marketplace | team Langfuse project |
| `deeper-dive-ps-qa` 1.0.0 | taboola-marketplace | PS/QA → R&D case intake |
| `coo-analytics` | taboola-sales-skills | internal analytics |
| `datastore` | taboola-sales-skills | internal SQL |
| `code-truth` | taboola-sales-skills | internal schema truth |
| `advertiser-spend` | taboola-sales-skills | internal spend |
| `fabric` 0.42.0 | fabric-client | internal PDLC workflow |

Project-scoped, tied to the `products` monorepo: `ads-console`, `publisher-console`,
`sdd`, `content-review-automation`, `dev-flow`.

Sources — all internal Bitbucket, unreachable from outside:
`~/llm_stuff`, `~/work/fabric-client`, `~/work/products`,
`git.taboolasyndication.com/scm/playg/taboola-sales-skills`.

## Taboola skills (8) and agents (22)

Skills: `daily-dash`, `dd-explorer`, `dd-question-classify`, `dd-serving-miss`,
`pr-nudge`, `pr-report`, `queue-check`, `slack-ask`.

Agents: `aura`, `aura-agent`, `blake`, `fiona`, `sally-t`, `taboola-ux`,
`crawler-documenter`, `crawler-support-dev-helper`, `slack-ask`,
`code-critic-reviewer` (Bitbucket-workflow-bound), and the 12 `fabric--*` agents.

All 7 user commands: `create-story`, `dd-backlog`, `dd-classify`,
`dd-reclassify-archive`, `integration-watcher-synthesize`, `push-task`, `spending`.

## MCP servers

`jira`, `atlassian`, `bitbucket`, `claude-network-hub`, `ada`,
`mcp-server-starrocks`, `multi-sql-mcp` — internal hosts and credentials.

## History and memory

`~/.claude/projects` (201 MB), `history.jsonl`, the auto-memory directory,
and `~/.config/superpowers/conversation-archive`. Deliberate: previous-employer
project detail with no value on the new machine.

## Local-only tooling — rescued to git, not installed

Three directories existed nowhere but that laptop. They were turned into git repos
so the work survives; none is wired into `settings.json` here, because each is
coupled to Taboola systems.

| Directory | What it is |
|---|---|
| `~/work/daily-dash` | PR + Epic dashboard, drove the SessionStart hook |
| `~/work/bmad_workflows/bmad-agent-metrics` | agent metrics capture, drove a PostToolUse hook |
| `~/.claude/team-ui` | "Code Crew" dashboard, drove five team lifecycle hooks |

To revive `team-ui` later, restore it to `~/.claude/team-ui` and add back the
`PostToolUse` matchers for `TeamCreate`, `Task`, `TaskUpdate` and `TeamDelete`
(`reference/original-settings.json` has the exact hook blocks).
