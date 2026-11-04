---
layout: default
title: "Spindle：Disaggregated RL 与多租户训练系统"
date: 2026-11-04
track: hybrid
tags: [post-training, rl, ml-systems, multi-lora]
permalink: /notes/2026/11/2026-11-04-hybrid-spindle/
---
# Spindle：为什么 RL Post-training 要解耦 Trainer 与 Inference？

> **研究日期**：2026-11-04 · **主要路径**：Controlled Hybrid · **目标岗位**：Research Engineering、ML Systems、AI Infrastructure

## 一手来源

- **Modal**，*[Introducing our Training API](https://modal.com/blog/introducing-training-api)*，2026-10-22；作者 Kailash Ranganathan、Micah Yong。
- [Spindle GitHub](https://github.com/modal-projects/spindle)，公开实现与部署说明；Modal 服务依赖以当前项目文档为准。
- **Fireworks AI**，*[Reinforcement learning: Why alignment of numerics and MoE routing matter](https://fireworks.ai/blog/reinforcement-learning-why-alignment-of-numerics-and-MoE-routing-matter)*，2026-09-30。

**证据声明**：吞吐和成本数字为原团队的内部实验报告；本文架构对比、实践和安全建议是独立归纳，非真实环境复现。

## 1. 两种不同的 GPU 工作负载

SFT 主要消费已有的监督样本并更新模型；Agentic RL 则经常要求模型先执行一段包含多次工具交互的 Rollout，再计算 Reward、Advantage 和梯度更新。两部分的主要资源瓶颈不同：

- **Sampling / Rollouts**：长 Decode、Tool I/O、异步等待；追求 token throughput 与并发。
- **Trainer**：Forward、Backward、Optimizer State；追求稳定、高效的矩阵计算与通信。

在一个串行系统中，Sampler 等 Trainer、Trainer 又等环境反馈，GPU 可能周期性空闲。解耦意味着可以独立扩容两种资源，而不必按相同 GPU 型号/配置绑定。

~~~mermaid
flowchart TD
    C[RL controller] --> I[Inference pool / Samplers]
    I --> E[Sandbox environments]
    E --> R[Rewards + trajectories]
    R --> T[Trainer pool]
    T --> W[Versioned weight sync]
    W --> I
    T --> K[Checkpoints / audit]
~~~

但系统额外引入网络、版本管理、失败恢复与梯度/推理数值一致性问题。因此解耦只有在吞吐收益超过协调开销时才值得。

## 2. 为什么 RL 不仅是一个 Trainer？

一个简化的 RL 优化目标是最大化 E[R(τ)]，其中 τ 是模型执行轨迹。实际实现还需处理：

1. Trajectory 分组和 Tool Observations。
2. Reward 可信度、Reward Hacking 与结果可验证性。
3. Behavior Policy Version 与 Trainer 当前参数版本。
4. Rollout、训练数据、Checkpoint 的可追溯关系。
5. Trainer 和 Sampler 采用不同 Kernel/Precision 时的 Token Logprob 差异。

对于 PPO 类目标，概率比率 r = π_current(a|s) / π_behavior(a|s) 对新旧策略的差距敏感。如果异步采样产生太旧的 Trajectory，训练可能不再满足近似 On-policy 的假设。**Policy Staleness 是算法问题与分布式系统问题的交界处。**

## 3. Spindle 的多租户设计

Spindle 是 Modal 发布的开源、Tinker-compatible Training API Server，使用其云端资源管理和服务原语。它包括 Trainer Engines、Inference Pools、Multi-LoRA、批次调度、异步 Checkpoint 与 Delta Weight Synchronization 等功能。对真实 Agentic RL 来说，多个实验共享一组基础 GPU 可以填补 Trainer 等待 Rollout 的空窗。

LoRA 用低秩更新表示 W = W₀ + BA。在 Multi-LoRA 情况下，基础权重 W₀ 可共享，而不同实验维护自己的 Adapter、梯度和 Optimizer State。共享基础权重不等于共享训练状态；租户隔离和实验可复现性仍需独立保证。

Modal 报告的一个多客户端实验中，Trainer Busy Time 为：

| Clients | Busy Time（官方报告） |
|---:|---:|
| 1 | 37.0% |
| 2 | 70.0% |
| 4 | 87.7% |

增加 Client 可改善 Aggregate Utilization，但过高并发可能造成 Thrashing、排队以及每个 Client 完成时间变长。不能将 GPU Busy Time 当作训练质量或单实验速度的直接证明。

## 4. Numerical Correctness：Fireworks 的补充证据

Trainer 与推理引擎即使使用相同权重，也可能因 Kernel、精度、MoE Routing 或 Aggregation Order 差异而给出不同 Logprobs。Fireworks 记录了在某组 GLM 5.2 RL 实验中数值不一致伴随训练 Reward 崩溃，而经对齐后改善稳定性的案例。研究团队指出，某些 MoE 的 Expert Output Aggregation 不一致甚至能在专家路由相同时引入误差。

因此，系统需要同时记录：
- Tokenizer/Chat Template/Token IDs；
- Policy Checkpoint SHA；
- Rollout Engine 与 Trainer Engine 版本；
- Logprob Difference、KL、Loss、Reward 与梯度诊断。

这可以防止把系统数值错误误诊为“Reward 设计不好”或者“Learning Rate 不合适”。

## 5. 现实部署对照

| 问题 | On-prem | Controlled Hybrid |
|---|---|---|
| 数据及 Rollout | 全部内网；有权限的合成/脱敏训练集 | 只允许经审批可出域的数据与工具结果 |
| Serving/Sampling | 自托管模型推理 | 受控云 GPU 推理池可弹性扩容 |
| Trainer | 本地 GPU、训练框架和调度器 | 外部受控 Trainer；需版本和通信治理 |
| Checkpoints | 内部对象存储与备份 | 必须审批远程保存与复制、限制访问 |
| 网络及身份 | 内部 RBAC 与服务账户 | 双向身份、最小权限、传输加密、统一 Trace |
| 硬件限制 | 96GB 级单卡可从小模型 LoRA 开始；不能直接复制多 H200/B200 实验 | 可用更大 GPU 池，但有成本、数据边界和供应商依赖 |
| 回退 | 停止训练、恢复上一已验证 Checkpoint | 断网时停止外部执行，不把敏感数据降级外发 |

**关键限制**：Spindle 虽开源，但它的参考部署建立在 Modal 资源原语上，不等同于银行离线环境一键安装。若要完全 On-prem，需要选用/搭建本地 Control Plane、Scheduler、Trainer、Sampler 与状态存储。许可证和模型权重授权应按具体版本复核。

纯外部闭源 API-only 路线不具备控制 GPU Kernel、Trainer Engine 和调度器的能力，不能直接替代本方案。

## 6. 30–60 分钟实验

可先模拟 Trainer 共享的时间线：每个客户端的 Rollout 用不同等待时间，Trainer 每次只处理一个 Training Step。比较 1/2/4/8 Clients 的：

- Utilization = Trainer Busy Time / Wall-clock Time；
- Aggregate Updates/sec；
- 每客户端完成时间 P50/P95；
- Ready Queue 等待时间。

不要把 Python 时间模拟直接解释为真实 GPU Benchmark。进阶：使用独立 GPU 环境和小模型 LoRA，记录真实 Policy Version、Checkpoint 与 Logprob Parity。

## 7. 求职系统设计

**Design a multi-tenant RL post-training platform for tool-using agents.**

面试必须覆盖：多租户隔离、异步 Rollout、Weight Sync、Policy Lag、Sampler/Trainer 数值一致性、Checkpoint、失败恢复、GPU 成本、数据治理以及训练质量评测。Training API 是执行抽象，不是 PPO/GRPO 算法本身。

## 8. 三条知识沉淀

1. Rollout 与 Training 具有不同资源特征；独立扩缩容可能提高总体效率。
2. Multi-LoRA 共享 Base Model，但 Gradient/Optimizer/Checkpoint 必须隔离。
3. 更高的 GPU 利用率不是目的；单位有效实验成本、正确性和可复现性才是目标。

本期未获得足够可靠的跨组织独立复现与 X/LinkedIn 专业共识。后续重点：Policy Staleness 容忍上限、MoE 数值对齐和实际租户公平性。

