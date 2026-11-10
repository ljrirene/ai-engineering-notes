---
layout: default
title: "Shadow Traffic / Endpoint Candidates：模型上线前怎样安全比较"
date: 2026-11-03
track: hybrid
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-03-hybrid-shadow-traffic/
---
# Shadow Traffic / Endpoint Candidates：模型上线前怎样安全比较

> **2026-11-03 历史精读（2026-11-04 重新整理）**。依据既有选题和真实可核对的一手资料重新编写，不是逐字恢复聊天原文；作者声称的数据未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-11-03-shadow-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。


## 原始资料与筛选理由
- [Endpoint Candidates: evaluate and promote inference endpoints](https://modal.com/blog/endpoint-candidates) — Modal，2026-10-12。

**入选原因**：模型发布的核心难点不是“把新权重加载起来”，而是如何在不影响现有服务的前提下，用真实流量比较质量、延迟和成本。本文还公开了 Production Proxy 镜像请求在慢消费者下的缓冲设计，具有可验证的系统实现细节。

## 1. Shadow 与 Canary 是两回事
**Shadow Traffic**：复制真实请求给候选版本，但候选响应不回传给用户；只收集独立指标。**Canary Rollout**：真的将少部分用户请求交给新版本并让其结果可见，存在用户风险。前者用于获得上线前证据，后者用于有限半径放量测试。不能把 Shadow 胜出直接当成 Canary 成功证明。

~~~mermaid
flowchart LR
  U[Prod Request] --> F[Mirroring Proxy]
  F --> P[Production Model]
  F -. best-effort copy .-> S[Shadow Candidate]
  P --> R[User response]
  S --> E[Offline metrics / eval]
  E --> G{Quality & SLO Gate}
  G -->|Pass| C[Limited Canary]
  G -->|Fail| X[Keep production]
~~~

## 2. 为什么镜像可能破坏生产？
大型流式 Body 被多路 Fork 后，如果每个 Candidate 消费速度不同，Proxy 可能累积大量内存、产生 Backpressure，进一步拖慢生产。Modal 的文章描述基于 Pingora 的代理将输入流复制到**每个镜像独立的有界缓冲**，慢镜像超出限额时只取消镜像而继续主流量；还对进程内保留的请求 Body 设全局预算，共享 Chunk 按最后一个消费者释放后才计入内存回收。

因此 “Mirroring is best-effort” 是合理契约，但意味着日志中可能存在样本选择偏差：特别慢的 Candidate 或大型请求更可能被丢弃，造成评测结果过度乐观。必须计数 Mirror Drop Rate、Dropped Request Size、Input Distribution 和与生产数据的可比性。

## 3. 如何搭建可信评测？
- Quality：基于黄金测试集或可审计评价的任务成功率、Output Consistency、Safety Pass Rate。
- Performance：相同输入长度 Bucket 的 P50/P95 TTFT、TPS、E2E Latency。
- Infrastructure：Replica Memory、GPU Busy、Queue Depth、Mirror Drop。
- Operational：模型版本 SHA、Tokenizer Template、Parser/Tool Schema、Rollback Method。
- Governance：日志/Prompt 中是否包含敏感数据，未经许可不能复制给外部 Shadow Endpoint。

至少要区分 Offline Benchmark、Shadow Production Replay 和 Canary 真实反馈，每个阶段的数据来源与风险不同。

## 4. 两种落地
| 层 | On-prem | Controlled Hybrid |
|---|---|---|
| Mirror Proxy | Envoy/Nginx/自研 Streaming Fork, bounded buffers | Cloud Candidate 用相同原则 |
| Candidate | 同内网不同权重或 engine，独立 GPU 资源 | 云端候选仅允许获批流量 |
| Gate | CI + Eval Pipeline + 人工放行 | 加入法律/数据出口审批 |
| Canary | Ingress 细粒度路由 + 快速 Rollback | 跨境会话状态/网络 RTO 风险 |
| Metrics | Shadow Drop、TTFT、Quality、Cost | 额外观测 egress/云费用 |

## 30–60 分钟本地实验
用 asyncio 模拟每 20ms 输入 100 个请求 Chunk，并 Fork 给一个快速消费者及一个慢速消费者；每镜像设置 buffer 上限 5，若溢出仅取消慢消费者，要求主生产路径的完成时间与无镜像接近。增加一个进程级总预算并输出 Mirror Cancel Rate。使用合成文本，不需要真实生产日志或闭源 API。

## 求职与总结
Design a safe model release platform for a high-throughput inference endpoint. 必答：Control vs Data Plane、Traffic Mirroring、Backpressure、Bounded Memory、Shadow Bias、Canary、SLO Gate 与 Rollback。核心：镜像不等于放量；代理不可让慢镜像影响生产；上线证据必须兼顾质量、延迟与数据合规。



