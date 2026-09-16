---
title: Component Dictionary - What Can Break in a Rack
tags: [nvidia, doca, diagnostics, dictionary, components]
created: 2026-09-16
status: living
---

# Component Dictionary · What Can Break in a Rack

> **TL;DR** — Every component a byte touches on its way from one GPU to another, one row each: what it does, how it breaks, what the symptom looks like, and what you read to prove it. This is the *component* cut; the term-by-term cut is [[Networking Diagnostics Glossary]].

**Where you are:** orientation reference. **Prereqs:** [[C1 - The Fabric Map]]. **Next:** [[C7 - The Actual Toolchain]] for the tools named here, [[E4 - DOCA for the Diagnostics Engineer]] for the DOCA side.

## How to use this note

1. Ticket arrives → find the **symptom** in the last table → it points at 2–3 component rows.
2. Each row names **what to read** (counter, register, sysfs file) and **which tool** reads it.
3. Bisect first (same card → other peer, other card → same peer). Then work the rows top-down, cheapest first.

The four failure families from the walkthrough map onto this note like so:

| Family | Where it lives below |
|---|---|
| **Bits get mangled** | Layer 3 (cable, optics, SerDes, FEC) |
| **Both ends disagree** | Layers 2 + 4 (NIC config vs switch config: MTU, PFC, trust, speed) |
| **Works, but slowly** | Layer 4 + 5 (switch buffers, ECN/PFC, routing, collectives) |
| **Card is fine, host starves it** | Layer 1 (PCIe, NUMA, IOMMU, IRQ, GPUDirect) |

---

## Layer 1 · Host side (the card is fine, the server starves it)

| Component | Job | How it breaks | Symptom | What to read | Tool |
|---|---|---|---|---|---|
| **GPU (HBM + copy engines)** | Source/sink of the bytes. Copy engines push data to the NIC without the CPU. | Throttled (power/thermal), Xid errors, wrong clock. | One rank slow → whole collective slow. | Clocks, throttle reasons, Xid log, ECC. | `nvidia-smi -q`, DCGM |
| **NVLink / NVSwitch** | Intra-node GPU↔GPU fabric. Faster than the NIC. | Lane down, replay errors, degraded width. | Intra-node all-reduce slow while inter-node looks fine. | NVLink link state, replay/recovery counters. | `nvidia-smi nvlink -s`, DCGM |
| **PCIe root complex + slot** | Bus between CPU/GPU and NIC. Gen5 x16 ≈ 500 Gb/s usable; Gen4 x16 ≈ half. | Trained at lower gen/width (bad slot, riser, BIOS). AER errors. | Clean fraction of line rate (½, ¼). **Most common "network is slow" cause.** | `LnkSta` vs `LnkCap`, AER counters. | `lspci -vvv`, `dmesg`, sysfs `current_link_speed/width` |
| **PCIe switch (in DGX/HGX trays)** | Fans out root ports to GPUs and NICs. | Congests when GPU↔NIC pair sits on different switches. | GPUDirect works but slow. | Topology matrix. | `nvidia-smi topo -m` |
| **NUMA node** | Which CPU socket "owns" the NIC and the GPU. | Process on the wrong socket → every byte crosses the inter-socket link. | Uneven per-rank throughput, high CPU on one socket. | NIC's `numa_node`, GPU affinity. | `numactl -H`, sysfs, `nvidia-smi topo -m` |
| **IOMMU / ATS** | Address translation for DMA. | Enabled in passthrough-unfriendly mode → per-packet translation cost. | Latency up, small-message BW down. | Kernel cmdline, IOMMU groups. | `dmesg`, `/sys/kernel/iommu_groups` |
| **IRQ / MSI-X vectors** | Interrupts from NIC queues to CPU cores. | All vectors on one core, or on the far socket. | One core at 100% softirq, drops under load. | `/proc/interrupts` deltas. | `mlnx_tune`, `set_irq_affinity`, `irqbalance` |
| **GPUDirect RDMA (nvidia-peermem)** | Lets the NIC DMA straight into GPU memory. | Module not loaded → staging copy through host RAM. | Works, at ~half BW, CPU busy. | Module present, NCCL debug log says `GDRDMA`. | `lsmod`, `NCCL_DEBUG=INFO` |
| **CPU / memory bandwidth** | Feeds the NIC when GPUDirect isn't in play. | Frequency scaling, memory-bound copies. | BW varies with governor. | Governor, `perf` counters. | `cpupower`, `perf` |

