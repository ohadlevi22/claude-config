# A5C method — domain packs, dual loops, evidence gate

Portable **Babysitter/A5C** workflow infra:

1. **Code** — implement → PR → parallel scorers → fix until every scorer ≥ 90  
2. **Ask** — research codebase + skills + **live config** → parallel ask scorers → refine until ≥ 90  

Copy `.a5c/` into your best-place repo (or set `A5C_ROOT`), add a domain pack from `_template`, set `codebasePath`.

**This pack is reusable only** — no company product CONTEXT. Domain knowledge stays in *your* packs.

## Layout

```text
a5c-method/
  README.md
  diagrams/                 ← HLDs (PNG + Mermaid sources)
  examples/
    inputs/                 ← sample babysitter run inputs
    cursor-skill/           ← /domain-ask skill example
  .a5c/                     ← drop-in infra
    active-domain.json      → example-domain
    config/                 ← defaults + example model-policy
    core/                   ← processes, scorers, load-domain, contracts
    processes/              ← re-exports + runbook
    examples/               ← same inputs as examples/inputs
    domains/
      _template/            ← start here for a new product
      example-domain/       ← generic placeholder pack
```

## Illustrations

| Diagram | File |
|---------|------|
| PR score loop | [`diagrams/a5c-pr-score-loop-hld-v3.png`](./diagrams/a5c-pr-score-loop-hld-v3.png) |
| Scorer declaration / gate | [`diagrams/a5c-scorers-hld.png`](./diagrams/a5c-scorers-hld.png) |
| Domain ask (+ live config) | [`diagrams/a5c-domain-ask-hld.png`](./diagrams/a5c-domain-ask-hld.png) |

## Two gates (same domain pack)

| Flow | Entry | Gate |
|------|-------|------|
| Code | `.a5c/core/processes/pr-score-convergence.js#process` | PR scorers all ≥ 90 |
| Ask | `.a5c/core/processes/domain-ask.js#process` | Ask scorers all ≥ 90 |

**No averaging.** Failures return `mustFix` and the loop continues.

Ask scorers (base): `evidence` · `faithfulness` · `completeness` · `live-config`

## Configuration examples

| What | Where |
|------|--------|
| Switch active pack | `.a5c/active-domain.json` |
| Model IDs (personal) | `.a5c/config/model-policy.json` |
| Defaults | `.a5c/config/defaults.json` |
| New domain | copy `.a5c/domains/_template` → `.a5c/domains/<id>` |
| Live config (optional) | `domains/<id>/config-sources.json` |
| Ask run inputs | `examples/inputs/*.json` |
| Cursor skill | `examples/cursor-skill/domain-ask.SKILL.md` |

## Quick start elsewhere

```bash
cp -R a5c-method/.a5c /path/to/your-best-place/
mkdir -p /path/to/your-best-place/.cursor/skills/domain-ask
cp a5c-method/examples/cursor-skill/domain-ask.SKILL.md \
  /path/to/your-best-place/.cursor/skills/domain-ask/SKILL.md

# edit domains/<your-id>/domain.json → codebasePath
# edit active-domain.json + config/model-policy.json

cd /path/to/your-best-place
node -e "
const { loadDomain } = require('./.a5c/core/lib/load-domain.js');
const d = loadDomain({ fromDir: process.cwd(), goal: 'smoke' });
console.log(d.domainId, d.codebasePath, d.askScorers.map(s => s.id));
"
```

## Design rules (short)

- Encyclopedia lives in pack CONTEXT + skills — not pasted into scorers  
- Scorers declare **judgment policy** (`rubric`, `failFast`, `skillRefs`)  
- Ask: cite real files under `codebasePath`; for flag-gated claims also verify live config  
- Code defaults ≠ production truth until config is checked  

Full runbook: [`.a5c/processes/README.md`](./.a5c/processes/README.md)  
Scorer schema: [`.a5c/core/scorer-schema.md`](./.a5c/core/scorer-schema.md)
