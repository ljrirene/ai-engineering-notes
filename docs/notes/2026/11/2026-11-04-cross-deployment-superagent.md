---
layout: default
title: "DeepSeek Super-agent：从单 Session Agent 到事件驱动、持久化的多任务系统"
date: 2026-11-04
track: cross-deployment
tags: [super-agent, deepseek, agent-infrastructure, async-react, event-routing, watchdog, authorization]
permalink: /notes/2026/11/2026-11-04-cross-deployment-superagent/
---
# DeepSeek Super-agent：从单 Session Agent 到持续在线的分布式协作者

> **特别补充研究**：2026-11-04（用户指定加入；不改变三天一篇的自动日程）
>
> **原始设计**：DeepSeek Harness 团队《Super-agent 设计探索：迈向更自主的 Agent 系统》，2026-10-31 首发于官方公众号；部分转录/英文发布页面显示 11 月 1 日。本文优先保留官方链接与代码仓库，区分“设计构想”“公开原型”“独立工程推导”。**不是 DeepSeek 已推出生产服务的证明。**

**交互式技术架构图**：[打开 Super-agent 可点击架构图（Router/Worker、事件快慢路径、记忆链、安全与部署）]({{ '/interactive/2026-11-04-superagent-map.html' | relative_url }})

## 1. 原始资料与证据等级

