# Deeper Dive conventions

- Follow ROP / Vavr `Either` patterns in qna pipelines; do not introduce unchecked exception-driven control flow in those paths.
- New generation/validation behavior belongs in the existing pipeline stages when possible.
- Dual-writes and schema changes: update all affected tables/topics and keep readers compatible.
- Prefer configurable lookback/TTL/feature flags over hard-coded magic numbers.
- Apply **java-quality** (Taboola Java/Spring rules) on every Java change — CRITICAL rules are blockers.
- Match the local file idiom before inventing a new style (Blake Rule 0).
- For reviews, use deeperdive-data, deeperdive-architecture, and deeperdive-search-engine checklists via skill pointers.
- If the goal/PR touches omni-crawler indexing (`omni_crawler`, omni full-text, omni consumer), also load **search-engine-omni-crawl-consumer** review conventions (coexistence / Vavr / write gates).
- Keep PRs focused: one concern (schema, serving, generation, gateway, omni indexing) when practical.
