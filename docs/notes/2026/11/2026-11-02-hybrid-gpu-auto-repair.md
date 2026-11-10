---
layout: default
title: "Together AI GPU Auto-repair：基于证据的修复与熔断"
date: 2026-11-02
track: hybrid
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-02-hybrid-gpu-auto-repair/
---
# Together AI GPU Auto-repair：基于证据的修复与熔断

> **2026-11-02 历史精读（2026-11-04 重新整理）**。依据既有选题和真实可核对的一手资料重新编写，不是逐字恢复聊天原文；作者声称的数据未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-11-02-gpu-repair-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。


## 一手资料与入选原因
- [Auto repair for Together GPU Clusters: from GPU fault to healthy node](https://www.together.ai/blog/auto-repair-for-together-gpu-clusters) — Together AI，2026-10-27。

**为何入选**：从“有监控会告警”推进到带证据、审批、修复动作、复验和集群级熔断的 Closed-loop GPU Infra。涉及真实的可靠性和安全设计，技能迁移性高；比介绍增加多少 GPU 容量的新闻更适合 ML Infra 工程深读。

## 1. 检测不等于执行修复
一台 GPU 节点 `NotReady` 不意味着 GPU 已坏。共享网络波动、Driver Crash、PCIe Link、ECC Error、Storage Readonly 都可能造成类似症状；应保留原始机器证据。

Together 的公开框架从 Guest VM 与 Host 两面收集故障：如 DCGM、Xid、ECC、Node Problem Detector、IB 网络 Link。告警分离为 Observed 与 Actionable：所有故障可以留下记录，但只有具有合适动作映射、且满足策略和授权的告警才能生成修复。

核心策略：**No node repair without a failed health check.** 修复必须具有可解释关联证据，并对不确定信号保守处理。

## 2. Repair State Machine
~~~mermaid
flowchart LR
  A[Detect] --> B{Evidence gate}
  B -->|Mapped fault| C[Policy + Consent]
  B -->|No action| D[Log + Investigate]
  C --> E[Cordon + Wait idle + Drain]
  E --> F[Reboot / Reprovision / Migrate]
  F --> G[Re-validate]
  G --> H{Healthy?}
  H -->|Yes| I[Return to pool]
  H -->|No| J[Escalate with evidence]
~~~

Together 的设计允许每种 Error/Xid 配置批准范围，并为修复提供 Wait-for-idle。轻至重通常是 Reboot → Quick Reprovision → Host Migration → Remove/RMA（人工发起），每一级在特定条件下有限重试。动作越重，越可能丢失本地临时数据或消耗新宿主 Capacity。

## 3. 为什么需要 Circuit Breaker？
单节点 Reboot 可能有效，但如果 100 台主机在 30 秒内都 `NotReady`，就更像共享网络/存储故障。此时自动对每台进行重建可能从可恢复故障变成灾难。

必须具备：信号持续时间阈值、冷却期、并发预算、集群级突发熔断、每个修复仅作用于一个目标、幂等 ID、统一修复日志、复验失败后退出池。这些设计的权衡是“自动化恢复速度”与“错误自动化的破坏半径”。

## 4. 部署边界
| 维度 | On-prem | Controlled Hybrid |
|---|---|---|
| Signals | DCGM、Kernel/Xid、OS、Scheduler、网络设备 | Cloud Provider Host telemetry 可补强 |
| Actuator | 内部 CMDB/审批、K8s/Slurm、硬件运维 | 按节点/错误类型授权云端修复 |
| Safety | Drain 时评估正在运行的 LLM replicas/Training Jobs | 增加 Capacity Reservation 与成本门槛 |
| State | DB 事务/幂等修复 Record；必须可审计 | 多区/多控制器竞争需 Single Writer/CAS |
| 复验 | GPU 健康/通信/NCCL/存储测试 | 物理机复验与客户 VM 复验边界可能不同 |

对于纯 On-prem，硬件修复必须与数据中心/运维责任划分相匹配，无法把 Together 的云平台直接复制成一个脚本。

## 30–60 分钟实验
创建 10 个模拟节点状态，注入单 Xid、偶发网络毛刺与 6 节点同时 NotReady 三种情形。实现最小 FSM：Evidence Gate → Per-fault Consent → Concurrency Budget → Circuit Breaker → Verify，单元测试要求：无证据不修；同一个 request ID 不执行第二次；相关故障风暴下自动修复为零；复验失败不得标记 Healthy。

## 系统设计面试
How would you auto-remediate GPU failures without causing cascading outages? 重点：Evidence, Idempotency, Fault-domain Correlation, Policy Gates, Blast Radius, Safe Rejoin。三个结论：检测与动作需要证据隔离；复杂故障风暴应默认停止破坏性修复；动作后复验才能闭环。



