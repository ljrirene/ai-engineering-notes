---
layout: default
title: 选题筛选与历史记录
permalink: /selection-history/
---
# 2026-10-31 至 2026-11-04：历史选题筛选说明

> **重要说明**：下表不是对当时搜索日志的复刻。既有对话确认了当日选题，但部分原始候选列表与搜索数量无法恢复。这里依据保留的研究主题和经重新核查的一手来源总结“入选理由”，不虚构候选搜索总数、实时社区讨论或当时逐一淘汰的排名。

## 固定筛选原则
优先级是严格顺序：**岗位相关性（可移植至 On-prem/Hybrid）→ 真实技术价值 → 时间上的新鲜度 → 可核实社区评价 → 是否当天发布**。同一原理跨两种部署合并，互补问题则保持双路径。

| 日期 | On-prem 研究 | Hybrid 研究 | 入选的主要逻辑 |
|---|---|---|---|
| 10/31 | [ReplaySSM]({{ '/notes/2026/10/2026-10-31-onprem-replayssm/' | relative_url }}) | [SPACE]({{ '/notes/2026/10/2026-10-31-hybrid-space/' | relative_url }}) | 一手 Kernel/推理机制与安全执行边界，较一般版本发布更有迁移价值 |
| 11/01 | [Contextual + Multi-vector Retrieval]({{ '/notes/2026/11/2026-11-01-onprem-retrieval/' | relative_url }}) | [Thin Orchestrator + Git Workspace]({{ '/notes/2026/11/2026-11-01-hybrid-agents/' | relative_url }}) | 分别优化 RAG 证据恢复与长期 Agent 状态；每组内部有可合并的共同问题 |
| 11/02 | [Decision Models]({{ '/notes/2026/11/2026-11-02-onprem-decision-models/' | relative_url }}) | [GPU Auto-repair]({{ '/notes/2026/11/2026-11-02-hybrid-gpu-auto-repair/' | relative_url }}) | 多家模型验证“非生成式决策”趋势；GPU 修复文章披露证据门、熔断与复验 |
| 11/03 | [Sticky Sessions]({{ '/notes/2026/11/2026-11-03-onprem-sticky-sessions/' | relative_url }}) | [Endpoint Candidates]({{ '/notes/2026/11/2026-11-03-hybrid-shadow-traffic/' | relative_url }}) | 深入有状态路由与安全灰度发布，均可做本地无 API 实验 |
| 11/04 | [BrowseSafe++]({{ '/notes/2026/11/2026-11-04-onprem-prompt-injection/' | relative_url }}) | [Spindle]({{ '/notes/2026/11/2026-11-04-hybrid-spindle/' | relative_url }}) | Prompt Injection 防护基准与 Agentic RL 训练基础设施，属于不同系统问题 |

## 已重新核实的一手资料（决选材料）

- ReplaySSM: [arXiv:2610.13778](https://arxiv.org/abs/2610.13778)（论文 10/09）；基于带宽与 recurrent state 的具体新机制入选。
- SPACE: [开源实现](https://github.com/perplexityai/SPACE)（10/15）；比普通 Agent 产品功能有更扎实的执行面分离价值。
- Perplexity Retrieval: [Contextual](https://www.perplexity.ai/hub/blog/contextual-embedding-beyond-the-gold-passage)（09/30）与 [Multi-vector](https://www.perplexity.ai/hub/blog/multimodal-embeddings-beyond-a-single-vector)（10/07）；共同提供证据恢复与索引成本的技术权衡。
- Meta: [Thin Orchestrator](https://engineering.fb.com/2026/10/19/ml-applications/thin-orchestrator-ai-agent-architecture/)（10/19）和 Perplexity [Shared Workspaces](https://www.perplexity.ai/hub/blog/building-shared-workspaces-for-people-and-agents)（10/12）；两项工程案例从不同方向解决 Agent 稳定性与持久协作。
- Decision Models: [Oumi Jev](https://www.oumi.ai/blog/how-to-build-a-decision-model-like-jev)（10/19）、[Baseten joey-1](https://www.baseten.co/blog/decisions-for-a-penny-introducing-joey-1/)（10/29）、[Lumma-Fev-v2](https://huggingface.co/blog/FrontiersMind/lumma-fev-27b-v2)（10/29）；多来源同一计算接口问题。
- Together: [GPU Auto Repair](https://www.together.ai/blog/auto-repair-for-together-gpu-clusters)（10/27）；关键在明确的安全动作和负面失败模式。
- Modal: [Sticky Sessions](https://modal.com/blog/serverless-routing-made-sticky)（10/20）；解决带状态的模型 Serving。
- Modal: [Endpoint Candidates](https://modal.com/blog/endpoint-candidates)（10/12）；有流镜像有界缓冲的具体设计，体现真正 Infra 深度。

## 关于未入选候选
已知研究过程中参考过额外文章，例如 Modal 的 10 月 GPU/VM 平台更新、Legora Agent Evaluation、Perplexity 相关模型/产品公告、Together 的容量扩张消息等。但**不能在缺少原始筛选记录时，将它们伪称为某一天被明确淘汰的候选或赋予编造的分数**。后续每天的研究会在当期同步保存候选名单、发布时间与入/落选理由，形成真正可审计的选择链。