1. **第一手设计文章**：[DeepSeek 官方公众号：《Super-agent 设计探索》](https://mp.weixin.qq.com/s/zoS7GlReWPhfCjENGxXCdg)，2026-10-31。部分网络环境可能无法直接打开微信文章。
2. **第一手开源原型**：[deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)，MIT；先阅读 [README](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/README.md)、[Domain](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/001-domain.md)、[Authorization](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/002-authorization.md)、[Execution](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/003-execution.md)、[Architecture](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/007-architecture.md)。
3. **一手基础框架**：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)；与此研究插件不是同一个仓库。
4. **辅助访问资料（转载/翻译，不是原始证据）**：[逐段双语镜像](https://aipaper.jasonlin.tech/p/deepseek-super-agent/)；用于查阅章节与实验数值，译文可能有差异。
5. **独立批评**：[冯若航：评 DeepSeek Super-Agent](https://blog.vonng.com/ai/ds-super-agent/)，2026-11-02；观点与作者报告分开，不能视为已证实的错误。

**重要边界**：官方原型 README 明确写明“研究参考用，不是正式 DeepSeek 产品”；公开代码与团队内部实现以及原文设计并不完全相同，某些设计仍是未来方向。不能因为某个模块出现在架构文章就推断开源仓库已实现。

## 2. 为什么选它？和 Thin Orchestrator 有什么不同？

这篇的研究对象是**长期并行运行的多任务 Agent 服务**，不是某个更强的模型，也不只是 MCP Connector。既有 Thin Orchestrator 研究解决的是单次工作流中的确定性路由和专业化 Agent，而 Super-agent 把讨论推进到**跨 IM/GitHub 的事件驱动会话归属、会话持续性、主动触发、长期状态与自恢复**。

作者提出的瓶颈是：单任务主要受模型能力限制，而当人需要持续切换/管理多个独立 Session 时，多任务受人的注意力制约。文中“单人同时跟进 3–5 个 Session”是作者经验判断，**不是跨人群随机试验的认知上限**。

四项产品目标：**Continuous**（跨渠道仍是同一 Agent）、**Productive**（并发推进）、**Proactive**（观察事件后有条件行动）、**Persistent**（进程或终端断开也能恢复）。

相对于 2026-11-01 的 [Thin Orchestrator × Shared Workspace]({{ '/notes/2026/11/2026-11-01-hybrid-agents/' | relative_url }})，本专题补上的是 Event Bus、Mandate/Admission、Thread Subscription、Async ReAct 与 Watchdog；但两篇都强调：**LLM 推理与系统强制不变量必须分开**。

## 3. 系统分层：Router 不应成为万能 Worker

~~~mermaid
flowchart TB
  S[IM / GitHub / CI Sources] --> G[Programmatic admission gate]
  G -->|new or unowned| R[Persistent Router Session]
  R -->|accept with Mandate| T[Ticket and subscriptions]
  T --> W1[Worker Session A]
  T --> W2[Worker Session B]
  G -->|already subscribed: context only| W1
  W1 -->|progress / result| R
  W2 -->|progress / result| R
  R --> O[Outbound channel / human]
  T --> DB[(Durable state + audit)]
  WD[External Watchdog] -. monitors and escalates .-> T
~~~

- **Source / Trigger**：来自聊天、Issue、PR 评论、CI 等来源的事件。先持久化事件并识别身份、对话 Thread、来源范围，再进行准入评估。
- **Router Session**：维护全局跨任务的任务归属与外部沟通。处理新任务的冷启动、跨任务协调、异常接管；不应把重工具执行塞入 Router。
- **Worker Session / Ticket**：每个被接受的任务具有独立 Executor 上下文、任务目录、Mandate/Scope 与持续的 Thread 订阅。Worker 报告状态，Router 统一协调对人的输出。
- **Subscriptions**：对于已有订阅任务，后续 Thread 消息可直接送达该 Worker，避免 Router 每条消息重复规划。**消息直通只添加上下文，不会产生新的授权**。执行范围仍以 Ticket Mandate 为准。
- **Persistent State + Outbox**：事件、决策、任务、报告以及可靠的对外发送记录需要持久化，并且被重放时必须幂等。
- **Watchdog**：独立系统健康和任务进展的外部控制回路。既看进程是否活着，也看“是否真的朝目标推进”。

## 4. 事件两级过滤：权限与语义决定权绝不能混为一谈

一个 Trigger 进入系统后，有两条不同的处理责任：

**Fast Path — Code / Policy Gate**：检查 Source 的 receiving scope、允许名单、Bot 身份、明确提及、Source 的 admission 规则与目前 accept mode。自动触发前应只把符合条件的消息变成候选，而不是任意邮件/页面文本都能指挥代理。

**Slow Path — LLM Semantic Eval**：对通过准入的候选事件判断是否符合已有的主动性规则、是否值得行动。模型可提出建议，但“本来没有的授权”不能被它生成出来。

官方原型的 **accept mode** 包括 `off`、`observe`（缺省，记录 would accept 但不执行）和 `auto`；明确的人类请求在不同模式下可另行处理。每个 Ticket 带有接受时的 Policy Version 和 Mandate，规则变化需要重新验证，避免旧权限无期限生效。

~~~python
# 概念伪代码：不是 DeepSeek 原项目接口
def route(trigger, policy, subscriptions):
    if trigger.thread_id in subscriptions:
        # context may be delivered, but NOT a fresh authorization
        return deliver_as_context(subscriptions[trigger.thread_id], trigger)
    admission = policy.admit(trigger.source, trigger.actor, trigger.scope)
    if not admission.allowed:
        return ignore_and_audit(trigger)
    if admission.explicit:
        return router_review_and_create_ticket(trigger, policy.version)
    if policy.mode == "off":
        return ignore_and_audit(trigger)
    proposed = llm_semantic_assessment(trigger, policy.proactive_rules)
    if policy.mode == "observe":
        return record_would_accept(proposed)
    return enforce_scope_and_mandate(proposed, trigger, policy.version)
~~~

**常见实现错误**：把 Thread Subscription 当成“以后这个人说什么都授权”，或把 Prompt Guard 当成 Permission Check。长期 Agent 的安全模型需要持续评估同一消息中的**谁说的、在哪里说的、允许哪个 Ticket 执行什么**。

## 5. Context Window 是缓存，不是业务状态本身

文章提出 **Inline & Spill**：

- **Inline**：给模型当前任务的 ID、摘要、近期会用到的局部对象（例如同一 PR 的相邻评论），避免每次工具调用反复取回；
- **Spill**：超出预算的历史保存在 Context Window 之外；当前窗口留下可以按需检索的稳定 ID 或引用；
- **Chain of Recall**：从 Trigger → Thread → Ticket / Worker → 相关 PR/History 逐跳追索，不要求 Router 永久记住全部对话。

它与传统 RAG 不是简单的替代关系：RAG 通常围绕外部文档相关性寻找片段；Chain of Recall 依靠**有类型的对象关系及 ID**回收某个任务的来源、授权和操作现场。向量召回可能是辅助，不能替代精确对象 ID、版本以及权限检查。

重要反思：**模型上下文缓存不是持久任务状态，业务上下文也不是纯 Token 文本**。任务在哪个仓库、哪个环境、谁有授权、当前 CI 是什么状态，都应该通过明确的 ID 和系统记录恢复。

## 6. Async ReAct 与主动执行：怎样不阻塞人？

同步 ReAct：`LLM → run(tool) → wait → result → LLM`，耗时工具调用会阻塞当前会话的下一次输入。异步设计将长调用变为 `start()` 立即返回 Job ID / Started，随后完成事件唤醒 Worker；需要时 `stop(job_id)`。作者说明 DeepSeek Harness 的相关异步能力已经实现，但**尚未默认开启**。

对可持续运行的 Agent，至少要分别管理：

1. **Foreground interaction**：允许人追加指令、更改目标或中止；
2. **Background work**：拥有独立任务 ID、超时、取消、重试、幂等规则；
3. **Completion event**：Job Finished/Failed 持久化并重新送达正确的 Ticket；
4. **Speculative work**：没有明确需求但规则允许的提前执行，默认 `observe`，避免消耗资源或产生未经授权的副作用。

从系统角度，这相当于给 Agent 增加任务调度器、Event Queue、State Machine 和回执通道，而不是单纯改一个 Prompt。

## 7. Stateful Agent：计算、会话状态、执行环境为什么要分离

文章把三件经常被绑定在用户笔记本上的东西拆开：

| 组件 | 独立部署要解决什么 | 关键注意事项 |
|---|---|---|
| Agent Loop Compute | 跑 LLM 推理与 Task Router；容器可弹性重启 | 不应把唯一 Session 状态只放在进程内 |
| Persistent State | Triggers/Threads/Tickets/Mandates/Logs/Outbox 的一致性 | 恢复顺序、事务、幂等、租户 ACL |
| Execution Environment | Git Worktree、工具链、源文件、本地资产 | 必须独立权限、Secret Broker、Egress |
| Watchdog | 进程错误与“有心跳但无进度”的卡死 | 监控者本身的权限和误修复风险 |

DeepSeek 的设计包含云端 Agent Loop + 远端本地轻量 daemon（BYOM，Bring Your Own Machine）；当本地终端离线，云端可以先保存事件，设备重连后继续执行。然而，**BYOM 是文章中的目标形态，不等于公开原型已经提供同样级别的多环境跨设备支持**。将它用于企业时尤其不能默认让云端服务直接拥有内网 Shell 与宿主凭据。

## 8. 原型代码的已实现边界（与设计文章分开看）

官方开源原型主要面向**一个 GitHub 仓库的主动 Coding Agent**，可选接入 Feishu；作为 DeepSeek Harness 插件运行。公开文档中可核查：

- **Domain**：Trigger、Thread、Ticket、Mandate、Assignment/Report、Source；
- **Authorization**：Allowlist、Admission Table、Explicit vs Inferred、Accept off/observe/auto，Policy Version；
- **Execution**：每个 Ticket 对应 Worker Session 与 Directory；可选 Git Worktree；Worker Slot 限制并发，重试和状态接管；
- **Durability**：Engine 事务、持久 Store、Outbox 与后置 Effect，配合事件回放；
- **Human interaction**：特定通道的回复/PR/Review，不把所有 Worker 推理过程直接灌入群聊。

**安全上的事实限制**：公开 Execution 文档写明 Executor Shell 使用操作者 OS User 执行命令；`blocked commands` 包装和任务工作目录提供默认约束，**不是安全隔离边界**。因此在敏感环境里必须额外设计 OS 身份、Rootless Container/VM 隔离、凭据代理、网络出口和 Tool Action Approval。不能把一份开源研究原型直接标记为企业级安全沙箱。

**原文中的 Watchdog、云端无状态 Loop + BYOM、完整 Async ReAct/跨渠道编排等**属于设计方向；公开仓库未必覆盖其全部行为。此差异属于阅读的重点，而非瑕疵的证据。

## 9. 论文式实验：观察什么证据，不能推出什么

原文章的初步系统消融使用合成消息流与耗时模拟工具。每组约 300 条消息，约 20 个实际工作请求，每种配置运行 **5 次**。作者报告：

| 方案 | 任务完成时间 P50 / P95（分钟） | 运行时缓存读取 Token |
|---|---:|---:|
| Super-agent | 12.4 / 15.7 | 23.2M |
| Super-agent 去掉 Pass-through | 12.6 / 15.5 | 31.8M |
| Single Session + Subagent（中性提示） | 20.4 / 29.5 | 6.1M |
| Single Session + Subagent（优先委派） | 13.8 / 29.0 | 10.8M |

**证据等级：作者报告，不是本站复现。** 从这些数字能看到：新架构可能以更高的缓存 token 消耗换取尾延迟可预测性；Pass-through 在此工作负载下几乎不影响完成时延，却减少 Router 决策和 token 开销。由于任务工作使用模拟耗时工具、样本小且 Prompt 影响巨大，**不能用此结果证明 Super-agent 解决复杂软件工程或真实跨团队长期记忆问题**。

Router 还做了负载测试，将待判断的 Trigger 速率从约每分钟 1 条提高到 40 条，但单 Router 多租户扩展与分片阈值仍是开放问题。

## 10. On-prem 与 Controlled Hybrid 的工程落地

| 层 | 完全 On-prem（内网） | Controlled Hybrid（显式批准） |
|---|---|---|
| Trigger Source | 内网 Git/IM/CI/审批系统；Source Adapter 做身份校验 | 外部 GitHub/云通知仅同步允许披露的事件元数据 |
| Router/Worker LLM | 本地授权模型、独立前缀和任务上下文；测 Router P95 | 可将非敏感公开任务放入受控云 Agent Pool |
| State & Memory | 内网 DB/Queue/Outbox，版本化 Mandate 和 Thread | 跨境数据分类、最小必要字段出域、会话恢复日志隔离 |
| Execution | 内网 VM/容器沙箱、最小权限 Service Account、Secret Broker | 云执行层仅处理获批资产；内网工具不由外部服务直接操纵 |
| Watchdog | 独立非破坏性健康/进展监控，动作需要 Approval | 跨控制域监控时不得隐式扩权 |
| Budget | GPU/Token/工具配额、最大并发 Ticket、来源与 Job 级限额 | 增加 Egress Cost、服务商保留期、合规与跨域 RTO |

**最小可行开发顺序**：只读 Source Adapter → Deterministic Admission Gate → 一条 Router/Worker 工作流 → 有事务的 Ticket/Outbox → Observe-only Proactive Rules → 高风险动作人工批准 → Watchdog/恢复。不要从“后台无人授权地自动修改生产系统”开始。

## 11. 30–60 分钟完全本地复现实验

目的：验证**多 Thread 事件直通能否减少 Router 负载**，并用故障注入检查 Mandate 和队列安全。仅需 Python 3 标准库。构造 3 个 Worker、10 个 Thread、100 条合成 Trigger，包含新任务、订阅消息、无权 Source、Rule Change、已取消任务的后续消息。

~~~python
from collections import defaultdict

class Demo:
    def __init__(self):
        self.owner, self.policy_version, self.router_calls = {}, 1, 0
        self.audit = []
    def route(self, event):
        if not event["admitted"]:
            self.audit.append(("reject", event["id"]))
            return
        thread = event["thread"]
        if thread in self.owner:
            self.audit.append(("context", event["id"], self.owner[thread]))
            return
        self.router_calls += 1
        ticket = "T-" + thread
        self.owner[thread] = ticket
        self.audit.append(("mandate", event["id"], ticket, self.policy_version))

events = [
    {"id": i, "thread": str(i % 10),
     "admitted": i % 13 != 0}
    for i in range(100)
]
demo = Demo()
for e in events: demo.route(e)
print("router decisions:", demo.router_calls)
print("accepted and audit logged:", len(demo.audit))
# 进阶: 再实现 Policy Version 变更/撤权、取消、重复事件幂等
~~~

改造对照：删除 `if thread in self.owner` Fast Path，令所有合格 Trigger 经 Router；测 **Router Decisions、每条事件额外处理步骤、错误授予 Mandate 数、有效工作回执、重复事件**。增加模拟延迟（分布与种子固定）记录 P50/P95。**这个教学 Mock 不包含 LLM，因此只能验证路由机制，不能复现原团队 Benchmark。**

## 12. 质疑、面试与知识迁移

**独立批评**：有工程师认为“把 Session 藏起来”并不意味着业务上下文管理已经解决。实际工作上下文还包括具体 Repo/Environment、角色、权限、工具与历史决议。一个全局 Router 若仅靠猜测用户属于哪个项目，可能把错误动作送到错误环境。参考[冯若航评论](https://blog.vonng.com/ai/ds-super-agent/)；这是值得设计反例的观点，而不是一项定量反证。

**面试系统设计题**：Design an always-on multi-tenant agent platform that monitors GitHub/IM, spawns long-running workers, handles permission changes, replay/recovery, and controls tool execution. 应讨论：
- Trigger Deduplication、Thread Ownership、Ticket Lease、幂等 Outbox；
- Fast/Slow Policy、Message-as-Data vs Authorization、Policy Version Revalidation；
- Router 单点瓶颈、Batching、Backpressure、Worker Slots、Watchdog 的独立权限；
- Context Graph（对象关系）与 Token Window（缓存）分离；
- Cloud/On-prem Boundary、BYOM、Secret Broker、被攻陷 Worker 的影响半径。

**三条沉淀**：

1. **Session 是执行机制；Thread/Ticket/Mandate 才接近持久任务语义。**
2. **所谓主动 Agent 的核心是事件准入、授权、调度、持久化和审计，模型只负责部分语义推理。**
3. **持续在线不仅是永不停止，还包括恢复、撤权、限制噪声与确认有实际进度。**

### 交叉关联到旧知识

- [Thin Orchestrator + Git Workspace]({{ '/notes/2026/11/2026-11-01-hybrid-agents/' | relative_url }})：Router 责任边界、工作区并发与幂等提交。
- [Perplexity SPACE]({{ '/notes/2026/10/2026-10-31-hybrid-space/' | relative_url }})：执行隔离与网络出口；补全 Super-agent 原型缺少的硬沙箱边界。
- [BrowseSafe++]({{ '/notes/2026/11/2026-11-04-onprem-prompt-injection/' | relative_url }})：不可信 Trigger、Prompt Injection 和强授权。
- [Decision Models]({{ '/notes/2026/11/2026-11-02-onprem-decision-models/' | relative_url }})：Router 可以尝试用专门的小模型做语义分类，但独立策略仍不可省。
- [Knowledge Graph]({{ '/knowledge-graph.html' | relative_url }})：从 Context Engineering → Event-driven Agent → Durable State 的关系探索。

**开放问题**：Router 何时应分片？如何避免“默默浪费大量 tokens”的主动循环？跨租户的 Thread 引用是否构成信息泄漏？A2A 权限如何在 delegation 后保持不可提升？Watchdog 误判断时谁来监督 Watchdog？

