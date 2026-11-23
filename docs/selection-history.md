---
layout: default
title: 选题筛选与历史记录
permalink: /selection-history/
---

## 2026-11-23：全库“主要贡献 / 创新点 / 证据边界”教学修订

用户发现 AutoRAGBench 原理演示只讲流程，没有先讲论文真正贡献。核对 [AutoRAGBench arXiv v1](https://arxiv.org/pdf/2611.25582) Section I 的 Contributions 后，明确其贡献是开放代码空间 Benchmark、系统与开发轨迹的联合评测、九任务×九 Agent 实证及公开资源；**不是新检索算法**。

修订覆盖当前 **16 篇**历史及新研究元数据（`studies.yml`）：逐篇新增 `contribution_type`、2–3 条 `contributions`、`innovation`、`innovation_boundary`。通过一个数据源在所有研究正文的概要与全部共享原理演示中展现，首页/归档显示明确创新摘要，不分别硬编码旧页。调整统一模板和样式，不重做互动步骤，也不改变原文 URL、`visual_lessons.json` 的现有原理和证据表述。特别区分论文创新、工程 PR、厂商案例以及跨来源综合。

**全库检查**：原有 16 个 `studies.yml` ID、16 个教学 lesson、16 个 Graph article、16 个 QA documents 和 37 道 QA 题一致；所有 `related` 目标与 article-to-article Graph 边均有效，没有发现现存数据 ID 断链。历史正文主要算法/PR 不在本次编辑范围，不宣称对所有外部网站进行了独立复现。此次只增加解读元数据与展示方式，没有修改论文实测数字或提升优先级。若后续发现某项贡献表述无法对应作者一手证据，应以原资料为准纠正。



## 2026-11-23：AutoRAGBench（用户指定，提前单篇发布）

**候选来源与决策**：本次不是常规三天期的广搜竞争；用户明确指定论文 [AutoRAGBench，2026-11-19 arXiv v1](https://arxiv.org/abs/2611.25582) 优先研究，所以本次**正式重点候选只有 1 项**，没有声称检查了 10 个新候选。核对了作者 [开源仓库](https://github.com/ZhanGHanG9991/AutoRAGBench) 的 README、目录和论文 Section III–VI。其方法是让 Agent 从零编写 /retrieve 服务，通过开发 self_check、代码冻结、禁止测试数据泄漏、原语料证据校验和五个隐藏 Reader 评分；论文数字未经本站独立复现。

| 主题与一手来源 | 与既有研究对照 | 本期决定 |
|---|---|---|
| **AutoRAGBench**，[论文](https://arxiv.org/pdf/2611.25582)、[代码](https://github.com/ZhanGHanG9991/AutoRAGBench) | 从 Agent 任务评测扩展到 Agent 自己写出的 RAG 服务；引入开放代码空间、开发轨迹与隐藏 Reader 评测 | **用户特选提前发布**；职业可迁移性和评测机制强，但预印本，来源为作者实验 |
| **Agent Evaluation Validity**，[既有研究]({{ '/notes/2026/11/2026-11-10-agent-evaluation-validity/' | relative_url }}) | 旧文重点为模型失败、环境故障和评分器错误的归因 | 不重复；建立前置联系 |
| **Contextual Embeddings / ColBERT**，[既有研究]({{ '/notes/2026/11/2026-11-01-onprem-retrieval/' | relative_url }}) | 旧文重点为如何改善具体检索模块的证据召回 | 不重复；解释自动优化可能改变哪些组件 |
| **Qdrant Cold HNSW**，[既有研究]({{ '/notes/2026/11/2026-11-22-qdrant-cold-hnsw/' | relative_url }}) | 旧文针对 HNSW I/O、冷启动与查询延迟的取舍 | 不重复；建立“组件性能 vs RAG 端到端评测”联系 |

**本期回查与审计**：对现有 15 篇文章在 studies.yml、Graph article 节点、Study QA documents/questions 的 ID、链接和导航字段进行一致性检查；新篇建立语义文章间边与跨层解释，原有文章与题库不删除。共享 visual-explainer Layout 未改动，新增 Wrapper 与 lesson；Guide 分类规则未变更，故未触发 Guide 全库重构。新增 3 道核验题和按真实新增 Markdown 抽取的分章节片段，不声称自动语义评分。尚未执行原论文 H800 实验，Pages 成功需在 GitHub Actions/实际站点另行确认。

## 2026-11-22：Qdrant 冷盘 HNSW I/O 取舍（新增一篇精读）

本期公开入口实际扫描 **10 个方向**：Qdrant Core/Helm、LangGraph Python/JS、SGLang、vLLM GPU/TPU、Hugging Face Transformers、Modal、Cloudflare。并非每个方向都取得 7–14 天内完整的一手实验；重点对下列 5 项核实了发布记录与机制。字典序优先工程迁移价值和可验证机制，随后考虑新鲜度。没有把仓库 release、PR 或作者 benchmark 冒充独立复现。

| 候选 | 一手来源及日期 | 决策 |
|---|---|---|
| **Qdrant v1.20.1 / #10743 HNSW offsets prefetch** | [11/13 Release](https://github.com/qdrant/qdrant/releases/tag/v1.20.1)、[PR #10743](https://github.com/qdrant/qdrant/pull/10743)（09/23 创建、10/23 合并） | **入选**。有具体 Rust diff、冷启动反例与不同并发 RPS 数据；学习 I/O 预取和端到端性能归因比单纯版本公告更可迁移。新版本发布不等于机制当天首次出现。 |
| Qdrant PiPNN 大段建图 | [11/13 Release](https://github.com/qdrant/qdrant/releases/tag/v1.20.1)、[milestone 56](https://github.com/qdrant/qdrant/milestone/56) | 暂缓。建图吞吐与冷查询属于不同问题，本轮未完成对应实验配置的源码与复现核查。 |
| LangGraph strict resume | [11/05 Release](https://github.com/langchain-ai/langgraph/releases/tag/1.2.20) | 不单独成篇；与旧 Super-agent 的任务恢复/人工批准机制重叠，适合修订旧文。 |
| LangGraph JS stream cancellation | [11/09 Release](https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain/langgraph%401.7.3) | 工程上重要，但改动范围相对窄，适合作为 Agent 生命周期补充。 |
| SGLang v0.5.23 / Paged Experts | [11/02 Release](https://github.com/sgl-project/sglang/releases/tag/v0.5.23) | 已有专篇，不重复；相同数据搬运思想可建立跨层对照。 |

已回查当前 **14 篇**研究元数据、文章图谱 ID、QA 文档 ID 和原有交互图链接；新文连到 RAG 检索和 Paged Experts，分别说明语义质量 vs I/O、权重分页 vs 图偏移预取。无旧文覆盖或删除；未修改 Guide 分类规则。


# 2026-10-31 至 2026-11-04：历史选题筛选说明

> **重要说明**：下表不是对当时搜索日志的复刻。既有对话确认了当日选题，但部分原始候选列表与搜索数量无法恢复。这里依据保留的研究主题和经重新核查的一手来源总结“入选理由”，不虚构候选搜索总数、实时社区讨论或当时逐一淘汰的排名。

## 2026-11-19：候选核查记录（未新增技术精读）

本期实际检查 10 个项目/方向的公开资料入口：Qdrant、Qdrant Helm、LangGraph Python、LangGraph JS、vLLM GPU、vLLM TPU、SGLang、Modal、Cloudflare、Hugging Face TGI。并非所有方向都取得了符合时窗的完整原始资料；没有声称逐个完成源码或 benchmark 复现。已有知识库最新专题为 11/13 的 KVGuard，故首先排除内容重叠。

| 进入重点比较的候选 | 可核实的一手资料 | 结论 |
|---|---|---|
| Qdrant 1.20.1：HNSW 大段建图与磁盘冷读优化 | [11/13 Release](https://github.com/qdrant/qdrant/releases/tag/v1.20.1) | **暂缓，最值得进一步核查**。RAG 检索系统价值高，发行说明涉及 PiPNN 建图、冷盘多条件过滤、减少 HNSW 读次数；但本轮没有核实完整 benchmark、索引大小/磁盘条件与代码差异，不应凭 Release 直接写性能结论。与旧 RAG 文章主题不同，若证据充分可作为独立专题。 |
| LangGraph 1.2.20：strict resume | [11/05 Release](https://github.com/langchain-ai/langgraph/releases/tag/1.2.20) | **旧文修订候选**。过期人工批准不能直接恢复的设计值得补入长期 Agent 的安全边界，但目前更像 Super-agent / Agent 运行时文章的具体增量，不单开新篇。 |
| LangGraph JS 1.7.3：取消流时停止运行 | [11/09 Release](https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph%401.7.3) | **旧文修订候选**。取消订阅后后台执行是否继续，是 Agent 生命周期问题，适合与 strict resume 合并讨论；本次没有验证跨语言实现细节。 |
| Modal Sandbox resourcing | [官方博客目录](https://modal.com/blog) | **暂缓**。Burst/Reserve 容量经济性重要，但尚未核实单篇原始发布时间、定量工作负载与 On-prem 对照，不能把厂商定价思路当作通用实验结论。 |
| SGLang 0.5.23：MoE 与 Prefill | [11/02 Release](https://github.com/sgl-project/sglang/releases/tag/v0.5.23) | **落选**。大量优化与既有 Paged Experts / ReplaySSM 文章重叠，且其中部分结果绑定高端 GPU；单一新原理尚未充分隔离。 |

其他排查：vLLM [GPU 项目](https://github.com/vllm-project/vllm/releases)与[TPU 项目](https://github.com/vllm-project/tpu-inference/releases)（需区分两者，不可混称）；[Qdrant Helm 1.20.1](https://github.com/qdrant/qdrant-helm/releases/tag/qdrant-1.20.1)主要是部署更新；[Hugging Face TGI](https://github.com/huggingface/text-generation-inference) 已归档，不能当作本期活跃发布；Cloudflare 检索未取得足够明确的近期原始研究资料。

**本期结论：不凑新文章。** 已检查现有研究元数据、图谱、QA 索引与题库的结构入口；本次未改变知识分类、文章或图谱，不触发新文章的 QA 增量。下一轮优先对 Qdrant HNSW 冷盘检索进行 PR、算法和可复现实验的深入核查；如果不具备足够一手证据，优先修订现有 Agent 长任务恢复与取消语义文章。此处只是候选研究记录，不宣称实测或生产验证。

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


## 2026-11-13 · KVGuard：KV Cache 请求级安全

实际扫描 11 个方向：KVGuard、MORTIS、Fairway、Modal gVisor、Modal Sandbox Events、vLLM Releases、SGLang Roadmap、Hugging Face CWE-bench v2、Hugging Face Document Field Extraction、Modal/Snorkel Eval、Modal Sidecars。重点核查五个候选；优先比较岗位迁移价值与技术深度，再看新鲜度。

| 候选（一手资料） | 决定 |
|---|---|
| [KVGuard（11/04）](https://arxiv.org/abs/2611.06138) | **入选**。请求级 KV 内存安全通用；跨 vLLM/SGLang 有缺陷回放与实验设置。作者实现的独立开源仓库未确认。 |
| [MORTIS（11/05）](https://arxiv.org/abs/2611.08638) | Agent Prompt 缓存编译器协同很有深度，但依赖 Typed Program，迁移范围较窄。 |
| [Fairway（11/01）](https://arxiv.org/abs/2611.02082) | KV 命中与队列公平性重要，适合后续独立研究。 |
| [Modal gVisor（11/11）](https://modal.com/blog/modal-gvisor-maintainer) | 工程内容丰富，但与旧 SPACE Sandbox 的执行隔离主题重合，优先旧文修订。 |
| [Modal Sandbox Events（11/12）](https://modal.com/changelog) | 可用性更新，技术原理不足以成为单独深读主题。 |

已对照 13 篇旧文；Paged Experts 管权重容量、KVGuard 管 KV 请求权限，Agent Eval 关注失败归因，存在真实互补。作者数据未经本站复现；本期保留所有旧文/QA/图谱内容。新增 3 道 QA 题与 11 个按新增 Markdown 章节抽取的片段。
