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


## 2026-11-04 · 用户指定的补充专题（不计入自动三天一期）

- **指定资料**：[DeepSeek Harness：《Super-agent 设计探索》](https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg)，2026-10-31；[官方研究原型](https://github.com/deepseek-ai/dsh-superagent-prototype)，为设计/原型阅读的主要证据。
- **补充理由**：既有 [Thin Orchestrator]({{ '/notes/2026/11/2026-11-01-hybrid-agents/' | relative_url }}) 主要讨论专门 Agent 路由和共享工作区；DeepSeek 进一步覆盖跨渠道 Event Admission、Thread 路由、Context Chain、Async ReAct、Watchdog、持久 Mandate。属于清晰的知识扩展，而不是对旧文章同题重复。
- **局限及可核实批评**：原型自称非生产级、与设计文章并非完全一致；[独立评论](https://blog.vonng.com/ai/ds-super-agent/) 主张工作 Context/授权边界必须显式，而不是让单入口 Router 猜测。实验负载较简化，不能证明真实大型软件项目的任务质量。
- **筛选性质**：本条由用户明确指定查找并加入，**没有进行常规 10+ 候选开放竞争筛选**，不应编造其它候选或落选排名。
- **交付**：[研究全文]({{ '/notes/2026/11/2026-11-04-cross-deployment-superagent/' | relative_url }}) · [交互架构图]({{ '/interactive/2026-11-04-superagent-map.html' | relative_url }}) · [知识星图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})。


## 2026-11-07 · Paged Experts（本次正式三天一期）

**扫描方式**：核对 SGLang v0.5.23 官方 Release、2 个核心 PR（#42557、#45787）及其可核实的实验，比较 vLLM、Transformers、独立论文等公开一手资料。实际记录 **11 个具体候选**，其中 5 个进行机制级对照。部分候选只是 release 中的具体特性，未独立核验全部发布日；没有虚构 Reddit 热度。

| 候选 | 可核实日期 | 一手来源 | 决策 |
|---|---|---|---|
| SGLang Paged Experts | 2026-11-02 v0.5.23；核心 PR 10-19、量化扩展 10-25 | [来源](https://github.com/sgl-project/sglang/releases/tag/v0.5.23) | 入选：高迁移性、明确的缓存/PCIe/量化机制、详细对照和可审计 PR。 |
| SGLang low-latency megakernel | 2026-11-02 release | [来源](https://github.com/sgl-project/sglang/pull/44945) | 落选：重要但主要集中 GB300/MI350X 特定 GPU Kernel，单卡通用迁移性较弱。 |
| SGLang MoE TTFT optimization | 2026-11-02 release | [来源](https://github.com/sgl-project/sglang/pull/43363) | 落选：有性能提升但主要是引擎优化集合，较难独立构成统一教学单元。 |
| SGLang quantized MoE LoRA | 2026-11-02 release | [来源](https://github.com/sgl-project/sglang/pull/45892) | 落选：值得后续单独追踪，但与本期权重管理的基础机制相比更偏格式/Adapter 扩展。 |
| SGLang HiCache MLA L3 | 2026-11-02 release | [来源](https://github.com/sgl-project/sglang/pull/41187) | 落选：与已有 Stateful/Context 研究有一定重叠。 |
| SGLang TPU7x TorchTPU | 2026-11-02 release | [来源](https://github.com/sgl-project/sglang-torchtpu) | 落选：新硬件支持但目标部署可迁移性次于单卡 MoE。 |
| vLLM v0.33.0 release candidate | 2026-11-02 rc3 | [来源](https://github.com/vllm-project/vllm/releases/tag/v0.33.0rc3) | 落选：跨多功能的 RC，缺少单一问题的清晰复现实验。 |
| vLLM v0.32.0 | 2026-10-18 | [来源](https://github.com/vllm-project/vllm/releases/tag/v0.32.0) | 落选：不如本期近期具体机制聚焦。 |
| JAM Just-In-Time Agent Memory | 2026-09-28 arXiv | [来源](https://arxiv.org/abs/2609.34385) | 落选：记忆机制重要，但距今更久且与近期 Super-agent Context Chain 有部分重合。 |
| Transformers 5.x Generation / Cache fixes | 近期 release 页面，单项日期未逐条核实 | [来源](https://github.com/huggingface/transformers/releases) | 落选：多个正确性修复但主题较分散。 |
| SGLang PD Disaggregation | v0.5.22 release，确切发布日未核实 | [来源](https://github.com/sgl-project/sglang/releases/tag/v0.5.22) | 落选：有长上下文 SLO 价值，但较依赖多实例 PD 部署，当前选题优先级较低。 |

**严格字典序结论**：优先岗位迁移性，其次技术机制深度，再考虑新鲜度；SGLang Paged Experts 兼具 GPU 内存层次、MoE、CUDA Graph、量化正确性与可复现 CPU Mock。与既有 ReplaySSM（SSM State I/O）和 Sticky Sessions（Session Affinity）不是重复主题，故新增一篇而非覆盖旧文。

**原始日期核对**：功能主 PR 10-19 合并、量化扩展 10-25 合并，11-02 进入 v0.5.23 Release；不能写成“11-07 首次发布”。

**交付**：[正文]({{ '/notes/2026/11/2026-11-07-paged-experts/' | relative_url }}) · [交互架构图]({{ '/interactive/2026-11-07-paged-experts-map.html' | relative_url }}) · [知识星图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})。



## 2026-11-10：Agent 评测有效性与可复现执行环境

本期实际扫描 11 个方向：SGLang v0.5.23 的 Paged Experts、Megakernel、MoE TTFT、量化 LoRA，vLLM 最新 KV/Hybrid/Speculative，Modal/Snorkel Agent Simulations，Modal Spindle、Sticky Sessions、Endpoint Candidates，Cloudflare Dynamic Workers，Terminal-Bench/Harbor。并非全部方向均为过去 14 天新发布，未声称查到独立社区共识。

| 重点候选及一手资料 | 结论与原因 |
|---|---|
| [Modal/Snorkel，2026-11-06](https://modal.com/blog/how-snorkel-runs-realistic-agent-simulations-with-modal) + [Terminal-Bench/Harbor](https://github.com/harbor-framework/terminal-bench) | **入选**。模型能力与环境故障的归因高度通用，公开工具可复查；客户规模/成本为自报。 |
| [vLLM releases](https://github.com/vllm-project/vllm/releases) | 更新丰富但涉及多个独立机制，需锁定单一有实验的技术问题。 |
| [SGLang v0.5.23](https://github.com/sgl-project/sglang/releases/tag/v0.5.23) | Paged Experts 已于 11-07 精读；Megakernel/TTFT 较依赖硬件。 |
| [Modal Spindle](https://modal.com/blog) | 采样与训练分离已于 11-04 研究，本期不足以再造一篇。 |
| [Cloudflare Dynamic Workers](https://blog.cloudflare.com/dynamic-workers/) | 2026-03-24 的基础研究较旧，且与 SPACE 安全执行主题部分重合。 |

已对照全部 12 篇旧研究的主题、导读与关联；最强关系是 SPACE（安全执行边界）与 BrowseSafe++（攻击检测评测），本篇新增的是环境有效性、可信 Verifier、失败归因与统计设计。原始 Snorkel 账单与私有 Trace 不公开，不能验证 20% 成本节省。

[正文]({{ '/notes/2026/11/2026-11-10-agent-evaluation-validity/' | relative_url }}) · [原理演示]({{ '/interactive/2026-11-10-agent-evaluation-validity-map.html' | relative_url }}) · [知识关系图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})。