## Layer 2 · The adapter (ConnectX NIC / BlueField DPU)

| Component | Job | How it breaks | Symptom | What to read | Tool |
|---|---|---|---|---|---|
| **ConnectX ASIC** | The NIC. Terminates RDMA/RoCE/IB, does the DMA. | Firmware bug, thermal, wrong config. | Everything, depending. | Temperature, FW version, health. | `mst status`, `mlxfwmanager`, `mlxlink` |
| **BlueField DPU (ARM cores + ConnectX)** | NIC + embedded Linux running DOCA services. Offloads OVS, storage, telemetry. | ARM side hung, rshim unreachable, BFB mismatch. | Host sees NIC but services dead. | rshim console, DPU health. | `rshim`, `bfb-install`, `mlxprivhost` |
| **Firmware (FW)** | The ASIC's OS. Exposes registers and counters. | Version mismatch across cluster, known-bug version. | One node behaves differently. | FW version vs golden. | `mlxfwmanager --query`, `flint` |
| **NV config (mlxconfig)** | Persistent adapter settings: link type (IB/Eth), SR-IOV, RoCE mode, PCIe. | Set differently on one card. | Config-mismatch family. | Diff against golden config. | `mlxconfig -d <dev> q` |
| **Physical port (PHY) + SerDes** | Serialize bits onto lanes. 400G = 4 or 8 lanes. | One lane weak → link trains at lower speed. | Exactly half/quarter rate. | Negotiated speed/width, per-lane eye/SNR. | `mlxlink -d <dev> -m -e` |
| **FEC engine** | Corrects bit errors before you see them. | Working overtime on a marginal cable. | Line rate slightly low, jobs die every N hours. | FEC corrected vs uncorrected, effective BER, raw BER. | `mlxlink -c`, `ethtool -S` |
| **Hardware counters (`hw_counters`)** | Truth about what the port saw. | Read since boot → noise. **Always clear/delta.** | — | `rx_discards`, `out_of_buffer`, `rp_cnp_handled`, `np_ecn_marked`, `local_ack_timeout_err`, `implied_nak_seq_err`. | sysfs `/sys/class/infiniband/<dev>/ports/1/hw_counters/`, `ethtool -S` |
| **Queue pairs (QPs) / completion queues** | RDMA connections. | QP retransmits, timeouts. | RoCE BW collapses under loss. | `local_ack_timeout_err`, `packet_seq_err`, `duplicate_request`. | `rdma stat`, hw_counters |
| **Priority / QoS (trust, DSCP→prio, PFC per prio)** | Which traffic class gets lossless treatment. | Trust mode or PFC prio differs from switch. | Loss on the lossless class → RoCE retransmits. | Trust state, PFC per prio, prio counters. | `mlnx_qos -i <if>` |
| **DCQCN (RoCE congestion control)** | Reaction point slows on CNPs. | Disabled on one side, wrong parameters. | ECN marks rise, no rate reduction. | `rp_cnp_handled`, `np_cnp_sent`, ECN counters. | sysfs `ecn/`, hw_counters |
| **SR-IOV / VFs / SFs** | Virtual functions for VMs/containers. | VF starved, wrong steering. | Tenant-specific slowness. | VF stats. | `devlink`, `ip link show` |
| **Driver (mlx5_core, mlx5_ib)** | Kernel side of the NIC. | Version mismatch with FW, wrong module params. | `dmesg` full of errors. | `dmesg`, module params. | `modinfo mlx5_core`, `ethtool -i` |

## Layer 3 · The link (bits get mangled)

