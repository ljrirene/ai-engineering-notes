---
layout: default
title: "Thin Orchestrator × Git Workspace：多 Agent 为什么要分离推理与共享状态"
date: 2026-11-01
track: hybrid
tags: [research, architecture, systems]
permalink: /notes/2026/11/2026-11-01-hybrid-agents/
---
# Thin Orchestrator × Git Workspace：多 Agent 为什么要分离推理与共享状态

> **2026-11-01 的历史精读专题（2026-11-04 重新整理）** · 本文根据此前实际讨论的选题与公开一手资料重新组织，不声称逐字还原当天聊天原文。性能结果属于原文作者报告，未经本站独立复现。

**先看交互图：** [打开架构拆解、点击节点与切换视图]({{ '/interactive/2026-11-01-agents-map.html' | relative_url }})




## 原始来源与筛选理由
- [The Thin Orchestrator: How We Made Our AI Agents More Reliable by Giving the Router Less to Do](https://engineering.fb.com/2026/10/19/ml-applications/thin-orchestrator-ai-agent-architecture/) — Meta Engineering，2026-10-19。
- [Building shared workspaces for people and agents](https://www.perplexity.ai/hub/blog/building-shared-workspaces-for-people-and-agents) — Perplexity Research，2026-10-12。

**合并为一个专题的原因**：Meta 解决 Agent 之间的职责与上下文隔离；Perplexity 解决跨 Agent、跨会话的状态一致性。底层都是把“LLM 的不确定推理”从“必须确定性的系统边界”中分离，比各讲一篇 Agent 产品更新更有工程迁移价值。

## 1. Thin Orchestrator：路由不等于领域推理
Meta 的数据流程代理早期将多个数据源规则、配置模式及代码生成逻辑塞入一个 Agent，导致上下文干扰。后续改用薄 Orchestrator：只负责目标识别、必要字段收集、预检查、确定性的 Workflow 顺序和错误回退，将领域决策交给隔离的 Specialist Agent。Meta 文章报告一个约 1,300 行 Orchestrator 路由 20 多类工作流到 14 个 Specialist；这些数字来自原团队，不代表一般企业最优规模。

概念上把控制层写为确定性 State Machine：
~~~mermaid
flowchart LR
  A[Classify] --> B[Gather Fields]
  B --> C[Policy & Reliability Gate]
  C --> D[Specialist Agent]
  D --> E[Validate]
  E --> F[Commit / Audit]
~~~
只有 D 中需要语言模型的领域推理。若可靠性检查也完全委托 LLM，就无法保证每次执行同样的不变量。

## 2. Shared Workspace：长期 Agent 是并发系统
多个 Agent 操作共享文件时，简单共享目录会遇到 Lost Update。Perplexity 采用 Git 基础语义管理持久化项目：
- 每个 Agent 在独立、可抛弃的沙箱内修改文件；
- 提交时检查 expected head 是否等于最新 head（类似 compare-and-swap）；
- Stale Base 返回冲突，调用方重新获取最新版本并重放自己的编辑；
- 每次接受提交同时记录 Outbox，触发下游 Indexing/解析任务，做到可追踪。

文章报告实际生产提交低于 2% 因 stale base 被拒，Median 提交时间小于 1.7s；是特定系统的官方数据。Outbox 需要关注 At-least-once 投递与幂等处理，否则重复消费会触发两次外部工具动作。

## 3. 参考接口与强一致性边界
~~~python
def commit_patch(repo, expected_head, patch):
    current = repo.read_head()
    if current != expected_head:
        return {"status": "STALE_BASE", "actual": current}
    validate_scopes(patch)
    new_commit = repo.apply_to(current, patch)
    repo.atomic_commit_with_outbox(new_commit, patch.changed_paths)
    return {"status": "OK", "commit": new_commit}
~~~
这是**教学伪代码**，实际实现需要数据库事务/原子 CAS、可靠日志、冲突合并和防重复幂等 Key；单纯进程内检查后写入并不具备并发原子性。

## 4. 两条部署路径
| 层 | On-prem | Controlled Hybrid |
|---|---|---|
| Orchestrator | 本地确定性 FSM + Scope Gateway | 控制层继续留内网 |
| Specialist | 自托管 LLM、分域工具和工作区 | 外部 Agent 只处理获批脱敏任务 |
| Workspace | Git/Object Store 内网持久化 | 可用区域限定对象存储和短期沙箱 |
| Concurrency | CAS head + retry + idempotent outbox | 增加跨域网络分区/重放保障 |
| 安全 | 工作区 ACL、审计变更与来源 | 不要把共享 Git repo 当作权限模型 |

## 30–60 分钟实验
用 Python 模拟两个 Agent 读取同一个 head；A 成功提交，B 的旧 head 失败；让 B rebase 并重试，验证最终两个文件改动都存在。再人为重复发送同一个 outbox 消息，使用事件 ID 防止下游重复处理。全部在本地完成。

## 面试与总结
Design a reliable multi-agent workflow system supporting concurrent edits. 面试至少覆盖确定性控制、上下文隔离、MVCC/乐观锁、Outbox、任务幂等、工具权限、失败恢复。核心结论：①LLM 不应决策系统不变量；②Agent 的临时运行环境与持久状态必须分离；③长期 Agent 的协作本质是并发写入和一致性问题。

