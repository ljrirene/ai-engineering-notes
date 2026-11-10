---
layout: default
title: "BrowseSafe++：真实世界 Prompt Injection 与可验证防御"
date: 2026-11-04
track: onprem
tags: [agent-security, prompt-injection, evaluation, guard]
permalink: /notes/2026/11/2026-11-04-onprem-prompt-injection/
---
# BrowseSafe++：从 Prompt Injection 检测到可信执行边界

> **研究日期**：2026-11-04 · **部署主线**：On-prem / Self-hosted · **目标岗位**：Applied AI、Agent Infrastructure、AI Security

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/agent-security-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。

## 一手来源与证据

- **Perplexity**，*[Building stronger defenses for real-world prompt injection](https://www.perplexity.ai/hub/blog/browsesafe-plus-plus)*；博客于 2026-11-02 发布，项目公布了训练/测试数据、Guard、Leaderboard 与 Adaptive Evaluation。
- **Perplexity**，*[BrowseSafe++ Project / Leaderboard](https://browsesafe.perplexity.ai/)*；项目主页更新和统计可能随时间变化。
- [BrowseSafe++ SDK](https://github.com/perplexityai/browsesafe-plus-plus)；以对应版本的 LICENSE 和 README 为准。

**证据声明**：数据规模和模型效果属于原团队报告。本文中的企业系统架构与实验为独立工程推导，不代表 Perplexity 官方建议，也不是银行环境实测。

## 1. 为什么今天学它？

Prompt Injection 的根源不是“提示词写得不够严”，而是不可信内容被赋予了不应有的指令权威。对于具有 Retrieval、File Reading、Tool Execution 能力的 Agent，系统是否遵守用户权限必须由执行边界决定，不能寄希望于模型始终识别恶意文本。BrowseSafe++ 的价值是把这个问题变成可以系统测量的检测与自适应评测问题。

Perplexity 报告 38,675 对攻击/干净页面、24 种攻击类型、80 种语言，并提供 HTML、Markdown、Accessibility Tree、Screenshot 等不同浏览器视图。这类成对数据适合测试检测器是否只抓住了无关的文本表面特征。

## 2. First Principles：数据为什么会“升级”为指令？

系统应当区分不同信任来源：

~~~mermaid
flowchart TD
    U[Authenticated user] --> O[Agent Orchestrator]
    O --> R[Retriever / Browser / Tools]
    R --> D[Untrusted content]
    D --> G[Guard and source boundary]
    G --> M[LLM reasoning]
    M --> P{Independent policy engine}
    P -->|Allowed| E[Sandboxed execution]
    P -->|Denied| X[Block and audit]
~~~

文档中的一句“忽略以前的指令”只是数据，绝不能获得 System/Developer 指令等级。即使 Guard 漏检，Policy Engine 仍应实施 RBAC、数据分类、工具白名单、网络出口控制和审计。

可以将攻击链抽象为：

1. 攻击者控制低信任输入：网页、PDF、工具结果或共享文件。
2. 低信任内容被载入模型上下文。
3. 模型把内容中的行动要求当成授权指令。
4. Agent 生成越权工具调用；若执行层缺少强制授权，攻击成功。

防御应横跨 **Data → Model → Tool Policy → Runtime**，而不是只放一个“不要被注入”的 System Prompt。

## 3. 检测指标：为什么 Accuracy 会误导？

Guard 模型可以输出风险分数 p(x)，再通过阈值 τ 判定是否拦截。阈值越低通常 Recall 越高，但误报也可能增多。

- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- FPR = FP / (FP + TN)
- F1 = 2 × Precision × Recall / (Precision + Recall)

假设 100,000 个正常文档片段、误报率 1%，单日可能触发约 1,000 次错误拦截或复核。这是用于说明运维成本的假设，而不是 BrowseSafe++ 测量值。

成对 Attack/Control 数据很重要：如果攻击页面和干净页面只差注入部分，检测器误抓住领域术语、网页样式的风险更容易被观察。但它仍可能利用攻击长度、格式等统计特征，因而跨语言、跨格式与新攻击家族评测很必要。

## 4. Adaptive Attack 改变了什么？

固定测试只衡量一次输入的攻击成功率；现实攻击者可以根据失败结果改写页面。BrowseSafe-Adapt 为每个任务设置目标、Sandbox 和 Verifier；失败后由 Critic/Attacker 修改注入并再次执行，最多达到设定预算。

- Static ASR：固定初始攻击的一次成功比例。
- Adaptive ASR(K)：至多 K 次尝试中取得成功的任务比例。

项目报告某些开源模型在首轮成功率较低的情况下，在最多 64 次调整之后出现显著更高的成功率。这些数字是特定实验设置中的指标，不是模型在实际环境中的漏洞发生率。**攻击预算必须作为 Benchmark 的一部分披露。**

## 5. 完全本地与受控 Hybrid 的部署分析

| 层次 | On-prem | Controlled Hybrid |
|---|---|---|
| 文件与检索 | 留内网；权限感知 | 敏感内容不出域 |
| Guard | 可在本地 GPU/CPU 部署轻量分类器 | 外部 Guard 仅对经批准的非敏感内容使用 |
| LLM | 开源权重模型、本地 Serving | 本地为主；获准范围才外发 |
| Tool Policy | 独立于 LLM 的内部授权层 | 外部 Tool 仍需经企业 Policy Gateway |
| Runtime | 本地 Sandbox、出口白名单 | 远程 Sandbox 采用短期身份、最小权限及审计 |
| 回退 | Guard 不可用时高风险动作拒绝或人工审批 | 出域不可用时本地退化或拒绝 |

参数量小不等于即插即用：需要核实 Guard 权重许可证、中文/扫描 PDF 泛化、实际框架版本、峰值显存和推理时延。SDK 的授权范围与数据集/隐藏测试集的使用限制应分别核查。绝不把嵌入向量或模型输入默认视作脱敏数据。

## 6. 实践：Guard Threshold 与真实安全边界

**交互练习**：[Guard Threshold Explorer]({{ '/interactive/guard-threshold.html' | relative_url }})。它用纯合成数据演示阈值、Recall、Precision 与 FPR 的权衡；所有数据只在浏览器内生成，不请求 API。

30–60 分钟进阶实践：建立 20 对来自合成企业制度的 clean/attacked 文档，包含中文、英文、系统指令伪装、正常引用“ignore previous instructions”术语的文章，分别测试 Regex Baseline 和本地小分类器；报告逐类型的 FPR、Recall，并验证即使 Guard 关闭，越权 Tool Call 仍被 Policy Engine 拒绝。

## 7. 工程面试思考

**Design a secure enterprise RAG Agent that reads untrusted files and executes tools.**

必须区分 Detector、Harness、MCP Client/Server、Policy Enforcement Point、Sandbox 与 Audit。讨论信任边界、越权风险、误报成本、攻击者适应性，以及“Guard 不可用”时的明确安全策略。

## 8. 知识沉淀与限制

1. Prompt Injection 是跨信任边界的指令提升，不仅是文本质量问题。
2. 检测准确性与执行授权属于不同的安全层；概率模型不承担最终授权。
3. Adaptive Evaluation 比固定攻击集更接近持续变化的威胁模型，但必须报告尝试预算。

本期未对内部 PDF 或中文制度执行独立测试，也未验证足够广泛的 X/LinkedIn 独立社区共识。未来研究：Guard 的 Dataset Shift、工具参数级授权及可审计拒绝策略。