| Component | Job | How it breaks | Symptom | What to read | Tool |
|---|---|---|---|---|---|
| **Transceiver / module (QSFP-DD, OSFP)** | Electrical ↔ optical. | Hot, low TX/RX power, wrong vendor/firmware. | Link flaps, FEC high. | DDM/DOM: temp, voltage, TX/RX power per lane. | `mlxlink -m`, `mlxcables`, `ethtool -m` |
| **Optical fiber (AOC / SR / DR)** | Carries light. | Dirty connector, bend, wrong polarity. | Low RX power on one lane. | RX power per lane, LOS flags. | `mlxlink -m` |
| **Copper DAC / ACC** | Short passive/active copper. | Length beyond spec, wrong gauge. | Fails to train at full speed. | Cable EEPROM, negotiated speed. | `mlxcables`, `mlxlink` |
| **Retimer / gearbox** | Re-cleans the signal mid-path. | Firmware, thermal. | Errors on both ends, both blame the other. | Per-lane BER split by side. | `mlxlink -e`, vendor tool |
| **Link training state machine** | Negotiates speed/FEC/lanes at link-up. | Stuck in a lower state, autoneg disagreement. | Link up at wrong speed, or up/down loops. | Link state, `link_down` count, `link_error_recovery`. | `mlxlink`, `ibportstate`, `ip -s link` |
| **Eye / SNR margin** | How much noise margin each lane has. | Marginal eye → errors under thermal load. | Fine at boot, errors after hours. | Per-lane eye height/width, SNR. | `mlxlink -e` (eye), `mlxlink --show_eye` |
| **Sideband (I²C / MDIO / CMIS)** | Management channel to the module. | Module doesn't answer. | Cable "present" but no DDM. | CMIS state. | `mlxcables`, `mlxreg` |

## Layer 4 · The switch (both ends disagree / works but slowly)

| Component | Job | How it breaks | Symptom | What to read | Tool |
|---|---|---|---|---|---|
| **Switch ASIC (Spectrum = Eth, Quantum = IB)** | Forwards packets, holds buffers. | Same PHY/FEC failures as the NIC side. | Errors on switch port, clean on host. | Switch-side port counters. | NetQ / UFM / switch CLI, `ibdiagnet` |
| **Switch port config (MTU, speed, FEC mode, PFC, trust)** | Must match the NIC. | One side changed. | Frames dropped or fragmented; lossless class not lossless. | MTU, PFC, FEC mode on both ends. | Switch CLI vs `mlnx_qos`/`mlxlink` |
| **Buffers / shared pool** | Absorbs bursts. | Incast fills the pool → PFC or drops. | Tail latency spikes, pause storms. | Buffer occupancy, drops per queue. | Switch telemetry (WJH on Spectrum), NetQ |
| **PFC (priority flow control)** | Per-priority pause → lossless. | Pause storm, deadlock, or PFC disabled on one hop. | Whole rail stalls; or RoCE loss. | Pause frames tx/rx per prio, PFC watchdog. | `ethtool -S` (`rx_prio*_pause`), switch CLI |
| **ECN marking / WRED** | Marks packets so DCQCN slows senders. | Thresholds wrong → too early/late. | Under-utilization or PFC kicks in first. | Marked-packet counters. | switch CLI, `np_ecn_marked_roce_packets` on host |
| **Routing / ECMP hash / Adaptive Routing** | Spreads flows across paths. | Hash collision puts two big flows on one link. | One spine link hot, others idle. | Per-link utilization skew. | UFM, NetQ, `ibdiagnet` |
| **Subnet Manager (opensm / UFM) — IB only** | Assigns LIDs, computes routes. | SM failover, wrong routing engine. | Nodes vanish, routes suboptimal. | SM state, LID table. | `sminfo`, `ibnetdiscover`, UFM |
| **SHARP (in-network reductions) — IB** | Switch does the all-reduce math. | Trees not allocated, resource exhaustion. | Collective falls back to host-side, slower. | SHARP allocation logs. | UFM, NCCL debug |

## Layer 5 · Fabric and workload (the whole is slower than the parts)

