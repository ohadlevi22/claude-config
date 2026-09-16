# A5C domain loops — how to run

Two portable flows share the same **domain pack** (CONTEXT + skills + `codebasePath`):

| Flow | Process | Gate |
|------|---------|------|
| **Code** | `pr-score-convergence` | PR scorers all ≥ 90 → human CR |
| **Ask** | `domain-ask` | Ask scorers all ≥ 90 → trustworthy answer |

Domain knowledge is **not** in the process. It lives in [`.a5c/domains/`](../domains/).

## Layout

```text
.a5c/
  active-domain.json
  config/model-policy.json
  config/defaults.json
  core/
    base-scorers.json          # coding gate
    ask-scorers.json           # ask gate
    scorer-schema.md
    lib/load-domain.js
    lib/scorer-contract.js
    processes/pr-score-convergence.js
    processes/domain-ask.js
  domains/
    _template/                 # blank starter
    example-domain/            # generic example pack
```

## Codebase path (critical)

Each domain pack declares where coding **and** ask-verification must operate:

```json
"codebasePath": "/absolute/path/to/product/repo"
```

**Resolution order:** run input `codebasePath` / `repoPath` → env `A5C_CODEBASE_PATH` → env `PRODUCTS_REPO` → `domain.json` `codebasePath`.

Implement / ask / scorer tasks set `workdir` to that path and must **read real files** there.

## Ask flow (how things work)

Use when you need an answer you can **rely on** — not chat memory.

```text
question → research in codebase + domain pack + live config → cite sources
         → ask scorers (evidence, faithfulness, completeness, live-config [+ domain])
         → all ≥ 90? → deliver answer
         → else refine with mustFix
```

Live config (feature flags / remote config stores) is **first-class evidence** when declared in the pack’s `config-sources.json`. Code defaults alone are not production truth.

```bash
babysitter run:create \
  --process-id domain-ask \
  --entry .a5c/core/processes/domain-ask.js#process \
  --inputs .a5c/examples/ask-cache-miss.json \
  --harness codex \
  --json
```

Example inputs live in [`.a5c/examples/`](../examples/).

In Cursor, copy [`examples/cursor-skill/domain-ask.SKILL.md`](../../examples/cursor-skill/domain-ask.SKILL.md) to `.cursor/skills/domain-ask/SKILL.md`.

**Ask scorers (base):** `evidence` · `faithfulness` · `completeness` · `live-config`  
**Domain overlays:** whatever you add in `domains/<id>/ask-scorers.json`

Artifacts land in `artifacts/domain-ask/` (`latest-answer.md`, `latest-scores.json`).  
`readyToTrust: true` only when all ask scorers ≥ target.

## Switch domain (plug and play)

Edit [`active-domain.json`](../active-domain.json):

```json
{ "domain": "example-domain" }
```

Override for one run: pass input `domain`, or set `A5C_DOMAIN=my-product`.

What changes between domains: **CONTEXT + conventions + skill pointers + domain scorers (+ optional config-sources)**.  
What stays: the loop, gate (all ≥ target), model policy, PR mechanics.

## Models

[`config/model-policy.json`](../config/model-policy.json) — replace slugs with whatever your harness accepts.

## Add a new domain pack

```bash
cp -R .a5c/domains/_template .a5c/domains/my-product
# edit domain.json id/name/product/codebasePath, CONTEXT.md, conventions.md
# add domain-only scorers in scorers.json / ask-scorers.json
# optional skill-pointers.json + config-sources.json
echo '{ "domain": "my-product" }' > .a5c/active-domain.json
```

## Run

```bash
babysitter run:create \
  --process-id pr-score-convergence \
  --entry .a5c/core/processes/pr-score-convergence.js#process \
  --inputs inputs.json \
  --harness codex \
  --json
```

Example `inputs.json`:

```json
{
  "goal": "Fix the cache miss path for feature X",
  "requirements": ["Keep store reads backward-compatible"],
  "targetScore": 90,
  "maxIterations": 5
}
```

## Scorer merge

1. Base scorers from [`core/base-scorers.json`](../core/base-scorers.json) / [`core/ask-scorers.json`](../core/ask-scorers.json)
2. Domain overlays from `domains/<id>/scorers.json` or `ask-scorers.json`
3. Gate: **every** scorer score ≥ `targetScore` (no averaging)

Declaration schema: [`core/scorer-schema.md`](../core/scorer-schema.md).

## Output

When converged (code flow): real branch / PR ready for **human** code review. Automated scorers are a gate, not a merge approval.
