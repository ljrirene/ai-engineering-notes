---
layout: default
title: "Perplexity SPACE：Agent 执行沙箱为什么需要独立信任边界"
date: 2026-10-31
track: hybrid
tags: [research, architecture, systems]
permalink: /notes/2026/10/2026-10-31-hybrid-space/
---
# Perplexity SPACE：Agent 执行沙箱为什么需要独立信任边界

> **2026-10-31 的历史精读专题（2026-11-04 重新整理）** · 本文根据此前实际讨论的选题与公开一手资料重新组织，不声称逐字还原当天聊天原文。性能结果属于原文作者报告，未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-10-31-space-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。




## 选题筛选与一手资料
- [SPACE 开源仓库](https://github.com/perplexityai/SPACE) — Perplexity，2026-10-15 宣布开源。项目提供管理沙箱的 API、模板、进程与生命周期能力。
- [Escaping SPACE: Part I](https://www.perplexity.ai/hub/blog/escaping-space-part-i) — Perplexity Research，2026-09-23；讨论 VM 隔离、网络出口规则及攻击测试。
- [SPACE First Sandbox](https://github.com/perplexityai/SPACE/blob/main/docs/first-sandbox.md) — 最小本地功能路径。

**入选原因**：从“模型怎么规划工具调用”深入到“工具实际在什么权限域执行”，可迁移到任何 Agent Runtime，求职价值在 Agent Security、Infra、Cloud Native 和 MCP 工具隔离。

## First Principles：Planner、Execution、Policy 是三件事
Agent Planner 输出的是执行意图，不是系统权限。MCP Client 或工具执行器负责请求，独立运行时负责创建隔离环境；Policy Enforcement Point 则检查 RBAC、网络出口、操作范围、配额与审计。

以 SPACE 为例，每个执行任务可在 Firecracker microVM 中运行。管理面创建模板/沙箱，数据面创建 Command Session、接收输出。Application 决定执行什么；SPACE 不是开源版的完整 Perplexity Computer，也不负责模型的语义正确性。

~~~mermaid
flowchart LR
  U[User] --> P[Planner]
  P --> C[Tool / Runtime Client]
  C --> CP[SPACE Control API]
  CP --> V[Firecracker microVM]
  V --> E[Egress Policy Gateway]
  CP --> A[Audit]
~~~

独立隔离的重要性：即使沙箱内部有 root 权限，也不意味着能访问宿主 root。网络出口必须在 VM 外实施，不能只依赖 Guest 的 iptables。可见的 Egress 控制至少区分 DNS、SNI、HTTP Host、共享 CDN、多租户反向代理、重定向和非 HTTP 协议；基于 hostname 的 allowlist 不是充分的端到端身份验证。

## 已公开研究的安全提醒
早期 Escaping SPACE 研究涉及宿主逃逸与网络策略绕过，后续修复后重复测试没有成功获取目标回调；报告仅覆盖被测配置和尝试预算，不是“微虚拟机不可攻破”的证明。特别需要区分网络隔离、凭据保护和模型 Prompt Injection 三种威胁模型。

## On-prem / Hybrid 部署判断
| 层 | On-prem | Controlled Hybrid |
|---|---|---|
| Planner | 本地 LLM 与 Orchestrator | 可保留本地规划层 |
| Execution | 内网 Linux/KVM，受控 VM 集群 | 云端微 VM 仅处理获批数据 |
| Credential | Broker 发短期 scoped token | 出域前剥离内部凭据；Egress 受 Policy Gateway 控制 |
| Audit | 本地 Trace/不可篡改日志 | 跨域统一请求 ID、租户和数据分类 |
| 限制 | 本地 Kind 教程仍需 KVM、容器/网络组件 | 云节点跨境、延迟、成本、供应链必须审查 |

**实际部署条件**：SPACE 的本地参考部署要求 Linux 与虚拟化支持，不能仅以拥有 GPU 推理主机作为“可直接上生产”的充分条件。证据与执行结果需要独立持久化，流式命令输出不等于可靠审计日志。

## 30–60 分钟实验
无需运行真实未知代码。构造一个 mock Tool Executor，分别测试四项策略：允许读取临时工作目录、拒绝读取宿主 secret、拒绝未知出口域名、拒绝超出 scope 的删除。使用普通 Python subprocess 在演示环境中模拟授权逻辑，并注明**不是安全沙箱**。进阶再用 SPACE 官方本地安装文档验证真实 VM 分离。

## 系统设计面试
Design an isolated execution plane for autonomous coding agents. 要覆盖：Planner/Policy/Runtime 分层、微 VM 生命周期、网络 Egress、Secret Broker、审计、Snapshot/Resume、单租户隔离、故障恢复。三个收获：①模型不拥有执行权限；②沙箱和出口策略必须分开；③可回放的审计是系统功能，而非“模型自述”。


