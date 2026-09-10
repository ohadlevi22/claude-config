# Taboola Deeper Dive — Product Context

DeeperDive is Taboola's content Q&A feature. The backend generates questions and answers for publisher articles using LLMs, stores them in Cassandra, and serves them via REST. It also supports regeneration of individual questions and article gist generation.

## Three services

### trs-search-engine (API gateway)
- REST under `/trs/organic-topics/user/`
- Cache path: Caffeine (~1s) → Memcached (~907s) → Cassandra
- On cache miss, publishes Kafka to trigger async question generation
- SSE streaming for user queries (`get-user-query-stream`)

### search-engine-qna (core pipeline)
- Kafka consumer on `generated_questions` (Protobuf)
- `ValidationPipeline` then `QuestionGenerationPipeline` / `QuestionRegenerationPipeline`
- ROP (Railway-Oriented Programming) with Vavr `Either`
- Management endpoints under `/manage/qna/`

### trs-llm-gateway (LLM proxy)
- OpenAI-compatible `/llm-gateway/v1/chat/completions`
- Two-tier cache: Memcached → Cassandra
- Circuit breakers, virtual models, rate limiting per provider

## Non-negotiables

- Cassandra / Kafka Proto changes must stay backward-compatible
- Cache TTL choices are deliberate (Caffeine 1s, Memcached 907s); do not “fix” them casually
- `publisher_id` type consistency (Int vs Long) matters across stores
- Prefer extending existing pipelines/validation stages over inventing side paths
- **Live flags matter:** `trc.publisher_config` + `common.config` can override Java defaults (similar articles, fail-on-no-articles, caps). Ask flow must verify via `config-sources.json` / multi-sql-mcp — code defaults alone are not production truth.

## Authoritative deeper docs

**Codebase (required for coding + scorer verification):** `/Users/ohad.l/work/products`  
Set in `domain.json` as `codebasePath`. Override with `A5C_CODEBASE_PATH` / `PRODUCTS_REPO` or run input `codebasePath`.

**Live config:** `config-sources.json` (multi-sql-mcp → `mysql-prod`).

Do not paste full handbooks here. Load skill pointers from `skill-pointers.json`:

| Skill | Always / optional |
|-------|-------------------|
| deeperdive-architecture | Always — fit / boundaries |
| deeperdive-search-engine | Always — pipeline / API / gateway |
| deeperdive-data | Always — Cassandra / Kafka / cache |
| java-quality | Always — Taboola Java/Spring rules |
| search-engine-omni-crawl-consumer | Optional — only when goal/PR mentions omni indexing |
