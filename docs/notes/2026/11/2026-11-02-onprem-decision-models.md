---
layout: default
title: "Decision Models：为什么分类不一定需要生成 Token"
date: 2026-11-02
track: onprem
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-02-onprem-decision-models/
---
# Decision Models：为什么分类不一定需要生成 Token

> **2026-11-02 历史精读（2026-11-04 重新整理）**。依据既有选题和真实可核对的一手资料重新编写，不是逐字恢复聊天原文；作者声称的数据未经本站独立复现。

**交互架构图**：[点击节点、切换架构与查看失效模式]({{ '/interactive/2026-11-02-decisions-map.html' | relative_url }})


## 选题理由与原始出处
- [Oumi: How to Build a Decision Model Like Jev](https://www.oumi.ai/blog/how-to-build-a-decision-model-like-jev) — Oumi，2026-10-19。
- [Lumma-Fev-v2](https://huggingface.co/blog/FrontiersMind/lumma-fev-27b-v2) — FrontiersMind，2026-10-29。
- [Baseten: Decisions for a penny: joey-1](https://www.baseten.co/blog/decisions-for-a-penny-introducing-joey-1/) — Baseten，2026-10-29。

**为何入选**：跨 Oumi、独立开源模型和 Baseten 的同向证据表明“生成文本”不一定是分类/路由的合适计算接口。模型层决策、Calibration、Latency 与基础设施关系紧密，是 Agent Router/Model Systems 高价值话题。

## 1. 生成式分类的成本从哪里来？
传统提示：给定消息，让 LLM 生成一个诸如 `billing`、`account` 的标签。即使只输出几个 token，也要走一次或多次自回归 Decode，并处理格式、拒答、多余解释及解析错误。

Decision Model 的关键不是“分类结果更短”，而是将问题转成一组候选选项的一次 Forward Score。可用概率记为：
\[
P(y=k \mid x)=\frac{e^{z_k / T}}{\sum_j e^{z_j / T}}
\]
其中 z_k 是选择头或保留 token 的 logit，T 可用于后训练温度校准。不同模型可能采用不同 Readout Strategy；不能把全部模型理解为固定 Softmax Head。

多个相关问题可共享同一个输入 state / 前缀，提高高频决策效率。Oumi 文章强调树状/共享输入计算和概率校准；Baseten 报告 joey-1 为 2B、来源于 Qwen3.5-2B Post-training，报告某配置下 P50 约 20ms。这些均属于供应商实验，需要按照输入长度和硬件重新验证。

## 2. Why Calibration Is Not Accuracy
- Accuracy = 正确分类的比例；仅表明标签选择对错。
- Confidence Calibration：预测 0.8 的样本，大约 80% 应正确；可通过 Reliability Diagram、ECE、Brier Score 评估。
- Selective Prediction：当最高分低于 τ 时送人工或更大型模型；目标是限制错误成本，不是单独追求准确率。
- 分布漂移：如新产品术语、跨语言、政策更新，可能使一个已校准模型失效。

**Baseline 的必要性**：规则/关键词、scikit-learn TF-IDF + LogisticRegression、轻量 Sentence Transformer 分类与生成式 LLM 均应是对照。小模型专用微调可能优于通用 Decision Model；应依据标签可得性、再训练频率判断。

## 3. 运行时接口
~~~python
# 教学伪代码（不是某家 API 的原始协议）
decision = model.score(
  state={"message": "Please update the mailing address"},
  questions=[{"type":"choice", "options":["account","card","payment"]}]
)
if decision.top_probability < 0.85:
    route = "human_review"
else:
    route = decision.top_option
# 权限校验仍必须独立执行；模型分数不是交易授权
~~~

## 4. On-prem vs Controlled Hybrid
| 问题 | On-prem | Controlled Hybrid |
|---|---|---|
| 模型/许可证 | 核实开放权重和商用许可证，本地推理可基于可用 Backbone | 部分 API 版本仅服务商可执行，不能作为离线可用的证明 |
| 时延 | 小模型可与 Gateway 共址，测端到端 P50/P99 | API 网络 RTT 可能超过模型计算耗时 |
| 数据边界 | 文本保留内网，拒绝权限旁路 | 只出域批准字段，不等于“无数据保留”即可自由使用 |
| 验证 | Confusion Matrix + Calibration + Drift | 加测 Cost、RTO、供应商限额与回退 |
| 资源 | 需要核实实际 FP16/量化占用与并发 | 可能以供应商托管方式提升峰值弹性 |

## 30–60 分钟自托管实验
用 sklearn 自带分类数据或合成 77 类客服意图，比较 LogisticRegression 及本地已授权小模型的标签准确率、Brier Score、端到端延迟。对所有预测的置信度做 temperature scaling（使用单独的 validation set）；画 reliability curve，并测试低置信度升级策略。不能把类数多误解释为一定需要 LLM。

## Interview Takeaways
**Design a low-latency, high-volume classifier and policy router.** 论述 one-pass readout、Batching、Calibration、Decision Cost、Hard Policy Boundary 与 Drift。三条结论：①分类不必输出完整自然语言；②概率是否可靠与分类准确率是两件事；③授权永远不能由模型的 Confidence 替代。未独立复现 Baseten 的延迟数据。


