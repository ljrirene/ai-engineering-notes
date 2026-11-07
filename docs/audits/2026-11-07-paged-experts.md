---
layout: default
title: "2026-11-07 Paged Experts 知识库增量审计"
date: 2026-11-07
permalink: /audits/2026-11-07-paged-experts/
---
# 2026-11-07 增量审计

- **本次新建技术单元**：1 篇 Paged Experts + 1 个四视图交互架构图。
- **旧文去重**：对照现有 11 个文章节点/主题；ReplaySSM 是 recurrent state 写回，Sticky Sessions 是 Session Affinity，Shadow Traffic 是安全发布；Paged Experts 专注 Expert Weight Residency/PCIe，不覆盖旧文。
- **知识图谱**：原 48 节点 / 108 条 typed edges；本次新增 1 个 article、4 个 concept 和 18 条有理由的关系；保留旧 ID 和全部旧边。
- **Study QA**：旧 11 篇 / 95 段 / 23 题全部保留；新文章分章节抽取 14 段并新增 3 道手工校验题，涵盖机制、系统设计、正确性。旧题仍按原 Article ID 映射；未改变评分或 Guide 规则。
- **未更改 Guide**：本期不引入新分类体系、学习方法或术语重定义；旧文无需覆盖重写。
- **数据隐私**：全部示例为公开代码或合成路由；不包含私有雇主数据、地址、日志、密钥。
- **验证边界**：完成 JSON schema/ID/边端点、JS 静态语法和页面路径检查；部署后需以 Pages 构建状态为准，不能将提交视为网页上线。

