# nvidia-tech-and-business

Notes for ramping onto NVIDIA Networking / DOCA (diagnostics tools team). Technical and business context, written for a backend/distributed-systems engineer moving down the stack.

## Contents

- **`component-dictionary-what-can-break-in-a-rack.md`** — every component a byte touches from GPU to GPU across nodes, one row each: job, failure mode, symptom, what to read, tool. Six layers (host, adapter, link, switch, fabric, tooling), a symptom→rows index, and a day-one top-10.

- **`networking-diagnostics-glossary.md`** — term-by-term glossary (~260 rows) grouped by chapter: products, software stack, RDMA, fabric behavior, physical layer, Linux debug surface, toolchain, supply chain, competitive landscape, DOCA/BlueField.

## Related

- Full guided kit (business B-series, technical C-series, deep dives, DOCA E-series) lives in [ohadlevi22/nvidia-rampup](https://github.com/ohadlevi22/nvidia-rampup), deployed at nvidia-networking-site.vercel.app.
- DOCA codebase explorer agent: [ohadlevi22/nvidia-my-agents-setup](https://github.com/ohadlevi22/nvidia-my-agents-setup).

Wikilinks (`[[...]]`) in the notes resolve inside the Obsidian vault / nvidia-rampup site, not here.
