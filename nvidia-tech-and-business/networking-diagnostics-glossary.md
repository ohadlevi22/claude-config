---
tags:
  - nvidia
  - networking
  - diagnostics
  - glossary
  - reference
  - interview-prep
---
# Networking Diagnostics Glossary

The dictionary. Every acronym in the prep map, defined for fast recall. Part of [[00 - Networking Diagnostics MOC]]. Grouped by cluster so you can drill one area at a time.

> [!note] Read the definition, then say it back in your own words. Recall > recognition.

## Products & platforms (see [[C1 - The Fabric Map]])
| Term | What it is | Why it matters |
|---|---|---|
| **NVLink 6 / NVSwitch** | Scale-**up** interconnect; GPUs inside a rack, memory-semantic (load/store) | GPUs address remote HBM like local memory; no message overhead |
| **NVL72** | A rack of 72 Rubin/Blackwell-class GPUs joined by NVLink into one NVLink domain | The "one big GPU" scale-up unit |
| **InfiniBand (Quantum-X800)** | Scale-**out** switch fabric; node-to-node, message-semantic, lossless by design | NVIDIA's premium AI fabric; SM-managed |
| **Spectrum-6 / Spectrum-X** | Scale-out **Ethernet** switch (200G/lane PAM4); Spectrum-X = Ethernet tuned for RDMA/AI | Ethernet option for AI; RoCE-based |
| **Spectrum-XGS** | Scale-**across** — datacenter-to-datacenter fabric | Ties multiple DCs into one training domain |
| **ConnectX-9** | SuperNIC — the network adapter (host NIC), RDMA/RoCE/IB engine | The endpoint your diagnostics inspect most |
| **BlueField-4 (DPU)** | Data Processing Unit = Grace Arm cores + ConnectX-9 onboard | Runs an OS; offloads networking/storage/security from host |
| **Rubin / Vera** | Rubin = next-gen GPU; Vera = the paired Arm CPU | Codesigned compute half of the platform |
| **LinkX** | NVIDIA's cables and optical transceivers | The physical layer you diagnose in C4 |
| **SuperNIC** | A NIC purpose-built for GPU east-west RDMA traffic at scale | vs a generic NIC: built for AI collectives |
| **DPU** | NIC that also runs its own compute/OS for infra offload | Cloud providers isolate tenant infra here |
| **Codesign** | HW+SW+network engineered together, not integrated after the fact | Marketing word; technically = shared roadmap, matched capabilities end-to-end |

## Software stack (see [[C1 - The Fabric Map]], [[C5 - Linux as the Debug Surface]])
| Term | Definition |
|---|---|
| **mlx5** | The Mellanox/NVIDIA Linux kernel driver for ConnectX-4+ and BlueField |
| **OFED / MLNX_OFED / DOCA-OFED** | OpenFabrics Enterprise Distribution — the userspace RDMA stack (libibverbs, librdmacm, tools) |
| **DOCA** | NVIDIA's SDK/runtime for BlueField DPUs (services, drivers, APIs) |
| **UCX** | Unified Communication X — middleware that picks the best transport (RDMA/TCP/shared-mem) for a message |
| **NCCL** | NVIDIA Collective Communications Library — implements AllReduce etc. over the fabric; the layer frameworks call |
| **libibverbs** | The userspace "verbs" API to program RDMA hardware directly |
| **rshim** | Host↔BlueField management channel (out-of-band access to the DPU) |

