# A5C method — domain packs, dual loops, evidence gate

Portable copy of the **Babysitter/A5C** domain workflow used for:

1. **Code** — implement → PR → parallel scorers → fix until every scorer ≥ 90  
2. **Ask** — research codebase + skills + **live config** → parallel ask scorers → refine until ≥ 90  

Take this folder into any “best place” repo: copy `.a5c/` to that project root (or set `A5C_ROOT`), plug a domain pack, point `codebasePath` at the product tree.

## Layout

```text
a5c-method/
  README.md                 ← you are here
  diagrams/                 ← HLDs (PNG + Mermaid sources)
  examples/
    inputs/                 ← sample babysitter run inputs
    cursor-skill/           ← /domain-ask skill example
  .a5c/                     ← drop-in infra
    active-domain.json
    config/                 ← defaults + example model-policy
    core/                   ← processes, scorers, load-domain, contracts
    processes/              ← re-exports + runbook
    examples/               ← same inputs as examples/inputs
    domains/
      _template/            ← start here for a new company/product
      taboola-deeperdive/   ← worked EXAMPLE (CONTEXT, scorers, config-sources)
      nvidia/               ← stub EXAMPLE
```

## Illustrations

| Diagram | File |
|---------|------|
| PR score loop (canonical) | [`diagrams/a5c-pr-score-loop-hld-v3.png`](./diagrams/a5c-pr-score-loop-hld-v3.png) |
| Scorer declaration / gate | [`diagrams/a5c-scorers-hld.png`](./diagrams/a5c-scorers-hld.png) |
| Domain ask (+ live config) | [`diagrams/a5c-domain-ask-hld.png`](./diagrams/a5c-domain-ask-hld.png) |

Markdown companions sit next to each PNG.

## Two gates (same domain pack)

| Flow | Entry | Gate |
|------|-------|------|
| Code | `.a5c/core/processes/pr-score-convergence.js#process` | PR scorers all ≥ 90 |
| Ask | `.a5c/core/processes/domain-ask.js#process` | Ask scorers all ≥ 90 |

**No averaging.** Failures return `mustFix` and the loop continues.

Ask scorers (base): `evidence` · `faithfulness` · `completeness` · `live-config`  
Domain overlays (example): `dd-architecture-accuracy`, etc.

## Configuration examples

| What | Where |
|------|--------|
| Switch active pack | `.a5c/active-domain.json` |
| Model IDs (personal) | `.a5c/config/model-policy.json` |
| Defaults (targetScore, maxIterations) | `.a5c/config/defaults.json` |
| New domain from scratch | `.a5c/domains/_template/` |
| Worked Taboola DD pack | `.a5c/domains/taboola-deeperdive/` |
| Live DB config (flags) | `…/config-sources.json` |
| Ask run inputs | `examples/inputs/*.json` or `.a5c/examples/` |
| Cursor in-session ask | `examples/cursor-skill/domain-ask.SKILL.md` → `.cursor/skills/domain-ask/SKILL.md` |

### Domain pack contract

Each domain needs:

- `domain.json` — `codebasePath`, scorer lists, optional `configSourcesFile`
- `CONTEXT.md` + `conventions.md`
- `skill-pointers.json`
- `scorers.json` (code overlays) + `ask-scorers.json` (ask overlays)
- Optional `config-sources.json` — when flags can change the answer

Core loop code stays fixed; **only the pack changes** per company/product.

## Quick start elsewhere

```bash
# 1) Copy infra
cp -R a5c-method/.a5c /path/to/your-best-place/
cp -R a5c-method/examples/cursor-skill/domain-ask.SKILL.md \
  /path/to/your-best-place/.cursor/skills/domain-ask/SKILL.md

# 2) Point at your product tree
# edit domains/<your-id>/domain.json → codebasePath

# 3) Set active domain + models
# edit active-domain.json and config/model-policy.json

# 4) Smoke-load
cd /path/to/your-best-place
node -e "
const { loadDomain } = require('./.a5c/core/lib/load-domain.js');
const d = loadDomain({ fromDir: process.cwd(), goal: 'smoke' });
console.log(d.domainId, d.codebasePath, d.askScorers.map(s => s.id));
"
```

Babysitter (optional):

```bash
babysitter run:create \
  --process-id domain-ask \
  --entry .a5c/core/processes/domain-ask.js#process \
  --inputs .a5c/examples/ask-cache-miss.json \
  --harness codex \
  --json
```

## Design rules (short)

- Encyclopedia lives in pack CONTEXT + skills — not pasted into scorers  
- Scorers declare **judgment policy** (`rubric`, `failFast`, `skillRefs`)  
- Ask: cite real files under `codebasePath`; for flag-gated claims also query live config (`db:…` citations + `configLookups`)  
- Code defaults ≠ production truth until config is checked  

Full runbook: [`.a5c/processes/README.md`](./.a5c/processes/README.md)  
Scorer schema: [`.a5c/core/scorer-schema.md`](./.a5c/core/scorer-schema.md)

## Note on examples

`taboola-deeperdive` and sample `codebasePath` / `config-sources` tool paths are **worked examples** from a real setup. Replace paths, skill locations, and SQL connections when you adopt this elsewhere.
