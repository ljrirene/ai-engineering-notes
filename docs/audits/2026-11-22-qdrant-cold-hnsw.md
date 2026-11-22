---
layout: default
title: "2026-11-22 内容一致性审计"
---
# 2026-11-22 内容一致性审计

新增一篇 Qdrant HNSW 冷盘 I/O 研究；此前 14 篇的 ID 与页面路径不变。新文的 studies.yml、graph article、corpus documents、questions、visual lesson 和 wrapper 均采用 `a-qdrant-cold-hnsw`；新文章含具体 old/new 步骤、中文一句话机制、证据范围与公开链接。Graph 连至 a-retrieval、a-paged-experts 与部署/概念节点。两道 QA 题的参考答案来自新文章机制和作者 PR 数据，未修改旧题。该 PR 在 2026-10-23 合并，不能说是 11-22 首发；作者 Serverless 冷启动反例必须保留。

检查范围：现有 14 篇 studies 元数据、graph article ID、corpus documents、questions doc、visual lessons 和所有旧文路径。未重构全局 Guide、首页模板或图谱 UI。静态一致性验证不等于浏览器交互或 Pages 成功部署。