## RDMA & verbs (see [[C2 - Data Movement and RDMA]])
| Term | Definition |
|---|---|
| **RDMA** | Remote Direct Memory Access — NIC reads/writes remote memory without remote CPU involvement |
| **Verbs** | The low-level API/abstraction for RDMA (queue pairs, memory regions, etc.) |
| **QP (Queue Pair)** | A connection endpoint = **SQ** (Send Queue) + **RQ** (Receive Queue) |
| **CQ (Completion Queue)** | Where the NIC posts completions (CQEs) so software knows work finished |
| **WQE / CQE** | Work Queue Element (a posted request) / Completion Queue Element (a finished notification) |
| **PD (Protection Domain)** | Isolation boundary tying QPs and MRs together; prevents cross-tenant memory access |
| **MR (Memory Region)** | Registered+pinned memory the NIC may DMA to/from |
| **lkey / rkey** | Local / Remote key — tokens proving a QP may access an MR (rkey travels to the peer) |
| **SEND / RECV** | Two-sided op: receiver must pre-post a RECV; remote CPU is involved |
| **RDMA WRITE / READ** | One-sided op: initiator specifies remote addr+rkey; remote CPU does **nothing** |
| **ATOMIC** | One-sided fetch-add / compare-swap on remote memory |
| **RC / UC / UD** | Reliable Connected / Unreliable Connected / Unreliable Datagram transport types |
| **Doorbell** | An MMIO write that tells the NIC "new work is posted" — the kernel-bypass trigger |
| **Kernel bypass** | Fast path where userspace posts work directly to HW; no syscall per operation |
| **GPUDirect RDMA** | NIC DMAs straight to/from GPU HBM, skipping the bounce through host memory |
| **DMABUF** | Linux buffer-sharing mechanism used to expose GPU memory to the NIC |
| **Peer memory** | Non-host memory (e.g., GPU) registered as an RDMA target |
| **LID / GID** | Local ID (16-bit, subnet-local IB address) / Global ID (128-bit, IPv6-like, cross-subnet) |
| **SM / opensm** | Subnet Manager — discovers IB topology, assigns LIDs, programs switch routing tables |
| **Path record** | SM-provided route info (LIDs, MTU, service level) for a src↔dst pair |
| **pkey (partition key)** | IB partitioning/isolation — like a VLAN for InfiniBand |
| **RoCEv2** | RDMA over Converged Ethernet v2 — RDMA encapsulated in UDP/IP; needs a lossless network |

