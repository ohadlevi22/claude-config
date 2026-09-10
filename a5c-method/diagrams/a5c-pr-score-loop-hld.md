# Babysitter A5C — Dual-Model PR Score Loop

**One-liner:** Portable quality loop + swappable domain packs → pushable PR → human code review.

![HLD diagram](./a5c-pr-score-loop-hld-v3.png)

## Flow

```mermaid
flowchart TD
  implement["1. Implement / Fix<br/>coding model · execute/fix"]
  pr["2. Branch + PR"]
  scorers["3. Parallel scorers<br/>review model"]
  gate{"ALL scorers ≥ 90?"}
  review["4. Review feedback<br/>mustFix from failures"]
  human["Ready for human CR"]

  implement --> pr --> scorers --> gate
  gate -->|YES| human
  gate -->|NO| review --> implement
```

## Locked decisions

| Topic | Choice |
|-------|--------|
| Where it runs | Your machine (babysitter / A5C only) |
| Models | Execute/fix = coding model · Review/scorers = review model |
| Gate | **Every** scorer ≥ 90 (no average) |
| Output | Real branch / PR for **human** review & merge |
| Config | `model-policy.json` + domain packs under `.a5c/domains/` |

## Plug-and-play domains

Core loop is fixed. Swap **context + scorers** via `.a5c/active-domain.json`:

- `taboola-deeperdive` — Deeper Dive CONTEXT + domain scorers (`dd-data-compat`, `dd-pipeline-fit`)
- `nvidia` — stub pack (base scorers only)

See [`.a5c/processes/README.md`](../.a5c/processes/README.md).

## Starter scorers

**Base (always):** correctness · code-quality · pr-hygiene  

**Domain (Taboola DD):** dd-data-compat · dd-pipeline-fit · java-quality  

**Skills (always):** architecture · search-engine · data · java-quality · **(optional)** omni-crawl-consumer  

Gate: **every** scorer ≥ 90 (no average).

## Feedback asks

1. Is ≥ 90 on every scorer the right bar?  
2. Are these three scorers the right dimensions?  
3. Auto-open PR, or local branch until a human asks?  
4. Max iterations: 3, 5, or leave-desk?
