---
layout: default
title: "Sticky Sessions：流式 ASR / Stateful Inference 的路由与扩缩容"
date: 2026-11-03
track: onprem
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-03-onprem-sticky-sessions/
---
# Sticky Sessions：流式 ASR / Stateful Inference 的路由与扩缩容

> **2026-11-03 历史精读（2026-11-04 重新整理）**。依据既有选题和真实可核对的一手资料重新编写，不是逐字恢复聊天原文；作者声称的数据未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-11-03-sticky-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。


## 原始资料与选题原因
- [Serverless routing made sticky](https://modal.com/blog/serverless-routing-made-sticky) — Modal，2026-10-20。

**为什么值得学**：标准无状态负载均衡默认任一副本可以处理新请求，但长流式 ASR、Voice Agent、Game Session、KV/Decoder State 等工作负载必须保留 session continuity。Session Routing 横跨推理、调度、认证、容错，具有比普通 Serverless 产品介绍更广泛的 ML Platform 价值。

## 1. Stateless 和 Stateful 的分界
对无状态函数，每个请求只依赖请求自身；负载均衡器可选任意实例。但流式识别的中间信息包括 VAD Segments、Decoder Hidden State、Speaker diarization Cache 和已输出片段偏移。若同一流中第 8 个 chunk 送到不认识前 7 个 chunk 的容器，推理质量可能改变，甚至重复或丢失部分 Transcript。

Sticky Session 的约束是：同一个 Session ID 在其有效期内应路由到同一个 Container。Modal 文中使用 `@modal.sessioned()` 与生命周期管理实现该路由语义。**会话固定≠长连接永久不断开**：HTTP/WS 重连后仍需正确鉴权和状态定位，故障时要恢复、重建或明确失败。

## 2. 生命周期的四层状态
- **Identity**：Session token / lease / expiration；不能信任用户随意声明的 Container ID。
- **Placement**：Session → Worker Mapping；可能由 Proxy 或分布式 KV 管理。
- **State**：热的 Decoder/KV Cache 放于 GPU/CPU 内存；Snapshot 才支持迁移后的部分恢复。
- **Scaling**：Worker 数量按照 Active Sessions/Memory 而不是单纯 QPS；Idle Timeout 回收孤儿会话。

::: note
工程推导：当实例 Drain 时，不应随便让新的 Chunk 落在另一节点继续；应设置 Session Grace Period、客户端恢复协议、重试的序列号和幂等控制。
:::

## 3. 权衡
- Affinity 改善正确性但可能让热点会话集中在单 GPU；
- Streaming state 常无法即时序列化，Container 故障仍可能要求用户重开 Session；
- 无状态扩容简单，Stateful 扩容应处理冷热 Session 差异与 TTL；
- 路由表一致性与实例生命周期控制必须明确，尤其部署在多 Proxy、多副本环境时。

## 4. On-prem / Hybrid
| 层 | On-prem | Controlled Hybrid |
|---|---|---|
| Router | 内部 LB + Redis/etcd 映射或 Session-aware Proxy | Modal sessioned 服务提供参考 |
| State | GPU 热状态不跨网迁移；定期持久化必要偏移 | 跨域迁移需审批 Session Data |
| 失效 | 进程重启需要客户端重放/恢复点 | 云端实例重建需要明确 RTO |
| 安全 | Token 有过期、续期、防重放、访问隔离 | 会议音频等敏感内容不默认出域 |
| 衡量 | Session-level WER/RTF、失败重连恢复时间、GPU 内存 | 另测跨域成本与网络抖动 |

## 30–60 分钟实验
Python 模拟三个 Worker，随机 LB 让同一 Session 分散到不同实例，触发 `unknown_session`；改为哈希路由并维护 TTL，测试同一 Session 的 100 个 Chunk 被同一 Worker 连续接收。注入 Worker 故障，返回明确的 Session Lost 错误并要求从客户端标记的 Offset 重传。该实验模拟路由语义，**不等于真实 ASR Benchmark**。

## 求职考点与总结
Design a multi-tenant streaming ASR system on autoscaled GPUs. 要说清 Session Affinity、State Placement、Consistent Hashing、Lease、Idle Eviction、Failover、Graceful Drain 与 Observability。三个要点：正确性依赖 session continuity；状态与运行实例生命周期需要明确关系；扩容指标应考虑并发 Session 与显存。



