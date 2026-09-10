# A5C Scorers — Declaration & Gate

![Scorers HLD](./a5c-scorers-hld.png)

**One-liner:** Judgment policy in JSON · encyclopedia in the domain pack · every scorer ≥ 90 (no average).

## Layers

| Layer | Scorers | File |
|-------|---------|------|
| Base (portable) | correctness · code-quality · pr-hygiene | `.a5c/core/base-scorers.json` |
| Domain (DD) | dd-data-compat · dd-pipeline-fit · java-quality | `.a5c/domains/taboola-deeperdive/scorers.json` |

## Each scorer declares

`id` · `kind` · `phase` · `skillRefs` · `checklistPaths` · `rubric` · `failFast` · `prompt`

**Output:** `{ score, findings[], mustFix[] }`

## Schema

See [`.a5c/core/scorer-schema.md`](../.a5c/core/scorer-schema.md).
