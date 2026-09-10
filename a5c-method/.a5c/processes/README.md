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
    ask-scorers.json           # ask gate (evidence / faithfulness / completeness)
    scorer-schema.md
    lib/load-domain.js
    lib/scorer-contract.js
    processes/pr-score-convergence.js
    processes/domain-ask.js
  domains/
    taboola-deeperdive/        # + ask-scorers.json + config-sources.json
    nvidia/
    _template/
```

## Codebase path (critical)

Each domain pack declares where coding **and** ask-verification must operate:

```json
"codebasePath": "/Users/ohad.l/work/products"
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

Live config (feature flags / `publisher_config` / `common.config`) is **first-class evidence**. Declared per domain in `config-sources.json` and loaded into `domainContext.configSources`. Java Proxy defaults alone are not production truth.

```bash
babysitter run:create \
  --process-id domain-ask \
  --entry .a5c/core/processes/domain-ask.js#process \
  --inputs .a5c/examples/ask-cache-miss.json \
  --harness codex \
  --json
```

Example inputs live in [`.a5c/examples/`](../examples/).

In Cursor, invoke the project skill **`/domain-ask`** (see [`.cursor/skills/domain-ask/SKILL.md`](../../.cursor/skills/domain-ask/SKILL.md)) to run the same evidence loop in-session.

Or:

```text
/babysitter:call answer with domain-ask: How does QuestionGenerationPipeline pick the LLM provider?
```

**Ask scorers (base):** `evidence` · `faithfulness` · `completeness` · `live-config`  
**Taboola DD overlay:** `dd-architecture-accuracy`

Tool for Taboola flags: `multi-sql-mcp` → `mysql-prod` (`trc.publisher_config`, `common.config`).

Artifacts land in `artifacts/domain-ask/` (`latest-answer.md`, `latest-scores.json`).  
`readyToTrust: true` only when all ask scorers ≥ target.

**Illustration:** [`cursor-learning/diagrams/a5c-domain-ask-hld.png`](../../cursor-learning/diagrams/a5c-domain-ask-hld.png)

## Switch domain (plug and play)

Edit [`active-domain.json`](../active-domain.json):

```json
{ "domain": "taboola-deeperdive" }
```

or:

```json
{ "domain": "nvidia" }
```

Override for one run: pass input `domain`, or set `A5C_DOMAIN=nvidia`.

What changes between domains: **CONTEXT + conventions + skill pointers + domain scorers**.  
What stays: the loop, gate (all ≥ target), model policy, PR mechanics.

## Models

[`config/model-policy.json`](../config/model-policy.json):

```json
{
  "execute": "gpt-5.6-sol",
  "fix": "gpt-5.6-sol",
  "review": "fable"
}
```

Or via babysitter:

```text
/babysitter:model set execute=gpt-5.6-sol fix=gpt-5.6-sol review=fable
```

Replace slugs with whatever your harness accepts.

## Add a new domain pack

```bash
cp -R .a5c/domains/_template .a5c/domains/my-product
# edit domain.json id/name/product, CONTEXT.md, conventions.md
# add domain-only scorers in scorers.json (base scorers are merged automatically)
# optional skill-pointers.json
echo '{ "domain": "my-product" }' > .a5c/active-domain.json
```

## Run

From a coding repo (with this `.a5c` copied or available):

```bash
npx -y @a5c-ai/babysitter-sdk@0.0.173 version --json
```

```text
/babysitter:call implement <goal> with pr-score-convergence targetScore 90
```

CLI:

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
  "goal": "Fix serving cache miss path for publisher X",
  "requirements": ["Keep Cassandra reads backward-compatible"],
  "targetScore": 90,
  "maxIterations": 5
}
```

## Scorer merge

1. Base scorers from [`core/base-scorers.json`](../core/base-scorers.json): `correctness`, `code-quality`, `pr-hygiene`
2. Domain overlays from `domains/<id>/scorers.json` (Taboola DD: `dd-data-compat`, `dd-pipeline-fit`, `java-quality`)
3. Gate: **every** scorer score ≥ `targetScore` (no averaging)

Declaration schema (fields, rubric, failFast, output contract): [`core/scorer-schema.md`](../core/scorer-schema.md).

Optional skill pointers (e.g. `search-engine-omni-crawl-consumer`) load only when the goal/requirements match `loadIfGoalMatches`.

## Output

When converged: real branch / PR ready for **human** code review. Automated scorers are a gate, not a merge approval.