## Fabric behavior (see [[C3 - Fabric Behavior Under Load]])
| Term | Definition |
|---|---|
| **Lossless network** | Never drops packets due to congestion (RDMA assumes this); achieved via flow control |
| **Credit-based flow control** | IB approach: sender only transmits when it holds credits (buffer guarantees) from the receiver |
| **PFC (Priority Flow Control)** | Ethernet 802.1Qbb — per-priority PAUSE frames to make a lane lossless |
| **ECN** | Explicit Congestion Notification — switch marks packets instead of dropping them |
| **DCQCN** | Data Center Quantized Congestion Notification — the RoCE congestion-control algorithm reacting to ECN marks |
| **Incast** | Many senders → one receiver simultaneously; classic congestion collapse trigger |
| **HOL blocking** | Head-of-Line blocking — one stuck packet/flow stalls everything queued behind it |
| **PFC pause storm** | PAUSE frames propagate backward hop-by-hop, freezing large parts of the fabric |
| **PFC deadlock** | Circular PAUSE dependency (cyclic buffer wait) — fabric permanently stuck |
| **Congestion spreading** | Backpressure pushes congestion from the hotspot outward to innocent links |
| **ECMP** | Equal-Cost Multi-Path — hash flows across equal parallel uplinks |
| **Elephant flow** | A large, long-lived flow (e.g., a GPU's allreduce stream) that dominates a link |
| **Flow collision** | Two elephants hash to the same uplink under ECMP → one link saturates, others idle |
| **Adaptive routing** | Switch dynamically re-routes to avoid congested links (vs static ECMP hash) |
| **Packet spraying** | Spread packets of one flow across many paths; requires out-of-order reassembly at the receiver |
| **Collective** | Group communication op (AllReduce, AllGather, Broadcast, ReduceScatter) |
| **AllReduce** | Every rank ends with the sum (or op) of all ranks' data — the core training collective |
| **Ring vs tree** | AllReduce algorithms: ring = bandwidth-optimal, tree = latency-optimal (log hops) |
| **SHARP** | Scalable Hierarchical Aggregation & Reduction Protocol — switch does the reduction arithmetic in-network |
| **Line rate** | Raw signaling bit rate of the link |
| **Goodput** | Useful application bytes/sec after headers, FEC, retransmit, protocol overhead |
| **FEC** | Forward Error Correction — redundancy that repairs bit errors without retransmit (costs latency + overhead) |
| **MTU** | Max Transmission Unit — larger MTU = fewer headers = better goodput |
| **Straggler** | The slowest rank/link that a synchronous collective must wait for |
| **Tail latency** | p99/p99.9 latency — what synchronous training is actually hostage to |

## Physical layer (see [[C4 - Physical Layer and Sideband]])
| Term | Definition |
|---|---|
| **PCIe** | Peripheral Component Interconnect Express — host↔NIC/GPU bus; often the *real* bottleneck |
| **LTSSM** | Link Training and Status State Machine — PCIe's link bring-up/recovery state machine |
| **TLP** | Transaction Layer Packet — PCIe's unit of transfer (memory read/write, config, etc.) |
| **BAR** | Base Address Register — where a device's MMIO region is mapped into address space |
| **MMIO** | Memory-Mapped I/O — access device registers via memory loads/stores |
| **MSI-X** | Message-Signaled Interrupts (extended) — how PCIe devices raise interrupts |
| **AER** | Advanced Error Reporting — PCIe's error logging (correctable/uncorrectable/fatal) |
| **ASPM** | Active State Power Management — PCIe link power saving; can *hurt* latency/bandwidth |
| **Relaxed ordering** | PCIe TLP hint allowing reordering for throughput |
| **SerDes** | Serializer/Deserializer — the analog engine turning bits into line signals |
| **NRZ** | Non-Return-to-Zero — 2-level signaling, 1 bit/symbol |
| **PAM4** | Pulse Amplitude Modulation 4-level — 2 bits/symbol; doubles rate but shrinks eye/margin |
| **200G-per-lane** | Spectrum-6 SerDes rate; achieved with PAM4 |
| **BER** | Bit Error Rate — errored bits / total bits |
| **Pre-FEC vs post-FEC BER** | Error rate on the wire vs after FEC correction; post-FEC=0 can still hide a dying link |
| **RS-FEC** | Reed-Solomon FEC — the standard high-speed correction code |
| **Symbol error** | An errored PAM4 symbol (can carry multiple bit errors) |
| **Eye diagram** | Overlaid signal transitions; open eye = margin, closed eye = marginal link |
| **Link flap** | A link repeatedly going down/up |
| **QSFP / OSFP** | Quad / Octal Small Form-factor Pluggable — transceiver module form factors |
| **MSA** | Multi-Source Agreement — the standard that makes modules interoperable |
| **DDM / DOM** | Digital Diagnostics/Optical Monitoring — module telemetry: temp, voltage, Tx/Rx power |
| **Module EEPROM** | Paged memory in a transceiver holding identity + DDM data (read over I2C) |
| **Co-packaged optics (CPO)** | Optics inside the switch package (new in Spectrum-6) — no pluggable module to swap |
| **I2C / MDIO / SMBus** | Sideband buses: transceiver EEPROM / PHY registers / board sensors |
| **Sideband** | Management access to HW that is *not* on the data path |
| **Clear-on-read counter** | A counter that resets when read — dangerous when two tools poll it |
| **Latched bit** | A status bit that stays set until explicitly cleared (captures transient events) |
| **Counter wraparound** | Fixed-width counter overflowing back to 0; must handle in tooling |

## Linux debug surface (see [[C5 - Linux as the Debug Surface]])
| Term | Definition |
|---|---|
| **perf** | Linux profiler — `stat`, `record`, `top`; CPU counters, hotspots |
| **ftrace / bpftrace / eBPF** | Kernel tracing; eBPF = safe programmable in-kernel probes |
| **strace** | Traces syscalls made by a process |
| **ethtool** | NIC query/config: `-S` stats, `-m` module (DDM), `-i` driver info |
| **lspci -vvv** | PCIe device details: link speed/width, capabilities, AER |
| **dmesg** | Kernel ring buffer — driver/hardware messages |
| **/proc/interrupts** | Per-CPU interrupt counts (check IRQ balancing) |
| **NUMA** | Non-Uniform Memory Access — memory closer to one socket than another |
| **numactl / lstopo** | Pin to NUMA nodes / visualize machine topology (hwloc) |
| **IRQ affinity / RSS** | Which CPU handles an interrupt / Receive Side Scaling spreads flows across queues |
| **Interrupt coalescing** | Batch interrupts to cut CPU cost (adds latency) |
| **softirq / NAPI** | Deferred interrupt work / polling mode that reduces interrupt storms |
| **Huge pages** | Large memory pages → fewer TLB misses; used for DMA/pinned buffers |
| **TLB** | Translation Lookaside Buffer — caches virtual→physical page translations |
| **sysfs / procfs / debugfs** | Kernel-exposed filesystems for device state / process info / debug data |
| **ioctl** | Device-specific control syscall |
| **uio / vfio** | Userspace I/O frameworks; vfio = safe userspace device access with IOMMU |
| **DPDK / XDP / io_uring** | Kernel-bypass / fast-path packet & I/O frameworks |
| **cgroups** | Kernel resource isolation (containers) |

## Python (systems) (see [[C6 - Python as a Systems Language]])
| Term | Definition |
|---|---|
| **ctypes / cffi / pybind11 / Cython** | Python↔C bridges (FFI); tradeoffs in speed, ergonomics, build complexity |
| **struct** | Pack/unpack binary ↔ Python types; handles endianness |
| **memoryview** | Zero-copy view into a buffer |
| **GIL** | Global Interpreter Lock — one thread runs Python bytecode at a time; released during I/O and C calls |
| **cProfile / py-spy / austin** | Python profilers (py-spy/austin = sampling, no code change) |
| **tracemalloc** | Tracks Python memory allocations |
| **pytest / xdist** | Test framework / parallel test runner |

## Toolchain (see [[C7 - The Actual Toolchain]])
| Tool | What it does |
|---|---|
| **MFT** | Mellanox Firmware Tools suite |
| **mst** | Enumerate/start Mellanox devices (creates device nodes) |
| **mlxlink** | Link status, BER, eye, physical tuning — the key link-triage tool |
| **mlxconfig** | Read/set firmware configuration |
| **mlxfwmanager** | Firmware query/burn |
| **mlxcables / mlxdump** | Cable/transceiver info / register dumps |
| **ibdiagnet** | Full-fabric IB health scan (topology, errors, credit loops) |
| **ibnetdiscover** | Enumerate the IB topology |
| **ibstat / ibstatus** | Local HCA port state (LID, rate, state) |
| **perfquery** | Read IB port performance/error counters |
| **perftest** | Microbenchmarks: `ib_write_bw`, `ib_write_lat`, `ib_read_lat`, `ib_send_bw` |
| **nvidia-smi** | GPU status; `nvidia-smi nvlink` for NVLink counters |
| **DCGM / dcgmi** | Data Center GPU Manager — health/telemetry at scale |
| **nvbandwidth** | Measures GPU/NVLink/PCIe bandwidth |
| **all_reduce_perf** | NCCL test — the workload-level view a customer cares about |
| **ss / netstat** | Socket/network stats (Ethernet/RoCE side) |

## Supply chain & manufacturing (see [[B1 - How a Chip Gets Built]])
| Term | What it is | Why it matters |
|---|---|---|
| **Fabless** | A company that designs chips but owns no fab (NVIDIA, AMD, Apple) | NVIDIA's existence rides on a foundry it doesn't control — TSMC is a hard external dependency |
| **Foundry** | A pure-play manufacturer that builds other companies' designs (TSMC) | The most contended resource in AI; leading-node + packaging capacity gates every GPU |
| **Fab** | The fabrication plant itself | A $20B+ facility; only a handful exist at the leading node |
| **EUV / DUV** | Extreme / Deep Ultraviolet lithography — the light that prints features; EUV (13.5nm) for the finest layers, DUV for coarser | ASML is the sole EUV source — the chokepoint before the chokepoint |
| **Reticle limit** | Max area one lithography exposure can print (~858 mm²) | Caps single-die size; forces multi-die/chiplet designs once hit |
| **Multi-reticle stitching** | Combining multiple reticle-sized dies into one package | How modern GPUs exceed the reticle limit |
| **Interposer** | A silicon substrate wiring the compute die to HBM stacks with dense short traces | The CoWoS interposer is what makes GPU↔HBM bandwidth physically possible |
| **CoWoS / CoWoS-L** | Chip-on-Wafer-on-Substrate (-L adds local silicon-bridge interconnect) — TSMC's advanced 2.5D packaging | Packaging slots, not wafers, are the true supply cap; NVIDIA books ~60% of 2026 CoWoS-L |
| **HBM / HBM4** | High Bandwidth Memory — DRAM stacked beside the GPU; HBM4 is current gen | Memory bandwidth (not FLOPs) is the AI bottleneck; a three-vendor oligopoly |
| **TSV (through-silicon via)** | Vertical copper connections through a die that let DRAM stack | The physical trick that makes HBM stacking possible |
| **Photoresist** | Light-sensitive chemical the circuit pattern is printed into | Japan holds ~95% of EUV photoresist — another silent single-source dependency |
| **OSAT** | Outsourced Semiconductor Assembly and Test — the packaging/test houses (ASE, Amkor) | The back-end tier that turns dies into shippable packages |
| **ABF substrate** | Ajinomoto Build-up Film substrate — the high-layer-count PCB the package sits on | A recurring supply bottleneck (Ibiden / Unimicron) |

## Systems & assembly (see [[B2 - From Chip to Rack to Cluster]])
| Term | What it is | Why it matters |
|---|---|---|
| **OEM** | Original Equipment Manufacturer — builds and brands its own supported systems (Dell, HPE) | Buying a car from Toyota — branded, supported |
| **ODM** | Original Design Manufacturer — builds unbadged systems a hyperscaler brands itself (Foxconn, Quanta) | White-label; where NVIDIA hands the NVL72 reference design |
| **HGX / DGX** | HGX = the GPU baseboard OEMs build around; DGX = NVIDIA's own branded full server | The two productization tiers of the same silicon |
| **TDP** | Thermal Design Power — the heat a chip/rack must dissipate | The number that sizes cooling; drives the kW-per-rack wall (see [[D3 - Power and Cooling as Network Constraints]]) |

## Players & chokepoints (see [[B3 - The Players and the Supply-Chain Map]])
| Term | What it is | Why it matters |
|---|---|---|
| **ASML** | Dutch maker of lithography scanners; sole EUV supplier | The deepest single point of failure in the whole chain |
| **TSMC** | Taiwan Semiconductor — leading foundry + CoWoS packaging | Effectively the only advanced-node + advanced-packaging source; geopolitical risk concentrated here |
| **SK Hynix / Samsung / Micron (HBM trio)** | The three HBM makers | A three-vendor oligopoly with no fourth; HBM supply gates GPU count |
| **Retimer / AEC** | A signal-conditioning chip (retimer) / an Active Electrical Cable that embeds one | Needed as copper reach shrinks at 200G/lane; Astera / Credo territory |
| **Arm (CPU IP)** | The CPU instruction-set/IP licensed into Grace/Vera and the DPU cores | NVIDIA's CPUs and DPUs are Arm-based — another licensed dependency |

## Competitive & protocol war (see [[B4 - The Competitive and Protocol War]])
| Term | What it is | Why it matters |
|---|---|---|
| **UEC (Ultra Ethernet Consortium)** | Open standard (1.0, June 2025) making Ethernet match InfiniBand for AI | The open-standard attack on NVIDIA's scale-out moat |
| **UALink** | Open scale-up interconnect standard (AMD/Broadcom/etc.) | The open attack on NVLink |
| **SUE (Scale-Up Ethernet)** | Broadcom's Ethernet-based scale-up approach | Alternative to NVLink built on merchant Ethernet silicon |
| **LLR (Link-Layer Retry)** | Retransmit at the link layer to hide loss | How Ethernet gets lossless-like behavior without relying only on PFC |
| **CBFC (Credit-Based Flow Control)** | Sender transmits only while holding receiver credits | The flow-control model IB uses and UEC borrows; contrast with PFC PAUSE |
| **Merchant silicon** | Switch/NIC chips sold to anyone (Broadcom Tomahawk) | The commoditization force; Arista/Cisco/white-box build boxes around it |
| **Tomahawk 6** | Broadcom's 102.4 Tbps switch chip | ~A year ahead of Spectrum-X1600 — the merchant-silicon benchmark |
| **NVLink Fusion** | NVIDIA opening NVLink to third-party CPUs/accelerators | NVIDIA's answer to UALink — open a little to keep the center |

## Customers & alternatives (see [[B5 - The Customers Are the Threat]])
| Term | What it is | Why it matters |
|---|---|---|
| **ASIC** | Application-Specific Integrated Circuit — a fixed-function chip | The substitution threat; every big customer is building one |
| **TPU / Trainium / MTIA / Maia** | Google / Amazon / Meta / Microsoft in-house AI accelerators | NVIDIA's five biggest customers each building their own silicon (build-vs-buy at scale) |
| **LPU (Groq)** | Language Processing Unit — Groq's inference ASIC | Behind NVIDIA's ~$20B Groq deal (Dec 2025), its largest on record |
| **Neocloud** | GPU-first cloud (CoreWeave and peers) | A growth channel and the node in the circular-financing loop |
| **Sovereign AI** | Nation-state-owned AI infrastructure | A new demand class NVIDIA courts directly |
| **Circular financing** | NVIDIA funds a customer that spends it back on GPUs | Bull (ecosystem-building) vs bear (vendor financing) — ~$53B across ~170 deals |

## Software moat (see [[B6 - Why It Holds - the CUDA Moat]])
| Term | What it is | Why it matters |
|---|---|---|
| **CUDA / CUDA moat** | NVIDIA's GPU programming platform + ~20 years of libraries/kernels/frameworks defaulting to it | The real reason ASICs struggle even when the silicon wins |
| **cuDNN** | CUDA Deep Neural Network library — the deep-learning primitives (conv, attention) frameworks call | A core moat ring; every framework's fast path lands here |
| **ROCm** | AMD's CUDA-equivalent stack | Technically capable but the ecosystem/talent isn't there — the moat in one word |
| **Triton / MLIR / XLA** | Higher-level kernel/compiler layers targeting multiple backends | The wedge that could erode CUDA lock-in by abstracting it |
| **NIM** | NVIDIA Inference Microservices — packaged, optimized model containers | Moves the moat up-stack from libraries to deployable services |

## Topology (see [[D1 - Rail-Optimized Topology (Fat-Tree vs Dragonfly)]])
| Term | What it is | Why it matters |
|---|---|---|
| **Fat-tree / Clos** | A multi-tier non-blocking topology with full bisection | The AI-cluster default; any node to any node at full rate, at the cost of more optics |
| **Dragonfly** | Router-groups joined by global links | Cost-optimized (fewer long cables) at lower bisection — the cheaper tradeoff |
| **Bisection bandwidth** | Bandwidth across a cut that splits the cluster in half | The headline number for how well collectives scale |
| **Rail-optimized** | Wiring where GPU rank i rides its own dedicated rail across every rack | Keeps an AllReduce on one rail so collectives don't contend cross-rail |
| **Oversubscription / non-blocking** | Downlink:uplink capacity ratio; non-blocking = 1:1 | Oversubscribed tiers are where congestion shows up first |
| **Leaf / spine** | The two switch tiers of a Clos (leaf = ToR, spine = aggregation) | The vocabulary for where in the fabric a fault sits |
| **ToR** | Top-of-Rack switch — the leaf a rack's nodes connect to | First hop; first place a diagnostic looks |

## Power & cooling (see [[D3 - Power and Cooling as Network Constraints]])
| Term | What it is | Why it matters |
|---|---|---|
| **PUE** | Power Usage Effectiveness — total facility power / IT power | The datacenter efficiency metric; ~1.0 is ideal |
| **DLC (direct liquid cooling)** | Coolant plumbed to cold plates on the chips | The 100kW-air → 1MW transition; required past a rack's air limit |
| **CDU (coolant distribution unit)** | Pumps and heat-exchanges coolant into a rack loop | The rack-level plumbing node liquid cooling depends on |

## RDMA control plane — extended (see [[C2 - Data Movement and RDMA]])
| Term | What it is | Why it matters |
|---|---|---|
| **SRQ (Shared Receive Queue)** | One RECV queue shared across many QPs | Cuts memory as connection counts scale to thousands |
| **SA (Subnet Administration)** | The SM's query service for path records | What an endpoint asks for a path before it connects |
| **SMA (Subnet Management Agent)** | The per-port agent the SM talks to | How the SM programs each switch/HCA during a sweep |

## Congestion & collectives — extended (see [[C3 - Fabric Behavior Under Load]])
| Term | What it is | Why it matters |
|---|---|---|
| **CNP (Congestion Notification Packet)** | The RoCE packet a receiver returns on seeing ECN marks | The signal that drives DCQCN's rate cut — the feedback in the loop |
| **AllGather** | Every rank ends with every rank's data concatenated | The gather half of a training step (e.g., gathering shards); see [[D2 - CUDA to Fabric - A Training Step on the Wire]] |
| **ReduceScatter** | Reduce across ranks, each keeping one slice | The map-side combine; ring-AllReduce = ReduceScatter + AllGather |

## DPU & offload — extended (see [[C1 - The Fabric Map]])
| Term | What it is | Why it matters |
|---|---|---|
| **SmartNIC** | A NIC with programmable offload but not necessarily a full OS | The tier below a DPU; a blurred marketing line worth pinning down |
| **NVMe-oF** | NVMe over Fabrics — remote SSDs accessed like local over RDMA | A canonical DPU storage-offload workload |

## Physical layer — extended (see [[C4 - Physical Layer and Sideband]])
| Term | What it is | Why it matters |
|---|---|---|
| **Transceiver** | The pluggable module converting bits ↔ light (or electrical) | The field-replaceable unit whose DDM you read to catch a dying link |
| **DAC (Direct Attach Copper)** | A short passive copper cable for in-rack links | Cheaper and lower-power than optics for short reach; where AEC/CPO take over as reach grows |

## DOCA & BlueField (see [[E1 - DOCA, the Big Picture]], [[E2 - BlueField & the Product Line]], [[E3 - The DOCA Stack - Libraries & Services]], [[E4 - DOCA for the Diagnostics Engineer]])
> [!note] DOCA 3.4.0 terms. Generation-level BlueField claims are deliberately left out (not asserted in the 3.4.0 overview docs).

| Term | What it is | Why it matters |
|---|---|---|
| **BlueField DPU** | NVIDIA's DPU hardware platform — Arm cores + a ConnectX NIC on one card; "the third pillar of the data center alongside CPU and GPU" | Runs its own OS; the offload + isolation target DOCA programs (specific generations not asserted here) |
| **ECPF** (Embedded CPU Physical Function) | The DPU-side control PF — the interface the BlueField Arm uses to manage the NIC | Where the DPU's control plane attaches to the hardware datapath |
| **SR-IOV / PF / VF / SF** | How the NIC is sliced into virtual functions: Physical Function, Virtual Function, and Scalable (sub-)Function the DPU manages | How one physical NIC is shared across VMs/containers and steered from the DPU |
| **Representor** | A DPU-side port that stands in for a host PF/VF's traffic | The handle through which the DPU sees and steers each host/VF flow |
| **eSwitch** | The NIC/DPU's embedded hardware switch that representor ports attach to | Where OVS-DOCA programs match/action flows in hardware (the offloaded datapath) |
| **ASAP²** | Accelerated Switching And Packet Processing — NVIDIA's umbrella for hardware datapath (OVS) offload | The mechanism behind OVS-DOCA moving virtual switching into the NIC |
| **OVS-DOCA** | Open vSwitch datapath accelerated in DOCA / NIC hardware | Offloads virtual switching off host cores; silent fallback to software = the slow path |
| **DPA** (Datapath Accelerator) | An auxiliary on-DPU processor for data-path operations, programmed via the DOCA DPA library + DPA Tools | Programmable packet/data-path offload beyond the fixed-function engines |
| **DOCA-Host** | The host-side (x86) DOCA install; ships in profiles `doca-all` / `doca-networking` / `doca-ofed` | Supports both BlueField DPUs and standalone ConnectX |
| **BF-Bundle** (BlueField Bundle) | Full device-side stack: DOCA SDK libraries, drivers, tools, platform software, Ubuntu 22.04 | The "everything" install for the BlueField Arm side |
| **BF-FWBundle** (Firmware Bundle) | Minimal provisioning image: ATF, UEFI, NIC/BMC firmware, eROT — no SDK, no OS | Bare firmware provisioning without the DOCA runtime |
| **BFB** | The BlueField boot / installation image streamed to the device | The flashable artifact that carries a BF-Bundle or BF-FWBundle |
| **DOCA Flow** | Library to program/manage hardware packet-steering pipelines (match/action flow tables) | The programmable flow-offload API; paired with the Flow Tune tool for analysis |
| **DOCA PCC** | Library for **programmable congestion control** on the NIC/DPU | Custom congestion-control algorithms in hardware; read via the PCC Counter Tool |
| **PPCC** | Programmable Congestion Control counters collected by DTS | The congestion-diagnostics counter set (pairs with DOCA PCC) |
| **DTS** (DOCA Telemetry Service) | The central real-time telemetry collector/exporter for BlueField + host | The diagnostics spine — Prometheus / OTel / Fluent-Bit export; configured in `dts_config.ini` |
| **DOCA Blueman** | Web dashboard consolidating BlueField health/telemetry counters into one UI (pulls from DTS) | The built-in BlueField dashboard (vs wiring Prometheus → Grafana yourself) |
| **DOCA Flow Inspector** | Service that parses **mirrored packets**, extracts fields, forwards structured telemetry to DTS | The packet-forensics feed; JSON-filtered and runtime-reconfigurable |
| **DOCA App Shield** | Library for host-application integrity monitoring / security | Detects tampering of host processes from the isolated DPU |
| **HBN** (Host-Based Networking) | DOCA service running BGP/EVPN routing on the DPU | Turns the DPU into a routing node on behalf of the host |
| **DOCA Firefly (PTP)** | DOCA precision time-synchronization service (PTP) | Clock sync across the fabric — timestamp accuracy for telemetry and ordering |

## Related
[[00 - Networking Diagnostics MOC]] · [[Diagrams & Visual Maps]] · [[Study Guidelines & Roadmap]]