| Component | Job | How it breaks | Symptom | What to read | Tool |
|---|---|---|---|---|---|
| **Topology (fat-tree / rail-optimized)** | Guarantees full bisection. | Miscabled rail, missing spine link. | Specific node pairs slow. | Discovered vs intended topology. | `ibnetdiscover`, `ibdiagnet`, NetQ |
| **NCCL** | Runs the collectives over the fabric. | Wrong algo/protocol, GDR disabled, topology misdetected. | Everything "works" at 60%. | `NCCL_DEBUG=INFO`, rings/trees chosen. | nccl-tests (`all_reduce_perf`) |
| **UCX / MPI** | HPC transport layer. | Wrong transport selected (TCP instead of RC). | Order-of-magnitude slow. | `UCX_LOG_LEVEL`. | `ucx_info -d` |
| **Straggler node** | One slow link = whole collective slow. | Any row above, on one node. | Step time jumps; job-level, not link-level. | Per-rank timing vs per-port counters. | DCGM, nccl-tests per pair |
| **Time / clock (PTP)** | Cross-node timestamps for telemetry correlation. | PTP unsynced. | Telemetry timelines don't line up. | PTP offset. | `phc_ctl`, `ptp4l` |

## Layer 6 · Diagnostics and telemetry stack (what you build and maintain)

| Component | Job | How it breaks | Notes |
|---|---|---|---|
| **MFT (Mellanox Firmware Tools)** | Vendor toolbox: `mst`, `mlxlink`, `mlxconfig`, `mlxcables`, `mlxreg`, `mlxfwmanager`, `flint`, `mlxdump`. | Wrong version for FW → registers unreadable. | Your tools wrap these. See [[C7 - The Actual Toolchain]]. |
| **Access registers (PRM)** | The FW's register interface. Every counter above comes from one. | Register not exposed yet → go negotiate with FW team. | `mlxreg` reads raw registers. |
| **infiniband-diags** | `ibstat`, `perfquery`, `ibnetdiscover`, `ibdiagnet`, `iblinkinfo`, `ibportstate`. | Needs SM reachable. | IB-side fabric sweep. |
| **perftest** | `ib_write_bw`, `ib_send_lat`, `ib_read_bw`. | Single QP + small messages never saturates 400G → **test is wrong**. | Reproduce with the right knobs first. |
| **DTS (DOCA Telemetry Service)** | Runs on the DPU, exports counters (Prometheus/Fluent). | Providers disabled, DPU unreachable. | See [[E4 - DOCA for the Diagnostics Engineer]]. |
| **UFM / NetQ** | Fabric-wide managers (IB / Eth). | Stale inventory. | Cluster-scale view; your tool fills the per-node gap. |
| **Regression matrix** | Adapters × FW × OS/kernel × cable vendors. | Any axis drifts. | The thing that eats the most engineering time. |

---

## Symptom → which rows to open

| Symptom | Open these rows first |
|---|---|
| Clean fraction of line rate (½, ¼) | PCIe slot → PHY/SerDes lanes → link training |
| Slightly below line rate, jobs die every few hours | FEC engine → transceiver DDM → eye/SNR margin → retimer |
| Link up, RoCE throughput collapses | Priority/QoS trust → PFC on switch → DCQCN → QP retransmit counters |
| One node slow, others fine | GPUDirect → NUMA → IRQ affinity → FW version vs golden |
| Whole rail stalls | PFC pause storm → switch buffers |
| One spine link hot | ECMP/AR hash → topology as-built |
| Node disappears from IB fabric | Subnet Manager → link_down counter → transceiver |
| Everything works at 60% | NCCL algo/GDR → straggler node → test itself |

## Day-one shortlist (learn these ten first)

1. PCIe slot (`LnkSta` vs `LnkCap`)
2. NUMA / GPU↔NIC topology
3. PHY negotiated speed + per-lane state (`mlxlink`)
4. FEC counters + effective BER
5. Transceiver DDM (temp, TX/RX power)
6. `hw_counters` directory and the delta habit
7. PFC + trust + DSCP mapping (`mlnx_qos`)
8. DCQCN / ECN counters
9. NV config golden diff (`mlxconfig`)
10. `perftest` knobs that actually saturate a 400G link

## Related

- [[Networking Diagnostics Glossary]] · term-level definitions for every name above
- [[C1 - The Fabric Map]] · where each component sits
- [[C4 - Physical Layer and Sideband]] · Layer 3 in depth
- [[C7 - The Actual Toolchain]] · the tools column
- [[E4 - DOCA for the Diagnostics Engineer]] · DTS, Blueman, Flow Inspector
- [[00 - Networking Diagnostics MOC]]
