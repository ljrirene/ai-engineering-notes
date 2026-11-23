---
layout: default
title: "AI 能自己优化 RAG 吗？从自动写代码到验证检索质量"
date: 2026-11-23
track: cross-deployment
tags: [rag, agent, evaluation, retrieval, benchmark, ml-systems, sandbox, automation]
permalink: /notes/2026/11/2026-11-23-autoragbench/
---
# AI 能自己优化 RAG 吗？从自动写代码到验证检索质量

**[打开中文交互原理演示]({{ '/interactive/2026-11-23-autoragbench-map.html' | relative_url }})** · [知识关系图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }}) · [选题记录]({{ '/selection-history/' | relative_url }})

> **提前发布说明（2026-11-23）**：用户指定 AutoRAGBench（arXiv:2611.25582）为优先专题。本篇为用户特别选题，不代表它通过当期常规候选竞争，也不改变每三天的自动选题周期。公开资料、代码可读性检查与本站独立推导分别说明；本站没有执行论文原始 H800 × 六小时实验。

**它解决什么？** RAG 的切分、索引、检索、重排和证据选择是相互影响的设计决策，让 Agent 自动改代码并测试，可能降低试错成本，也可能对开发集过拟合。**你会学到什么？** 怎样设计能验证真正收益的 Agent-to-RAG 工程循环，包括证据边界、隐藏测试集、独立 Reader、可复现执行和发布门禁。

## 1. 先看原始资料：贡献是什么，证据是什么

