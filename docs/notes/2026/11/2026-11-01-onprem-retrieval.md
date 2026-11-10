---
layout: default
title: "RAG 检索进阶：Contextual Embedding 与 Late Interaction / ColBERT"
date: 2026-11-01
track: onprem
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-01-onprem-retrieval/
---
# RAG 检索进阶：Contextual Embedding 与 Late Interaction / ColBERT

> **2026-11-01 的历史精读专题（2026-11-04 重新整理）** · 本文根据此前实际讨论的选题与公开一手资料重新组织，不声称逐字还原当天聊天原文。性能结果属于原文作者报告，未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-11-01-retrieval-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。




## 主文章与来源
- [Contextual embedding beyond the gold passage](https://www.perplexity.ai/hub/blog/contextual-embedding-beyond-the-gold-passage) — Perplexity 与 turbopuffer，2026-09-30。
- [Multimodal embeddings beyond a single vector](https://www.perplexity.ai/hub/blog/multimodal-embeddings-beyond-a-single-vector) — Perplexity Research，2026-10-07。
- [pplx-embed-v2-late 技术报告 arXiv:2610.29523](https://arxiv.org/abs/2610.29523) — 论文版本需以 arXiv 为准。

**入选原因**：这两项研究共同挑战传统“每段文档一个 embedding + top-k”的简化假设。检索不好可能来自缺乏上下文、视觉页面信息丢失或 query 与 doc 表示过度压缩；大模型未必能弥补候选证据缺失。

## 1. 为什么 Gold Passage 不够？
传统检索数据常把问题映射到一个包含答案的黄金片段，但真实企业问答需要理解适用范围、版本、章节表格、定义前提。比如“本季度费用是否需要审批”的答案在一段，审批适用范围在另一段；单段相关性不代表答案可验证。Contextual Embedding 的目标是表示该片段在整份文档中的含义，而非单独编码断裂的句子。

Perplexity 描述由查询感知的上下文压缩教师产生 token 级软相关监督，并蒸馏到无需查询时重新跑全文的 Contextual Encoder。它的优势必须通过长文档证据恢复评价而不仅是 Recall@K 测量。

## 2. Multi-vector / Late Interaction 的机制
单向量 Dense Retrieval：score(q,d) ≈ cos(e(q),e(d))，极省索引与 online 计算，但细粒度相似度被压缩。

Late Interaction 的经典 MaxSim：
\[
s(q,d) = \sum_{i \in q} \max_{j \in d} \langle \mathbf{q}_i, \mathbf{d}_j\rangle
\]
其中 query 的不同 token 各自从文档 token/patch 寻找最佳匹配；保留局部证据，提高多条件问题的匹配表达力，但向量数量、存储/传输和聚合计算显著增加。

Perplexity 报告的 pplx-embed-v2-late 提供 0.6B 与 9B 两种大小，跨尺寸共享嵌入空间：9B 离线编码文档，0.6B 在线编码 query。这是 Offline Indexing vs Online Serving 不对称设计的典型案例。官方也描述直接检索 PDF 渲染页面，而不依赖 OCR 文本的视觉检索路径；不意味着完全不需要文字 OCR，因为引用定位、精确数字和后续解析仍会受益于文字。

## 3. 运行架构、资源与失效
- 传统 Chunker → Dense Embedding → ANN，可以作为高召回 First Stage；Late Interaction 可作为 Second Stage 或适配专门的 MaxSim 检索引擎。
- 多向量索引容量近似 O(D × tokens_per_doc × dim × bytes_per_dim)，远高于单向量；须测索引 build、显存/内存、P95 延迟与更新成本。
- 常见失败：PDF 页眉误匹配、公式与图表 patch 误召回、跨语种查询漂移、标题/正文版本混淆、单份文档切分导致引用粒度失真。
- 多文档冲突仍需要版本优先级、权限过滤和证据核验，Embedding 本身不能解决授权或事实判断。

## 4. 部署对照
| 维度 | On-prem | Controlled Hybrid |
|---|---|---|
| 建索引 | 本地 GPU 批量离线编码，权限标签不脱离片段 | 只迁移获准文档或单独处理公开语料 |
| 在线检索 | 小型 Query Encoder + Token-level Rerank | 云端只处理已许可查询；敏感用户问题留内网 |
| 算力 | 避免默认 9B Query Encoder 的在线成本 | 可用云端大批量离线 indexing |
| 安全 | ANN 前后都实施 ACL，不能“检索后再随便裁剪” | 不能认为 embedding 自动脱敏 |
| 衡量 | Evidence Recall@K、Citation accuracy、Latency | 同时测网络出域和成本 |

## 30–60 分钟可操作实验
制作 30 个含有标题、例外条款、交叉引用的合成段落和 10 个多条件 query；先用 TF-IDF/cosine 作为单向量基线，再用 token TF-IDF 的 MaxSim 做模拟 late interaction。测 Recall@3 与 Evidence Coverage，不用闭源模型 API。**模拟 token vector 不等于复现 Perplexity 模型性能**。

## 面试与延伸
Why can high passage recall coexist with wrong answers? Design permission-aware multi-vector RAG for scanned PDFs with 10M pages. 三个关键点：检索目标是证据集合，不只是 gold chunk；离线文档编码与在线 query 编码资源约束不同；精度、授权和引用必须独立评估。


