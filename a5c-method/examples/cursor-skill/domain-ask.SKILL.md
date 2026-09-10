---
name: domain-ask
description: >-
  Evidence-gated how-it-works Q&A using the active .a5c domain pack (CONTEXT,
  skills, codebasePath, live config). Use when the user asks how something works
  and needs a trustworthy, cited answer — not chat memory. Triggers: /domain-ask,
  "how does X work", domain ask, evidence-gated answer.
---

# Domain Ask

Answer product/code questions with **evidence** from the active domain pack, real codebase, and **live config** (when flag-gated). Loop until ask scorers all clear ≥ 90 (or report what failed).

## Setup (read first)

Run from the repo that contains `.a5c/` (this config repo) or set `A5C_ROOT`.

```bash
node -e "
const { loadDomain } = require(require('path').resolve('.a5c/core/lib/load-domain.js'));
const d = loadDomain({ fromDir: process.cwd(), goal: process.argv[1] || '' });
console.log(JSON.stringify({
  domain: d.domainId,
  codebasePath: d.codebasePath,
  hasLiveConfig: d.hasLiveConfig,
  configStores: (d.configSources?.stores || []).map(s => s.id),
  askScorers: d.askScorers.map(s => s.id),
  skills: d.domainContext.expandedSkillIds,
}, null, 2));
" "<USER_QUESTION>"
```

Use `domainContext.contextMarkdown`, `expandedDocsMarkdown`, `configSources`, and `codebasePath` for all research.

## Loop

1. **Research** (coding model if available; otherwise this agent):
   - Work under `codebasePath`
   - Read domain CONTEXT + expanded skill docs
   - **Live config (required when flag-gated):** use `domainContext.configSources`
     - Tool: Cursor MCP `multi-sql-mcp` (`sql_execute_query`) or CLI `multi-sql-mcp test query …`
     - Query `publisher_config` / `common.config` for relevant attributes (see `knownAttributes`)
     - Prefer equality filters — never `LIKE '%…%'` on `publisher_config`
     - Distinguish Java Proxy fallback vs common setting vs per-pub override
   - Produce `answerMarkdown` + `citations[]` + `configLookups[]` + `confidence`
2. **Score in parallel** (review mindset — be adversarial):
   - Load ask scorers from `loadDomain().askScorers`
   - For each: apply `rubric` + `failFast`; verify file + `db:` citations
   - Output `{ score, findings, mustFix, summary }` per scorer
3. **Gate:** every score ≥ `targetScore` (default 90). No averaging.
4. If fail: synthesize `mustFix` → refine answer → repeat (max 4–5).
5. Write artifacts under `artifacts/domain-ask/`:
   - `latest-answer.md`
   - `latest-scores.json`

## Output to user

When converged (`readyToTrust`):

1. The answer (markdown)
2. Citations + config lookups
3. Scorer table (id → score)
4. Path to `artifacts/domain-ask/latest-answer.md`

If not converged: show failing scorers + mustFix; do not claim certainty.

## Babysitter (optional)

```bash
babysitter run:create \
  --process-id domain-ask \
  --entry .a5c/core/processes/domain-ask.js#process \
  --inputs .a5c/examples/ask-cache-miss.json \
  --harness codex \
  --json
```

## Rules

- Never invent file paths, APIs, or DB rows
- Code defaults ≠ production truth until config is checked (or explicitly marked unchecked)
- Uncertainty must be explicit
- Domain pack encyclopedia ≠ substitute for opening code or querying config
- Same pack as coding (`active-domain.json`); ask uses `ask-scorers`, not PR scorers