- **论文**：[AutoRAGBench: A Benchmark for LLM Agents Automating RAG System Development](https://arxiv.org/abs/2611.25582)，2026-11-19 提交 arXiv v1；作者来自清华大学与新浪微博。论文为预印本、曾注明提交 IEEE 审稿；不能当作已获独立同行复现的成熟生产结论。
- **论文 PDF**：[arXiv:2611.25582v1](https://arxiv.org/pdf/2611.25582)；关键方法在 Section II–V，结果在 Section VI，尤其 Figure 2、Table I、Table II、Figure 6–9。
- **作者源码**：[ZhanGHanG9991/AutoRAGBench](https://github.com/ZhanGHanG9991/AutoRAGBench)（仓库 README 声明 MIT）。其目录公开包含 tasks、configs、materials、selfcheck、gateway、multireader、audit、traces、baselines、scripts 和 examples/minimal_eval.py；数据包有外部下载入口和校验说明。**可以审读源码与尝试小样本示例，不等于本站已经复现完整 9 任务。**
- **证据标记**：下文注明“论文作者报告”的分数、成本、延迟属于原作者实验；“本站工程推导”与“教学实验”不代表该论文实测。模型及 Harness 名称按论文当时的实验配置记录，不等于独立验证其宣传名称或部署资格。

**论文真正的新问题**不是“又发明一种检索算法”，而是把 RAG 开发本身定义为受资源、数据访问和评测约束的 Agent 工程任务。传统 AutoRAG 类工具通常在预设的配置/管线集合里搜索；这里允许 Agent 写入和替换整个检索逻辑，再检查其最终产物是否真正改善回答。作者比较了 9 种 Agent 配置、9 类检索任务，以及开发过程的轨迹。

## 2. 第一性原理：RAG 优化究竟优化什么

给定语料 C、用户问题 q、检索程序 R 和回答模型 G，先取出证据 Z，再生成答案：

\[
Z_q=R(q;C,\theta_R), \qquad \hat y=G(q,Z_q;\theta_G).
\]

R 不仅是向量数据库查询；它还决定文档切分、召回策略、候选融合、重排、图遍历、证据截断、超时和是否拒答。设任务说明为：

\[
\mathcal T=(C,D_{\mathrm{dev}},B,K),
\]

其中 B 是六小时/GPU/内存等资源预算，K 是允许的数据、网络和模型使用规则。Agent a 由基础模型 M 与执行 Harness H 构成：a=(M,H)。每轮根据之前的代码、实验和错误输出选择动作 u_t：

\[
u_t=\pi_a(\mathcal T,h_{t-1}),\quad
o_t=\mathrm{Exec}(u_t),\quad
h_t=h_{t-1}\oplus(u_t,o_t).
\]

最终交付物 S=Build(a;\mathcal T) 是 **可执行的 RAG 服务**，不是 Agent 在聊天中描述的设计图。

真实工程是多目标问题：

\[
\max_S Q_{\mathrm{answer}}(S),\quad
\min_S L_{\mathrm{retrieval}}(S),\quad
\min_S C_{\mathrm{train+serve}}(S),
\]

同时满足 ACL 正确性、证据可追溯性、数据驻留、CPU/GPU/内存上限、依赖安全和版本可复现性。**论文主要量化答案质量与检索延迟；权限安全、完整财务成本和运行维护是本站提出的生产扩展约束，不是作者已证明的结果。**

一个设计常见的错觉：把 top-k 从 5 改为 20，开发集可能增分，但上下文噪声、重排开销、跨租户越权风险和生成 token 都可能增加。RAG 优化不能只最大化一个开发指标。

## 3. Benchmark 合同：为什么它比自动“调几个超参”更严格

论文的九项任务覆盖不同检索形态：

| 类别 | 数据集 | 测试指标 |
|---|---|---|
| 开放域 QA | NQ-open | EM |
| 多跳文档问答 | HotpotQA、MuSiQue、MultiHop-RAG | F1、F1、EM |
| 领域 QA | PubMedQA、QASPER | Accuracy、F1 |
| 事实核验 | FEVER | Accuracy |
| 知识图谱问答 | WebQSP、CWQ | Hits@1 |

论文 Table I 的 corpus records 从几百到两千余万不等；最多保留 10,000 个训练例子，测试集通常 1,000 条（MH-RAG、PubMedQA 为 500）。**指标属于不同任务，不能把平均分理解成统一校准的企业 KPI。**

**构建阶段**：开发容器提供任务语料和带答案的训练例，允许在给定规则内安装依赖、编写代码、使用 self_check、改索引、尝试新策略。作者实验给每次构建一个 H800 80GB、12 CPU、240GB 主机内存、200GB 工作空间和六小时；构建时可使用受控互联网，受禁用测试集、外部语料等约束。主实验的 Agent API 消耗与 GPU 资源并非一回事。

**提交合同**：最终服务实现 HTTP POST /retrieve，给出按顺序排列的**来自指定语料的原始证据片段**，附 doc ID、标题和原文。LLM 生成的假想文档、总结、推测答案可以帮助检索，但不能伪装成原语料引用。冻结提交之后，不得继续训练或根据测试题动态改实现。

**测试阶段**：离线、不可联网、工作区只读；先做异常行为审计，再让隐藏测试集调用冻结的 /retrieve。证据先被验证 doc ID/title/text 与语料一致，然后按统一顺序和窗口限制打包，再让 5 个从未参与开发反馈的 Reader 分别作答。作者开发自检 Reader 用 Qwen3.5-4B；隐藏测试 Reader 为 Gemma 4 E4B、Gemma 3 4B、Phi-4-mini、SmolLM3-3B、Llama-3.2-3B。Reader 并非“没有模型”，而是**在评测层与构建层隔离的固定模型**。

论文设定每题最多四次开发时的 Qwen3.5-4B 网关调用、32,000 tokens、60 秒上限；最终证据前缀受 32,000 字符 / 12,000 Qwen tokens 限制，并须适配五个 Reader 的上下文。若证据无效、模型调用失败或预算越界，判为无效预测。详见论文 Section V-E。

## 4. 评分、隔离与可信度：什么是最重要的算法思想

对于任务 k、冻结 RAG S、固定 Reader G、隐藏测试集的 n_k 道问题，定义

\[
Q(S;k,G)=\frac{1}{n_k}\sum_{i=1}^{n_k}
\mu_k\bigl(G(q_i,R_S(q_i)),y_i\bigr).
\]

跨 Reader 的分数按五个模型算术平均：

\[
\bar Q(S;k)=\frac1{|\mathcal G|}\sum_{G\in\mathcal G} Q(S;k,G),
\quad
Q_{\mathrm{overall}}(S)=\frac19\sum_{k=1}^{9}\bar Q(S;k).
\]

**为什么固定多个 Reader？** 同一检索证据给不同回答模型可能产生不同得分。固定 Reader 集合避免 Agent 私下更换答案模型而让检索评分失去可比性；统计排名对 Reader 选择是否敏感，还能识别“检索证据确实强”与“碰巧适合某个 Reader”。但五个 Reader 仍来自有限模型分布，不能代表任何业务模型或语言。

**验证器和 Agent 分开**：Agent 能写代码、调用命令和 self_check，但不能读取隐藏测试答案、修改评测脚本、伪造语料文本，也不能把运行时生成的答案当作原始证据。作者在审计里使用模型辅助检测轨迹，再人工检查可疑运行；验证违规后重新运行，仍不合格则回退 BM25 基线分数。此为作者协议，不等于所有潜在污染均被排除。

下面是**本站建议的企业级发布算法**（不是原论文原样代码）：

~~~python
# 伪代码：受控构建 -> 可信评测 -> 人工审批
best = immutable_baseline
for candidate in sandboxed_builder(max_trials=K, source_allowlist=True):
    assert candidate.only_reads(approved_corpus)
    assert candidate.has_no_eval_secrets()
    dev = scorer.score(candidate, rotating_validation_slice)
    record_trace(candidate.commit_sha, data_hash, dev, elapsed, costs)
    if passes_quality_latency_acl_gates(dev, candidate):
        best = select_by_paired_evidence(best, candidate)
frozen = sign_artifact(best)
final = isolated_evaluator(frozen, hidden_holdout)
publish_only_if(approved(final) and security_review(frozen))
~~~

在真实企业数据中，**ACL 检索过滤必须在可信服务执行，不允许 Agent 自己生成 ACL 判断后直接信任结果**；所有日志仅留合成/脱敏标识。推荐对差值做配对 bootstrap / 分层区间估计，并给最小效果阈值，而不是反复比较开发集上的微小提升。

## 5. 论文报告了什么成绩，为什么不能说 Agent 全面胜过工程师

Table II 的九任务×五 Reader 平均分（0–100）：

| 系统 | 平均分 | 解释 |
|---|---:|---|
| GPT-6.1 Sol / Codex CLI | **56.08** | 论文最高的构建配置 |
| GPT-6 Sol / Codex CLI | 54.10 | 同 Harness 不同模型 |
| GPT-5.6 Sol / Codex CLI | 51.21 | 第三 |
| GLM-5.3 / Claude Code | 50.50 | 第四 |
| Reference RAG | 46.42 | 固定参考检索系统 |
| Human-SOTA composite | 44.43 | 按任务挑最好的**改编实现** |
| BM25 baseline | 36.66 | 简单稀疏检索 |
| Closed-book | 25.30 | 不提供检索证据 |

**关键限定**：Human-SOTA 并非真实人类团队同样六小时做出的最强系统；作者以预先发表的人类设计方法为基础、改编到其统一服务接口/语料/Reader 约束，为每种方法最多提供 24 小时，并拼出按任务择优的组合包络。两组预算不同、方法被迫适配、没有独立复现。56.08 > 44.43 只能证明**在作者的这一协议下**该 Agent 构建配置的平均分更高，不能证明“AI 普遍胜过人类”。

论文还报告：同样七项任务中，从人工设计方法出发改进的 Agent 在其协议下平均 +16.6 分；但适配原有机制的构建与自由从零构建之间存在约束差异，不能将差值归因于唯一因素。

**性能并非免费**：论文报告 Agent 构建系统的平均检索延迟约 0.50–2.01 秒/题，Reference RAG 约 0.35 秒，Naive BM25 约 0.10 秒（不含最后回答模型生成）。更高质量通常付出检索计算/模型调用代价；平均数也不等于 p99 或高并发资源利用。

**API 构建成本**：原论文九任务 API 合计举例约 GPT-6.1 Sol 167 美元、GPT-6 Sol 450 美元、Qwen3.8 Flash 6 美元；这不是统一的单任务账单，也**不包含**所有 H800 计算、电力、人力、数据工程、线上推理与安全审计开销。不可直接拿来做成本回收预测。

## 6. 真正值得警惕的是开发集过拟合

论文对 77 次至少两个可比较版本的开发过程分析：**72 次曾比初始版本高至少 1 分；其中 20 次最终观测到的开发分数比历史最佳低至少 1 分；第一版到最后可比较版的中位开发收益为 +5.5 分**。这些属于轨迹观察，不是随机对照实验。

一个尤其有意思的例子：GPT-5.6 Luna 在自己开发问题上中位净收益 +10.0 分，但最终隐藏测试排名靠后；它更频繁地在完整开发问题文件上反复 self_check。在 NQ 的某次检查，常测的 100 题为 53.0，之前未测的 100 题为 35.0。不过作者进一步分组发现，其他配置在这些题上也存在明显难度差，**因此不能把全部差值武断认定为测试泄漏或记忆**。

可迁移的工程原则：

1. 把“第一次实验、历次最佳、最后提交版、隐藏测试版”四种分数分开保存。
2. 固定完整评测协议，同时轮换开发样本；不能用反复被看的同一小组题充当独立验证。
3. 对最终模型/索引与答案执行冻结和签名；新代码/索引必须能够回滚。
4. 测 retrieval recall / evidence faithfulness / answer accuracy / latency / ACL correctness 的组合，而非只看 Agent 的自评。
5. 改善开发分数不等于隐藏测试泛化；只有可信的独立 holdout 才能判断。

### 本站合成例子（不是论文实验）

假设 A 版在 20 道开发问题上正确 12 道，B 版反复调试后正确 18 道；但在**从未展示给 Builder 的**另 20 道中，两者分别正确 14 和 12 道。开发涨 30 个百分点，隐藏测试下降 10 个百分点。这个例子帮助理解“调优目标与泛化目标不同”，不声称它是 AutoRAGBench 数据。

## 7. 为什么自由改代码与管线搜索不一样

假设预定义空间只有 {BM25,dense} × {top-5,top-20} × {rerank,no-rerank}，搜索最多考察八个组合。它无法自己发明：

- 为多跳问题追加桥接实体，选择第二轮不同的 query；
- 在图谱 QA 中直接沿关系边遍历，而不是先向量化三元组；
- 对 QASPER 先识别被问论文，再只在文章内部排序；
- 在 FEVER 先精确匹配事实主张与实体，再判断支持/反驳；
- 对不同问题动态收缩证据数量，或者把 doc-level 与 passage-level 候选合并。

论文观察到最终系统设计随任务发生明显变化，例如 KGQA 使用图遍历，QASPER 在指定文档内排序，FEVER 多数方案不依赖稠密向量。**这说明 Agent 表现出任务适配策略；但观察策略与分数相关并不足以证明某个具体组件的因果贡献，仍需组件消融**。论文也是如此限定的。

Agent 的本质能力在此是对目标系统的**可执行代码与实验控制流**进行搜索；它和运行时服务本身是两回事。生产检索服务不一定持续运行 Agent；可以先让 Agent 在隔离实验环境找到候选版本，发布后把服务变为固定、审计过的普通 RAG。

## 8. 五层可信边界：能生成代码的 Agent，不能替企业决定权限

一套可审计的工程抽象：

| 组件 | 输入 → 输出 | 应由谁信任 | 核心失败 |
|---|---|---|---|
| 数据准备/策略服务 | 允许的语料、训练分割、ACL 策略 → 只读任务包 | **可信**数据管理员 | 误把测试答案/机密发给 Builder |
| Builder Agent | 任务包、工具日志 → 源码、索引构建命令 | **不可信建议者** | 依赖投毒、越权工具调用、硬编码答案 |
| 隔离 Sandbox | 候选代码、资源配额 → 可执行产物、Trace | 可信隔离边界 | 容器逃逸、网络绕行、凭据泄漏 |
| 开发自检 | 候选产物、开发题 → 测试结果 | 限权、有配额 | 答案过拟合、重复测同一题 |
| 独立审核/评分 | 冻结产物、保密测试题 → 得分与证据审计 | **独立可信** | 评测泄漏、Judge 漂移、污染样本 |
| 发布门禁 | 代码摘要、性能/权限报告 → 签名版本 | 人工/策略双重批准 | 低分却上线、不可回滚、错误 ACL |

生产版本应增加访问控制继承、文档更新传播、来源许可、PII 检测、模型调用审计、tenant 隔离和供应链扫描。作者公开协议**没有证明**上述各点在企业生产中满足监管要求。

部署失败场景举例：Builder 加入带外搜索后开发题变好，但违反了限定语料；或者自检把答案直接缓存进索引，隐藏集上退化；或者大量调用本地重排模型把 p99 拉高；或者“参考答案”恰好来自用户无权阅读的文档。解决方式分别是强制出口限制/语料校验、隐藏测试隔离、资源预算、可信 ACL 过滤。Prompt 不能代替权限策略。

## 9. 同一套研究如何在 On-prem 与 Controlled Hybrid 中落地

| 决策 | On-prem / Self-hosted | Controlled Hybrid |
|---|---|---|
| 敏感语料边界 | 数据、索引、Embedding、评测留在内网 | 原始语料默认仍在内部；外发须有正式批准与最小化策略 |
| Builder 模型 | 使用本地 Coding LLM；模型选择影响代码可靠性 | 可以经受控网关调用批准的外部 Builder；明确输入可能含代码、元数据 |
| GPU / Serving | Builder/Reader/Embedding/重排争抢 GPU，要设置作业调度与显存限额 | Builder 与固定 Reader 可分层部署，但数据转移、跨域延迟更复杂 |
| 执行与网络 | 不可信代码进入无密钥、限制网络的 Sandbox；依赖做离线镜像 | 网络出口白名单、审计及凭据最小权限；禁止直接访问生产库 |
| 权限/治理 | ACL 由外部可信检索 Gateway 强制执行，审计保留证据 ID | 跨边界授权与驻留政策再校验，禁止把脱敏前日志发给第三方 |
| 成本与许可证 | GPU 时间、存储、模型许可证、维护、能耗 | GPU/API、出入口流量、留存条款、合规与供应商风险 |
| 迁移难度 | 不依赖外部闭源 API，但本地 Agent 能力、工具生态、模型兼容性要实测 | 管理网关、数据审批与回滚复杂；不能简单把论文的外部 API 成绩搬过来 |

**建议的最小闭环**：只在合成/已获批准的语料上运行 Builder；唯一可写范围为版本化实验 workspace；生产 KB 与权限系统始终只读不可达。以“作者实验可读、企业实现尚需验证”的证据等级发布：这不是公司现有架构或配置说明。

## 10. 30–60 分钟、离线、无闭源 API 的最小实验

这个小实验验证“同一开发集能选出看似更好的索引，却不保证独立测试变好”的**评测机制**，不是复现论文的九项 Benchmark，也不需要下载任何企业资料。

**0–10 分钟**：将下面代码保存为 rag_gate_demo.py（Python 3.10+ 标准库），使用 8 篇合成段落与两组问题；**10–25 分钟**：比较 BM25-like 词频计分与人为加入“高频诱饵”的查询策略；**25–40 分钟**：看独立测试表现和延迟；**40–60 分钟**：修改为冻结版本、记录 SHA-256 和失败用例。正常输出应包含每种策略在 dev/holdout 上各自的命中率，而非预设“谁一定赢”。

~~~python
# rag_gate_demo.py — 独立教学模拟；不代表作者代码或指标
import hashlib, json, math, re, time

CORPUS = {
 "d1": "Access review must be approved by security before production release",
 "d2": "A token expiry policy reduces replay risk for session credentials",
 "d3": "A retention policy deletes expired logs after the configured interval",
 "d4": "A sandbox executes generated code without production network access",
 "d5": "A checksum detects modified index files before deployment",
 "d6": "A hybrid gateway blocks unapproved outbound requests",
 "d7": "A rollback restores the previous signed service artifact",
 "d8": "A frozen evaluation split prevents agents seeing final test labels",
}
DEV = [
 ("Who approves access review before release?", "d1"),
 ("What isolates generated code from production?", "d4"),
 ("What verifies index files are not modified?", "d5"),
 ("What blocks requests to external services?", "d6"),
]
HOLDOUT = [
 ("Which policy handles expired logs?", "d3"),
 ("How can a deployed change be undone?", "d7"),
 ("What stops agents reading final answer labels?", "d8"),
 ("How can token replay exposure be reduced?", "d2"),
]
def tokens(x):
    return re.findall(r"[a-z0-9]+", x.lower())
def retrieve(q, policy="overfit"):
    qt = set(tokens(q))
    docs = []
    for doc_id, text in CORPUS.items():
        dt = set(tokens(text))
        score = len(qt & dt)
        if policy == "overfit" and doc_id in {"d1","d4","d5","d6"}:
            score += 1.5  # 人为给 dev 的答案文档加权：模拟有偏优化
        docs.append((score, doc_id))
    return sorted(docs, key=lambda p:(-p[0],p[1]))[0][1]
def evaluate(samples, policy):
    t0 = time.perf_counter()
    correct = sum(retrieve(q,policy) == gold for q,gold in samples)
    return correct, len(samples), round((time.perf_counter()-t0)*1000,3)
for policy in ("plain","overfit"):
    print(policy, "dev", evaluate(DEV,policy),
          "holdout",evaluate(HOLDOUT,policy))
print("corpus_sha256",hashlib.sha256(
    json.dumps(CORPUS,sort_keys=True).encode()).hexdigest())
~~~

**注意**：此模拟故意通过文档 ID 偏置营造开发集偏好，真实 AutoRAGBench 禁止使用隐藏答案，不能把这种作弊策略当成论文算法；它只是说明为什么需要隔离集。CPU 毫秒数不等于线上 RAG 真实性能。进一步可将策略扩展为不同的切分/召回/重排，再用完整配对评估替换这套极简词匹配。

### 更接近真实的本地进阶实验

使用作者仓库的 [examples/minimal_eval.py](https://github.com/ZhanGHanG9991/AutoRAGBench/blob/main/examples/minimal_eval.py) 检查 evidence validation → packing → metric 的接口；再从公开、许可明确的小语料构建 BM25 和 embedding 方案。记录数据 manifest、检索代码 SHA、模型版本、seed、index 构建耗时、每题证据 ID、Reader 版本、每项指标和预算。若需要 Reader，选择本地已有开源模型并**明确这与论文五 Reader 协议不同**；不能把结果并入 Table II。

## 11. 深入复现论文：实际需要核对哪些路径

作者 README 描述了完整任务数据/检查和 Slurm 构建流程。初步可核对：

- **数据/划分**：tasks/、configs/data_rules/、docs/data.md 与下载包 SHA256SUMS；公开 train 与隐藏 test 要严格分开。作者数据集中有部分测试包可下载；自行学习时应保留你自己的真实隐藏集，不能把公开答案再交回优化 Agent。
- **执行环境**：configs/pilot.env、scripts/new_run.sh、slurm/run.sbatch、agents/、llm/ 与 Harness 版本；主实验 Debian 12、H800、六小时、240GB RAM。
- **服务接口**：materials/ 的最小 /retrieve 示例、gateway/ 的模型调用限额、multireader/ 的证据验证与评分；固定 Retrieval 输出而不是让 Agent 提交最终自然语言答案。
- **审计与轨迹**：audit/、judges/、traces/；尤其检查测试集下载、额外语料、答案记忆和自检日志来源。
- **对照基线**：baselines/README.md；严格比较 Reference、BM25、Human-SOTA composite、Agentic AutoRAG/FlashRAG，确认构建预算、Reader、数据与接口一致。

**复现分三档**：A 档 30–60 分钟验证接口/隐藏集边界；B 档 1–2 天在单任务小样本验证数据准备、冻结和评测一致性；C 档多 GPU × 多 Agent × 多任务跑完整协议（需要真实硬件/外部模型费用与受控许可），不能用 A 档结果宣称复现论文最高 56.08。自建的本地 Coding Agent 还涉及模型能力差异，因此“同一协议”与“同一结果”不是一回事。

## 12. 求职与架构评审：五个可能被追问的问题

**问题一：为什么把 Reader 和 Builder 分开？** 说明检索器 R 与答案模型 G 各自的方差来源；如果每个 Agent 自选 G，结果无法归因于检索质量；但固定 G 也可能引入任务偏好，应做多个 Reader 与独立效果检验。

**问题二：如何给自主改代码的 Agent 做安全边界？** 权限在执行环境和服务网关里强制实现，而不是依赖模型按提示遵守；sandbox 网络白名单、只读语料、不可访问 test labels、无生产密钥、依赖审计、日志保留与可回滚版本不可省略。

**问题三：如何发现 Agent 过拟合？** 开发样本轮换、独立最终 holdout、不允许重复窥探、版本轨迹、paired effect size、从 peak 到 final 的退化与真实线上 shadow/canary 评测。

**问题四：为什么平均分不能直接定上线方案？** 9 项指标量纲/数据不同，任务权重相等；缺少 p99、更新率、权限过滤、多租户、失败模式和运营成本。企业应定义任务加权目标与门禁条件。

**问题五：怎么将它做成可审计平台？** 用调度器为每次试验分配 id 与预算，记录容器镜像、模型版本、训练/验证 split hash、代码 SHA、工具 Trace、候选索引和 Reader 版本；最终冻结制品由独立 evaluator 签名审核，再由人批准到生产，不把 Agent Runtime 当成无条件发布权限。

## 13. 三项结论与后续研究

1. **AutoRAGBench 的重要贡献是把 RAG 研发变为可测量的 Agent 工程任务。** 自由写代码使 Agent 能改变检索控制流，不局限于几个参数；是否产生因果收益仍需消融。
2. **开发反馈不是独立证据。** 论文的 77 个构建轨迹显示多数过程有所改善，但部分最终版本回落；隐藏评测和可复现合同比漂亮的迭代曲线更关键。
3. **可以迁移评测和治理方法，不能原封不动迁移论文得分。** 在私有/混合部署中，数据权限、Sandbox、GPU 预算、固定 Reader、许可证、成本与人工发布门禁应优先落实。

后续研究：在真实多租户过滤下测 ACL Recall、引用有效性与 p99；比较固定搜索空间和开放代码 Agent 在**相同**预算下的因果收益；建立开发集高分/隐藏集下降的早停规则；针对扫描件与文档版式错误增加独立标签；研究如何在受控 Hybrid 中隔离模型供应商请求并测量信息外发风险。

**关联阅读：** [Agent 评测：区分模型失败与环境故障]({{ '/notes/2026/11/2026-11-10-agent-evaluation-validity/' | relative_url }}) 解释可信评测环境与失败归因，本篇进一步把被评测对象扩展到 Agent 交付的整个 RAG 系统。[RAG 检索：Contextual Embedding 与 Multi-vector]({{ '/notes/2026/11/2026-11-01-onprem-retrieval/' | relative_url }}) 深入其中的语义检索组件；本篇讨论如何选择并评估这类组件的组合。

## 引用与阅读顺序

1. [AutoRAGBench arXiv v1（2026-11-19）](https://arxiv.org/abs/2611.25582)，优先读 II（任务定义）、III（协议）、IV（评分）、V（实现）、VI（结果与反例）。
2. [作者公开代码、README 与目录](https://github.com/ZhanGHanG9991/AutoRAGBench)，确认 MIT、运行要求、数据哈希和测试集管理。
3. [Minimal evaluation example](https://github.com/ZhanGHanG9991/AutoRAGBench/blob/main/examples/minimal_eval.py)，用于理解证据校验与统一 Reader 的最小执行路径。
4. [评测有效性旧文]({{ '/notes/2026/11/2026-11-10-agent-evaluation-validity/' | relative_url }})、[RAG 检索旧文]({{ '/notes/2026/11/2026-11-01-onprem-retrieval/' | relative_url }})，补齐隔离执行和检索算法的前置知识。

**审计注记**：所有示例均为公开或合成数据，不含工作配置、内部链接、公司性能数字或用户数据。本文未独立执行作者原始 GPU/多 Reader 实验；公式一部分为论文问题形式化、生产门禁与 Python 演示为本站教学设计，不能混淆。
