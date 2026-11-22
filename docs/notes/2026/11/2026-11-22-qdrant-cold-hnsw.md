---
layout: default
title: "Qdrant 冷盘 HNSW：为什么查询变快，首次请求反而更慢？"
date: 2026-11-22
track: cross-deployment
tags: [rag, hnsw, vector-database, io-uring, cache, benchmarking]
permalink: /notes/2026/11/2026-11-22-qdrant-cold-hnsw/
---
# Qdrant 冷盘 HNSW：为什么查询变快，首次请求反而更慢？

**[打开中文原理演示]({{ '/interactive/2026-11-22-qdrant-cold-hnsw-map.html' | relative_url }})** · [知识关系图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})

**解决什么：** 向量数据库在冷盘读取 HNSW 图时，一次查询可能要先读取节点偏移量、再读取邻居，导致额外 I/O；但提前加载偏移量也会拖慢冷启动。**读完掌握：** 如何区分 graph open、query latency、端到端 cold latency、RPS 和 Recall，判断预取是否真的值得。

## 1. 一手资料、发布日期与证据等级

- **[Qdrant v1.20.1 Release](https://github.com/qdrant/qdrant/releases/tag/v1.20.1)**：2026-11-13 发布，包含 HNSW 大段 PiPNN 建图、冷盘过滤与减少 HNSW graph reads。本篇只深读其中一个有独立 PR 与数据的机制，**不是**把三个改动混成一个优化。
- **[PR #10743 Prefetch graph links offsets](https://github.com/qdrant/qdrant/pull/10743)**：2026-09-23 创建，2026-10-23 合并；代码与作者实验表公开。技术机制早于本期，11-13 Release 是其进入版本的证据，不应称作 11-22 新发明。
- **[PR files](https://github.com/qdrant/qdrant/pull/10743/files)**：涉及 `graph_links/header.rs`、`links_file.rs`、`graph.rs`、`universal_io` 等 Rust 实现和测试。
- **[Qdrant 仓库](https://github.com/qdrant/qdrant)**：Apache-2.0，公开实现。本库未执行该 PR 的真实 Qdrant benchmark；下面的 Python 是**独立教学模拟**，不能冒充引擎性能复现。

本篇作者数据均来自 PR 描述，独立公式/架构/实验设计均明确标为本站推导。PR 里对 Serverless 结果也明确承认可能受实验设置影响。

## 2. 第一性原理：图遍历为什么变成多次随机 I/O

HNSW 是多层近似最近邻图：查询从入口点开始，逐层选择更近的邻居，在底层以候选队列搜索。令候选扩展数为 E，访问的不同图节点为 V。真正的成本不仅是距离计算，还包括图邻接表读取、向量数据读取、过滤索引和队列操作。

**旧式 inline-storage 图读取：** 首先读取 `offset[node_id]` 定位节点邻接表，再根据偏移读取 `links[node_id]`。在偏移与邻接数据均未缓存且存储后端按范围读取时，关键路径可能串联两次 fetch。

**本次改动：** 在打开图时预取 offsets，使图遍历期间不必为每个节点再发一次 offset fetch。它并不是预取整个图、不是修改 HNSW 的贪心搜索算法，也不是消除向量读取。

教学近似模型：

```text
T_cold = T_open + T_query + T_network_or_service + T_other
T_query ≈ E × (t_distance + t_queue) + N_offset_miss × L_offset
          + N_link_miss × L_link + T_vector + T_filter
```

其中 N 与 L 是逻辑缺失次数及相应等待；**不是**把 I/O 次数直接乘平均延迟当作严格预测，因为异步重叠、缓存、并发、预取批量和尾延迟都会改变关系。优化减少 `N_offset_miss`，但增大 `T_open` 与初始读取字节数。

### 可执行流程（教学伪代码）

```python
# baseline: 访问每个候选节点时，可能触发两次依赖读取
async def old_neighbors(node, store):
    offset = await store.read_offset(node)
    return await store.read_links(offset)

# optimized: graph-open 阶段将 offsets 预热到本地缓存
async def open_graph(store):
    await store.prefetch_offsets()   # 预取成本移到 open
    return store

async def new_neighbors(node, store):
    offset = store.cached_offset(node)
    return await store.read_links(offset)
```

这只是展示 I/O 依赖，**不是** Qdrant 源码或生产可直接运行的接口。真实代码通过 UniversalReadAsync / CachedReadFs 等接口按不同后端实施，某些后端的 populate 是 no-op。

## 3. 关键组件、信任边界与故障模式

| 组件 | 输入 → 输出 | 故障/边界 |
|---|---|---|
| Query API | 向量、过滤条件、top-k → 搜索请求 | 租户身份和访问控制先于检索 |
| HNSW Search | 入口点与 ef → 候选扩展 | ef 影响 Recall、访问量与尾延迟 |
| Offset Index | node ID → 邻接数据位置 | 冷盘缺失、版本错配或损坏 |
| Links Storage | offset → 邻居 ID | 随机 I/O 与局部性差 |
| Vector Storage | 邻居 ID → 向量 | 量化、页缓存与距离计算 |
| Payload Filter | 条件 → 候选限制 | 冷盘多条件读取，另一个独立优化 |
| Universal I/O | 读范围 → 本地数据 | mmap、io_uring、远端缓存语义不同 |
| Cache / Prefetch | offsets → 预热内容 | 开机 I/O 峰值、内存预算与竞争 |
| Metrics | open/query/total/Recall/RPS | 只报 query 会误导决策 |

**可信边界：** 本地磁盘和索引文件仍需版本/完整性检查；缓存不是授权系统，不能以预取绕过文档级 ACL。检索命中不等于模型可以引用该文档，RAG 的权限过滤和证据验证仍独立必要。远端对象存储、托管索引或混合网络属于不同信任域；不可把生产敏感向量和原始 payload 发送到未获批环境。

## 4. 作者实验：同一优化的相反结果

PR 使用 `arxiv-titles-384-angular-filters`，单 segment **2,138,591** points，`m=16`、`ef_construct=100`、inline storage、float16、2-bit binary quantization。

| 指标 | 原实现 dev | 预取版 | 解释 |
|---|---:|---:|---|
| Serverless cold open 中位数 | 53.6 ms | 215.1 ms | **预取明显增加启动成本** |
| Serverless cold query 中位数 | 199.3 ms | 133.8 ms | 查询阶段更快 |
| Serverless cold total 中位数 | 251.7 ms | 345.7 ms | **完整首次请求反而更慢** |
| Server + io_uring, parallel=1 | 1633 RPS | 1731 RPS | 约 1.06× |
| Server + io_uring, parallel=8 | 7394 RPS | 7925 RPS | 约 1.07× |
| Server + io_uring, parallel=32 | 16703 RPS | 18147 RPS | 约 1.09× |

Serverless 作者模拟网络限制：localhost + qdisc，1.5 ms ±350 µs 延迟、10 Gbit 带宽。上表是作者提供的中位数/RPS，不是本站复现；PR 还给出了 min/max，不能把单次结果当稳定 SLA。不同表分别测试 serverless cold 与 server + io_uring，不可直接混算百分比。

本站独立算术：query 中位数下降约 `(199.3-133.8)/199.3=32.9%`，但 total 中位数增加约 `(345.7-251.7)/251.7=37.3%`。这是基于**作者表格的派生计算**，不是新 benchmark。对于一次性 cold request，端到端体验优先于局部 query 指标。

### Benchmark 限制与迁移条件

没有公开证据证明所有 payload、过滤比例、Recall@k、磁盘类型、冷启动频率、缓存容量、并发和数据集分布均受益。尤其本 PR 未报告在上述表格里对应的 Recall 曲线，不能把吞吐改善等同于检索质量改善。测量前必须锁定 commit、索引构建参数、量化、查询集、top-k/ef、硬件与缓存清空方式。大规模重建 HNSW 的 PiPNN 属于另一个改动，不能归功于 offsets 预取。

## 5. On-prem 与 Controlled Hybrid：同一个问题，不同代价

| 决策 | On-prem / Self-hosted | Controlled Hybrid |
|---|---|---|
| 数据边界 | 向量、payload、ACL、查询留在内网；脱敏合成集做基准 | 仅获批准的匿名向量/查询可出域；禁止原文/客户标识泄露 |
| CPU/GPU/Serving | HNSW 图 I/O 主要看 CPU、RAM、SSD；GPU 用于 embedding/rerank/LLM，不应把索引 I/O 优化写成 GPU 提速 | 可独立扩展检索 CPU/存储与 GPU 模型 Serving；网络 RTT 需单独记账 |
| 存储/网络 | NVMe 与 OS page cache、io_uring/mmap 差异；冷启动预热可能争抢 IOPS | 远端块/对象读取、缓存层、跨区 egress、失联和重试更重要 |
| 治理 | 固定索引版本、ACL、审计、加密与最小权限 | 增加跨域密钥、区域、数据驻留、供应商审计和回退路径 |
| 成本/许可证 | Apache-2.0 自建软件；承担磁盘、RAM、运维和冷启动资源 | 托管服务报价与合同单独核查；多计流量、缓存和数据治理成本 |
| 迁移难度 | 先在隔离 staging 比较两版 Qdrant，数据格式/兼容性测试 | 先设计合规出口与同一查询集基准；迁移并非简单改 endpoint |

**选择原则：** 如果检索服务长期热驻留、query I/O 是瓶颈，预取可能合理；如果实例频繁缩容、冷启动占主导，可能更差。Hybrid 并不自动更快，网络和安全控制可抵消局部优化。

## 6. 30–60 分钟本地实验（零闭源 API，标准库）

目标是**验证成本转移的方向**，不是复现 Qdrant 性能。使用 Python 3.10+，本地合成节点，确定性模拟 offsets 和 links 的读取等待。代码不访问网络、不下载任何数据。

```python
import random, statistics, time
rng = random.Random(42)
N, VISITS = 2000, 80
nodes = [rng.randrange(N) for _ in range(VISITS)]
# 假定 offset miss=0.8ms, link miss=1.2ms, prefetch 每条 0.04ms
def run(prefetch=False, open_cost_per_node=0.04, offset_ms=0.8, link_ms=1.2):
    open_ms = N * open_cost_per_node if prefetch else 0
    query_ms = len(nodes) * link_ms + (0 if prefetch else len(nodes) * offset_ms)
    return open_ms, query_ms, open_ms + query_ms
for mode in [False, True]:
    print("prefetch", mode, "open/query/total(ms)", run(mode))
# 改 N、VISITS、open_cost_per_node，找到冷启动与热查询的交叉点
```

**预期教学结果（数学模拟，非实测）：** baseline 0/160/160 ms；prefetch 80/96/176 ms。预取使 query 快、首次总时间慢。将 `VISITS` 增至 160 会改变结论。请自己解释为什么：一次 open 的固定成本可被更多图访问摊销。上述模型没有模拟 page cache、并发、磁盘随机访问、过滤、Recall；不得拿数字作生产容量规划。

实验步骤：前 10 分钟检查公式；10–25 分钟运行并改访问次数；25–40 分钟画出 total 随访问次数变化的曲线；40–60 分钟记录三种工作负载（冷请求、热请求、频繁弹性伸缩）下的决策与反例。可用标准库 CSV 输出数据，无需外部包。

## 7. 深入复现路线（真实引擎）

1. 在**隔离机器**分别构建 PR 合并前 commit 与包含 #10743 的 v1.20.1；保存二进制 SHA、Rust/OS、存储后端版本。生产环境不要直接切换。
2. 使用公开或合成 384 维向量，尽量固定 segment 数、点数、HNSW m/ef_construct、inline_storage、float16、量化、过滤分布。小样本只能验证机制，不代表百万级 I/O。
3. 明确三套场景：完全 cold（包括 open）、热驻留 query、频繁启动的短任务。使用可复现的 cache-reset/新实例流程，分别记录 p50/p95/p99 的 open/query/total、RPS、读次数/字节、RSS、IOPS、CPU、Recall@k。
4. 先以精确搜索计算 Recall 参考；逐个调整 ef、filter selectivity、并发、page cache 与存储类型。把数据版本与 trace 留在受控目录。
5. 通过 `graph_links/links_file.rs`、`graph_links/header.rs` 与 `universal_io` 的差异确认哪些后端执行 populate，哪些 no-op；用代码覆盖率或 trace 证实，不把 mmap 与远端缓存视为等价。
6. 对比失败注入：预取中断、磁盘读错误、冷缓存耗尽、segment 替换、超时与重试。确认服务是否回退/返回错误，而不是静默丢召回。
7. 公开报告仅用合成数据、机器规格、代码版本和聚合指标；不得发布任何企业索引、查询、ACL 或日志。

## 8. 系统设计面试题与研究讨论

**题一：为什么 cold query 快 33%，cold total 反而慢 37%？** 解释 offset 预取将延迟移到 open；比较真实用户 SLA 与局部指标。讨论预热成本可否与请求并行，以及对尾延迟的影响。

**题二：你如何为 1000 QPS 企业 RAG 选 HNSW 缓存策略？** 必须明确数据规模、更新率、过滤率、Recall@k、top-k/ef、CPU/RAM/SSD、冷热比、峰值扩缩容、ACL 和 p99 SLA；不要仅报平均 RPS。

**题三：在 Controlled Hybrid 中哪些数据可以移动？** 讨论 embedding 是否可逆、原始 payload/ACL 的敏感性、网络 egress、区域约束、缓存失效和加密密钥归属。外部服务调用必须先经过治理批准。

## 9. 三项结论与后续研究

1. **局部 I/O 次数下降不保证端到端变快。** 必须同时计量 open、query、total。
2. **预取是在冷启动成本和热查询成本之间做交换。** 后端缓存语义、工作负载和并发决定收益方向。
3. **检索性能和检索正确性要分开测。** Recall、ACL、过滤与引用证据质量不能被 RPS 替代。

后续：核查 Qdrant 1.20.1 中 PiPNN 大段建图与冷盘多条件过滤的独立 PR/测试；评估何时应将 HNSW I/O 与 RAG Contextual Embedding / ColBERT 的召回质量分开优化。

**关联阅读：** [RAG 检索进阶]({{ '/notes/2026/11/2026-11-01-onprem-retrieval/' | relative_url }}) 解决语义表达与召回质量；本篇解决索引图的 I/O 延迟。 [Paged Experts]({{ '/notes/2026/11/2026-11-07-paged-experts/' | relative_url }}) 也在做数据驻留/搬运取舍，但管理的是模型专家权重而不是向量图。
