# A5C Domain Ask — Evidence-Gated Q&A

![Domain Ask HLD](./a5c-domain-ask-hld.png)

**One-liner:** Same domain pack as coding · cite the real codebase · every ask scorer ≥ 90.

## Flow

```mermaid
flowchart TD
  q[Question]
  research[Research code + skills + live config]
  scorers[Ask scorers parallel]
  gate{All ask scorers >= 90?}
  trust[Trustworthy answer]
  refine[mustFix feedback]

  q --> research --> scorers --> gate
  gate -->|YES| trust
  gate -->|NO| refine --> research
```

## Ask scorers

| Layer | Scorers |
|-------|---------|
| Base | evidence · faithfulness · completeness · live-config |
| Taboola DD | dd-architecture-accuracy |

**Live config:** domain `config-sources.json` (e.g. `multi-sql-mcp` → `trc.publisher_config` / `common.config`). Flag-gated claims need `configLookups` + `db:` citations — Java defaults alone fail `live-config`.

## Related

- Process: [`.a5c/core/processes/domain-ask.js`](../.a5c/core/processes/domain-ask.js)
- Runbook: [`.a5c/processes/README.md`](../.a5c/processes/README.md)
- Code loop diagram: [`a5c-pr-score-loop-hld-v3.png`](./a5c-pr-score-loop-hld-v3.png)
- Scorers diagram: [`a5c-scorers-hld.png`](./a5c-scorers-hld.png)
