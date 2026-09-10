# Scorer declaration schema

A scorer is **one gate dimension**. The PR score loop does **not** average scores: every declared scorer must return `score >= targetScore` (default **90**).

```text
scorers.json entry  →  runScorerTask (review model)  →  { score, findings, mustFix }
                                                              ↓
                                                    every score >= 90?
```

**Declare judgment policy in JSON.** Product encyclopedia lives in pack `CONTEXT.md` + `skill-pointers.json`. Scorers **reference** skills/checklists and define how to turn them into a 0–100 score.

## Where declarations live

| File | Owns |
|------|------|
| `core/base-scorers.json` | Portable base scorers |
| `domains/<id>/scorers.json` | Domain overlays only |
| `core/lib/scorer-contract.js` | **Output** shape every scorer must return |

`load-domain` merges: base (ids listed in `domain.json` → `baseScorers`) + domain overlays (by id, no duplicates).

## Agent scorer fields

```json
{
  "id": "dd-data-compat",
  "kind": "agent",
  "title": "Deeper Dive data compatibility",
  "phase": "review",
  "scope": "domain",
  "skillRefs": ["deeperdive-data"],
  "checklistPaths": [
    "~/.claude/plugins/.../deeperdive-data/modes/review/checklist.md"
  ],
  "appliesWhen": "always",
  "failFast": [
    "Any clearly violated checklist item on touched paths → score < 90"
  ],
  "rubric": {
    "90": "Ready for human CR on this dimension",
    "70": "Fixable gaps; mustFix non-empty",
    "40": "Blocking design/compat issues",
    "0": "Wrong approach or unsafe to ship"
  },
  "prompt": {
    "role": "…",
    "task": "…",
    "instructions": ["…"]
  }
}
```

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | Stable key in scores history / gate |
| `kind` | yes | `agent` (LLM) or `shell` (command → score JSON) |
| `title` | yes | Human-readable label |
| `phase` | yes | Model-policy phase (`review`) |
| `scope` | no | `base` \| `domain` (docs only) |
| `skillRefs` | no | Pack `skill-pointers.json` ids this scorer must use |
| `checklistPaths` | no | Authoritative checklist files (pass/fail items) |
| `appliesWhen` | no | `always` for now; filters can mirror optional skills later |
| `failFast` | no | Conditions that force score below target (e.g. any CRITICAL) |
| `rubric` | recommended | Score-band meanings; calibrate “90 = human-CR ready” |
| `prompt` | yes (agent) | `role` / `task` / `instructions` for `runScorerTask` |
| `shell` | yes (shell) | `{ "command": "…" }` producing scorer output JSON |
| `outputSchema` | no | Defaults to shared contract in `scorer-contract.js` |

## Codebase path

Scorers and implementers must verify against the **product tree**, not memory.

Declared on the domain pack (`domain.json` → `codebasePath`), e.g. Taboola Deeper Dive → `/Users/ohad.l/work/products`.

Injected into every scorer as `context.codebasePath` and as task `workdir`. Correctness (and other scorers) must read/diff real files under that root.

## Required output (every scorer)

```json
{
  "score": 0,
  "findings": [{ "severity": "error", "message": "…", "path": "optional/file" }],
  "mustFix": ["concrete fix item"],
  "summary": "optional one-liner"
}
```

- `score`: number 0–100  
- `findings`: array (may be empty)  
- `mustFix`: array of strings (blockers for the next fix iteration)  
- `summary`: optional  

Validated by `core/lib/scorer-contract.js`.

## Base vs domain

| Layer | Examples | Rules |
|-------|----------|--------|
| **Base** | `correctness`, `code-quality`, `pr-hygiene` | Portable; no company-specific rules |
| **Domain** | `dd-data-compat`, `dd-pipeline-fit`, `java-quality` | Pack-specific; reference pack skills |

Do **not** put Taboola Java rules in base `code-quality` — that stays in domain `java-quality`.

## What not to put in scorers

- Full skill bodies / architecture essays  
- Model IDs (`model-policy.json`)  
- Weighted averages / single “overall score”  
- Product primer (`CONTEXT.md`)

## Shell scorers (later)

```json
{
  "id": "unit-tests",
  "kind": "shell",
  "title": "Unit tests",
  "phase": "review",
  "scope": "base",
  "shell": { "command": "…" }
}
```

Command stdout/result must still satisfy the output contract (`score`, `findings`, `mustFix`).

## Runtime wiring

`runScorerTask` injects into the agent context:

- `skillRefs`, `checklistPaths`, `rubric`, `failFast`  
- plus `goal`, `requirements`, `domain`, `pr`, `impl`  

Instructions from `prompt.instructions` are appended with shared calibration lines (90+ = ready for human CR on this dimension).

## Ask vs code scorers

| Mode | Base file | Purpose |
|------|-----------|---------|
| Code / PR | `core/base-scorers.json` | correctness · code-quality · pr-hygiene |
| Ask / Q&A | `core/ask-scorers.json` | evidence · faithfulness · completeness · live-config |

Domain packs may add overlays via `scorers.json` (code) and `ask-scorers.json` (ask). Same output contract and ≥ 90 gate. Process: `domain-ask`.

## Live config (ask)

When runtime flags can change the answer, treat DB config like code:

| Piece | Role |
|-------|------|
| `domains/<id>/config-sources.json` | Connections, stores, known attributes, query rules, citation format |
| `domainContext.configSources` / `hasLiveConfig` | Injected by `loadDomain` into research + scorers |
| Ask scorer `live-config` | Fails answers that assert prod flag behavior without `configLookups` |

Citation form: `db:<connection>/<database>.<table>#<attribute-or-name>`.

## Illustration

Shareable diagram: [`cursor-learning/diagrams/a5c-scorers-hld.png`](../../cursor-learning/diagrams/a5c-scorers-hld.png)
