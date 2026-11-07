---
layout: default
title: "Paged Experts：MoE 权重分页、GPU Residency 与推理成本的第一性原理"
date: 2026-11-07
track: cross-deployment
tags: [moe, inference, sglang, paged-experts, gpu-memory, quantization, paging, systems]
permalink: /notes/2026/11/2026-11-07-paged-experts/
---
# Paged Experts：让超出显存的 MoE 模型继续在 GPU 上计算

> **研究日期：2026-11-07。** 这是对 SGLang v0.5.23（2026-11-02 发布）新增的可选 Paged Experts 机制的独立技术拆解。**不是本站实测，也不是所有 GPU/模型的通用 30 倍加速承诺。**

**点击式架构图**：[基线 / Paged Experts / 失败与恢复 / Controlled Hybrid 四视图]({{ '/interactive/2026-11-07-paged-experts-map.html' | relative_url }})。图是基于公开代码/PR 的**独立工程抽象，不是官方架构图**。

## 1. 一手来源、日期与证据等级

- [SGLang v0.5.23 release](https://github.com/sgl-project/sglang/releases/tag/v0.5.23)，发布于 **2026-11-02 22:14 UTC**；明确宣布可选 Paged Experts。
- [#42557：Paged Experts 核心 PR](https://github.com/sgl-project/sglang/pull/42557)，**2026-10-05 创建、10-19 合并**。提供详细设计、代码、硬件环境、准确性和速度对照；**核心机制并非 11 月才首次出现**。
- [#45787：量化格式兼容与正确性 PR](https://github.com/sgl-project/sglang/pull/45787)，**2026-10-22 创建、10-25 合并**；揭示量化参数漏分页会造成静默错误。
- [官方文档 Paged Experts](https://docs.sglang.io/advanced_features/paged_experts.html)（文档地址/内容可能随版本调整）；[SGLang 源码](https://github.com/sgl-project/sglang/tree/main/python/sglang/srt/layers/moe/paged_experts)。
- [llama.cpp](https://github.com/ggml-org/llama.cpp) 提供不同的 CPU MoE offload 路径；本期比较以作者 PR 中经过调优的对照为准，**不是本站独立复测**。

**证据分级**：以下表格数字来自 PR 作者测试；公式、阈值、部署建议和教学模拟为本站独立推导。社区讨论仅引用可查的 PR 审查和提交，不推断未检索到的 Reddit 共识。

## 2. 为什么它值得 ML Systems / AI Infra 面试？

当 MoE 模型总权重超过 GPU 显存时，常见方案有：减小精度、把部分层/专家放 CPU 算、每一步把固定 offload 权重搬上 GPU、跨 GPU 做 expert parallelism。Paged Experts 的关键是：**路由只会激活一小部分专家；为什么要在每一步搬运所有专家？**

该工作不是“更大的上下文窗口”论文，而是把 OS 的**Working Set / Cache / Replacement / Miss Penalty**问题带到 MoE 的专家权重上。它横跨模型结构、PCIe、HBM、Pinned RAM、CUDA Graph、Kernel Contract、量化正确性和多请求调度。既可做系统设计面试题，也能指导单卡 GPU 的容量规划。

与现有 [ReplaySSM]({{ '/notes/2026/10/2026-10-31-onprem-replayssm/' | relative_url }})（减少 recurrent state 的 HBM 写回）和 [Sticky Sessions]({{ '/notes/2026/11/2026-11-03-onprem-sticky-sessions/' | relative_url }})（会话路由保持状态局部性）**不是同一优化**：这里缓存的是**模型 Expert Weights**，不是 SSM State、KV Cache 或 Session Context。

## 3. MoE 的计算与显存模型

对第 \(l\) 层输入 token 表示 \(h\)，Router 给出专家集合 \(S_l(h)\)，通常 \(|S_l(h)|=k\ll E\)：

\[
y_l(h)=\sum_{e\in S_l(h)}p_{l,e}(h)\,\operatorname{Expert}_{l,e}(h).
\]

若每层有 \(E\) 个专家，每个专家的权重占 \(w_l\) 字节，共 \(L\) 个 MoE 层，那么所有专家权重约为 \(M_{expert}=\sum_l E_lw_l\)。传统全驻留需要 \(M_{expert}+M_{shared}+M_{KV}+M_{runtime}\le M_{HBM}\)。Paged Experts 让 GPU 仅保留 \(K_l\) 个专家槽：

\[
M_{GPU}\approx M_{shared}+M_{KV}+M_{runtime}+\sum_l K_lw_l.
\]

其余完整专家存在 **pinned host RAM**，按 Router 实际选择的专家将缺失者拷到 GPU；**MoE 运算仍由 GPU Kernel 执行**。它不同于 llama.cpp 的 CPU 计算专家，也不同于普通 SGLang `--cpu-offload-gb` 每轮搬固定 offload 权重的方式。

### 3.1 为什么速度不是简单的 E/K 倍？

一个 Decode Step 的额外成本近似为：

\[
T_{step}\approx T_{route}+T_{plan}+T_{H2D}(m)+T_{GPU\_MoE}+T_{sync},
\quad T_{H2D}(m)\gtrsim\frac{m\cdot w}{B_{effective\ PCIe}}.
\]

\(m\) 是本步未命中的不同专家数。实际还受 pinned memory、PCIe link width、copy overlap、量化张量布局、CPU/GPU 同步和多个 MoE 层影响。**不是每个 token 只拷 k 个专家**：已经驻留的不拷；并发多个 token 的专家并集可能超过 K，需分多 wave，导致重复换页。

在独立同分布、均匀随机选择的粗略模型下，若 K 个专家驻留，单个新选专家的命中率近似 \(K/E\)，单步期望缺失数约 \(k(1-K/E)\)。这是**教学近似**；真实 Router 的专家热度与时序相关性决定 LRU 是否有优势。

### 3.2 Residency、LRU、Wave Planning

1. **Host Store**：按专家 ID 保存完整权重及量化 scales/zero-points，通常在 pinned RAM。
2. **GPU Slot Table**：只有 K 个槽，维护 expert ID → slot 的映射；未驻留的专家按 LRU 淘汰。
3. **Route-aware Page-in**：路由产生的本步专家集合与槽表比对；只搬缺失专家，更新 slot map。
4. **Multi-wave**：若本步请求的不同专家数量大于 K，分多轮 GPU 执行，保留每个 token/expert 的中间输出，最终按 Router 权重组合。
5. **CUDA Graph**：常规 Decode Graph 捕获需要固定/可预测的工作空间。原始 PR 的 DeviceExecutor 用 GPU 上的 Residency 和 Gather 避免 Host Sync；Graph 可捕获的并发上限为 \(\lfloor K/k\rfloor\)，超过时要采用 Eager/不同执行路径或拒绝不支持配置。

这里的核心不变量是：**每个 slot 的权重、scales、zero-points 和量化重排状态必须属于同一个 expert ID**。否则不是简单的性能退化，而是**静默计算错误**。

## 4. 数据流：Paged Experts 与普通 Offload 对照

~~~mermaid
flowchart LR
 Q[Tokens] --> R[MoE Router top-k]
 R --> P[Residency / LRU Planner]
 P -->|hit| G[GPU expert slots]
 P -->|miss| H[(Pinned host expert store)]
 H -->|H2D selected experts| G
 G --> K[Fused MoE GPU runner]
 K --> C[Weighted top-k combine]
 C --> O[Next layer]
~~~

普通 CPU offload 不管 Router 选择哪位专家，都可能每层搬固定权重；Paged Experts 利用专家稀疏激活和缓存局部性。**代价**是必须付出 Host RAM、Pinned Memory、PCIe 带宽和复杂的内存一致性/图捕获工程。

## 5. 实现模块与源码阅读路线

| 模块 | 职责 | 关键失败模式 |
|---|---|---|
| `method.py` | 包装 FusedMoE；分配 K 槽、重定向加载器 | checkpoint 分片、global expert 数量与 slot 维度混淆 |
| `formats.py` | 推断量化格式和需分页的 tensor 集合 | 漏掉 zero-point、scale、bias 导致静默错误 |
| `runners.py` | Triton / Marlin Runner Contract 和 no-combine | 不同 Runner 的 weighted sum 语义不一致 |
| `store.py` | pinned host tensor、page-in/gather | Host RAM 不够、UVA/驱动不兼容 |
| `residency.py` | LRU、slot map、wave planning | eviction 后映射未更新、并发 race |
| `executor.py` | Host Eager / Device Graph 执行 | Graph capture 对动态 shape/同步的限制 |
| `sizing.py` | 按 checkpoint 字节与 KV reserve 选 K | KV cache 被挤占，峰值 OOM |
| `paged_experts.cuh` | GPU 端规划和 gather Kernel | 非对齐字节行、量化张量搬运遗漏 |

#45787 的反例尤其值得精读：AWQ zero-points 没分页时，作者记录的 median logprob 差异从约 **0.0033** 升至 **1.67 nats**；这说明**看似运行成功并不代表结果正确**。该 PR 增加自动推导 Tensor 集合、Runner 检查、Repack Independence Check 与 Host Store 初始化规则。

## 6. 作者 Benchmark：数据、设置与局限

**作者环境**：RTX 5070 Ti 16GB、PCIe 5.0 x16、62GB RAM Linux；RTX 4070 Laptop 8GB、PCIe 4.0 x8、WSL2 可用 RAM 54GB。模型主要为 Qwen3-30B-A3B 的 GPTQ int4/FP8，使用 ShareGPT 实际提示、256 输出 token、预热、关闭 prefix caching，尽量匹配 KV 容量。llama.cpp 的 CPU MoE 层数/线程参数经过搜索调优。原始 PR 说明 headline cell **测两次**，并非大规模统计重复实验。

| 配置与工作负载 | 作者报告的性能 | 解释边界 |
|---|---|---|
| 16GB GPU、int4、K=92/128、单流 | Paged **约 205.7 tok/s**；SGLang 固定 CPU Offload **16.6 tok/s** | 同项目不同 offload 策略；约 12×，不是对所有引擎 12× |
| 16GB GPU、int4、单流 | Paged **约 205.7**；调优 llama.cpp **约 193–194 tok/s** | 实际差距小，不能宣称对 llama.cpp 12× |
| 16GB GPU、FP8、单流 | Paged **87.7**；调优 llama.cpp **45.2 tok/s** | 与 PCIe 和专家驻留比例有关 |
| 8GB Laptop、4 并发、小 K/E | Paged **约 11–12 tok/s**；llama.cpp **约 41 tok/s** | 并发路由工作集超过 K 时 Paged 明显可能更慢 |
| 短提示 TTFT | 作者报告某些 int4 条件 Paged **89–90ms** vs llama.cpp **68ms** | Prefill 触达多数专家；换页启动成本更高 |

原型验证还比较了 logprobs：BF16/FP8 在特定设置下报告 bit-identical；GPTQ Marlin 的 batch shape 变化会造成有限数值差异。**这些不能保证任意量化格式、任意模型、任意 CUDA Kernel 的精确相等。** GSM8K 200 题上 Paged int4 0.955 vs llama.cpp 0.965；小样本不支持“Paged 改善推理准确率”结论。

## 7. 正确性、信任边界与故障注入

权重分页是**计算内存管理**，不是安全隔离。模型文件、Tokenizer、Checkpoint Header、远端仓库/镜像都属于供应链输入；在受限环境应固定 SHA/镜像 digest、验证许可和来源。GPU runtime/driver、Pinned Memory、PCIe、Host Store 是可信计算面但也可能出错。模型生成的内容仍不可信，不因推理速度提升而免除 Prompt Injection/Tool Authorization。

**必须测的失败路径**：OOM（K 选太大）、Pinned RAM 配额不足、PCIe 降速、GPU page miss thrashing、CPU/GPU slot map 竞态、Quant Scale 漏页、Graph 捕获失败、多个请求使 \(|\bigcup S|>K\)、冷启动慢。保护措施包括 Admission Control、并发限制、GPU 内存水位、Fallback 到 eager、正确性 Oracle、版本化回滚、长/短 Prompt 分桶测量。

### 7.1 独立推导：可观测指标

每层记录 `hit_ratio`、`bytes_h2d`、`evictions`、`waves_per_step`、`resident_slots`；端到端记录 TTFT p50/p95/p99、TPOT/ITL、输出 tok/s、GPU HBM/KV 水位、Pinned RAM、CPU/GPU Sync 和故障恢复。**不能只看吞吐**：可能出现 P95 TTFT 或并发性能恶化。

## 8. On-prem 与 Controlled Hybrid：同一原理、两种控制面

| 维度 | On-prem / Self-hosted | Controlled Hybrid |
|---|---|---|
| 数据边界 | 权重、请求、日志、KV、Pinned Host RAM 全在内网；输入输出审计和本地 RBAC | 仅允许经分类/审批的公开或脱敏任务离开；Host Store 与 GPU 必须位于**同一低延迟机器/节点**，不能跨公网分页 |
| GPU / Serving | 单卡小显存尤其受益；96GB 卡若模型本就 fit，先量化/KV/并发测量，分页可能纯增开销 | 云 GPU 只有在获批数据域内运行；评估 GPU 规格与本地同等条件，避免把网络传输误算作 PCIe |
| 模型 / License | 核查模型权重许可、量化格式、SGLang 版本、驱动 CUDA 兼容；Apache-2.0 引擎不代表模型可任意商用 | 额外核查镜像/Checkpoint 出域许可、云服务条款、数据保留、供应链 SBOM |
| 网络 | PCIe Gen/lanes、NUMA、Pinned RAM 是性能关键；服务调用与企业内网 ACL 独立 | 客户端→云端 RTT 增加 TTFT；权重分页仍只发生在云主机 CPU RAM↔GPU |
| 治理 | 灰度、审计、输出策略、工具权限、容量限制、OOM 回退 | 额外设置跨域 egress allowlist、密钥代理、数据最小化和故障回切 |
| 成本 | 资本设备已持有时，权衡 RAM、GPU HBM、功耗、SRE 与请求排队 | 比较按秒 GPU/CPU RAM/传输计费、实例冷启动、流量与合同成本 |
| 迁移难度 | 先 CPU-only 教学 Mock → 单 GPU A/B → 原型隔离环境 → 有界生产试点 | 先数据分类/合规审批 → 非敏感基准 → 受控路由与回滚；绝不直接让云节点访问内网原始资料 |

**特别注意**：在高显存 GPU 上，不要仅因“Paged Experts 可用”就启用。若权重能全驻留，普通 GPU 执行省去分页元数据和 Host Store；如果显存吃紧，先确认更低位量化、KV cache 配额和并发策略是否更简单可靠。

## 9. 30–60 分钟无 GPU、无闭源 API 的可复现实验

用 Python 标准库模拟每层 E 个专家、K 个 GPU slots、每步多个 token 的 top-k 路由，比较**固定搬运全部非驻留权重**、**LRU route-aware paging** 与**理想全驻留**。这验证算法性质而不是 SGLang GPU 加速结果。

~~~python
from collections import OrderedDict
import random

def simulate(E=128, K=24, top_k=4, steps=1000, batch=4, seed=17, hot=0.8):
    rng = random.Random(seed)
    resident = OrderedDict((i, None) for i in range(K))
    misses, waves, transfers = 0, 0, 0
    for _ in range(steps):
        requested = []
        for _ in range(batch):
            # 80% 热专家路由，20% 均匀；独立合成数据
            pool = list(range(16)) if rng.random() < hot else list(range(E))
            requested += rng.sample(pool, top_k)
        unique = list(dict.fromkeys(requested))
        waves += (len(unique) + K - 1) // K
        for expert in unique:
            if expert in resident:
                resident.move_to_end(expert)
            else:
                misses += 1
                if len(resident) >= K:
                    resident.popitem(last=False)
                resident[expert] = None
                transfers += 1
    return dict(hit_rate=1-misses/(steps*batch*top_k),
                expert_pages=transfers, mean_waves=waves/steps)

for K in (8, 16, 24, 48, 92):
    print("K", K, simulate(K=K))
~~~

**实验变量**：K=8/16/24/48/92；batch=1/4/8；hot=0.2/0.8；再把 route 分布改成完全均匀。记录 Miss Rate、Pages per Step、Waves、模拟 H2D Bytes。将每专家字节设为合成 4 MiB，假设有效带宽 16/32 GB/s，计算 \(T_{H2D}\) 下界；画出随 K 和 batch 的变化。**不要把该数字叫真实 tok/s**。

**重要模型简化**：上面的 `waves` 是唯一专家数除 K 的粗略下界，未模拟真实 Runner 的逐 token top-k 合并和多 wave 的 slot 冲突；当 K<top_k 或每层的执行限制不同，需额外验证。要做严谨实验，应实现每一 wave 的 slot 规划并对照完全无分页的输出 Oracle。

## 10. 进阶真实复现路线（需合适 GPU）

1. 锁定 SGLang v0.5.23、模型/Tokenizer/量化 Checkpoint SHA、GPU 驱动、CUDA、Host RAM、PCIe lanes。
2. 选择受支持的 MoE 和量化格式；使用 `--enable-paged-experts`，可用 `--paged-experts-num-resident` 控制 K；先阅读 [官方文档](https://docs.sglang.io/advanced_features/paged_experts.html) 并以固定版本为准。
3. 对照 A：SGLang 原生 CPU Offload；B：Paged Experts；C：llama.cpp 调优 CPU MoE；D：如果 fit，纯 GPU 全驻留。统一输入集、输出长度、prefix caching、KV 预算、warmup、并发。
4. 运行确定性输出/Logprob 对照、长短 Prompt TTFT、并发=1/4/8、冷热 Expert 访问、错误注入与故障恢复。
5. 记录样本量和重复次数、置信区间、GPU 显存和 CPU Pinned RAM，单独报告作者指标与本地指标。注意不同量化方案“字节近似相同”不等于数值严格一致。

## 11. 面试系统设计：Design a single-GPU MoE serving system beyond VRAM

**追问 A**：K 如何随 KV Cache 与并发动态调整？要讨论 HBM 分配、峰值碎片、最大上下文、admission 和稳定的 hysteresis。

**追问 B**：为什么 GPU 端 DeviceResidency 能进入 CUDA Graph，而 CPU 规划可能产生 Sync？解释 GPU control-flow、UVA gather、固定缓冲和 graph replay 的限制。

**追问 C**：多请求请求的专家集合超过 K，如何避免 Thrashing？回答分 wave、batch 限制、hot expert pinning（未来优化）、流量分桶和服务级降级。

**追问 D**：量化参数漏搬怎样检测？回答逐层完整权重 Oracle、逐专家参数集合检查、byte-level repack invariants、Logprob 与 end-to-end eval，而非只看响应 HTTP 200。

**追问 E**：何时宁可 CPU MoE 或多卡 EP？从 PCIe/HBM 带宽、GPU 容量、并发、TTFT、成本、模型许可和网络故障域回答。

## 12. 三项结论与开放研究

1. **Sparse activation ≠ sparse memory movement，除非执行层知道 Router 选了谁**。Paged Experts 把稀疏路由转化为按需搬运。
2. **K 是显存与延迟的调节旋钮**：多留专家槽会挤压 KV；少留专家槽会引发更多 Miss/Waves，尤其多并发时。
3. **正确性是内存分页设计的一部分**：量化元数据、Runner、Repack、CUDA Graph 都必须与 Expert Residency 一致，不能只优化 tok/s。

开放问题：专家访问的时间局部性在长会话与多租户是否稳定？何时值得预取？如何做 NUMA-aware pinned windows、跨请求的热点专家共享、动态 K 和 SLO 驱动的流量整形？Paged Experts 与未来量化、混合 Mamba/MoE、Expert Parallel 的组合是否保持数值不变量？

**旧文关联**：[ReplaySSM]({{ '/notes/2026/10/2026-10-31-onprem-replayssm/' | relative_url }})（HBM I/O 但状态不同） · [Sticky Sessions]({{ '/notes/2026/11/2026-11-03-onprem-sticky-sessions/' | relative_url }})（缓存局部性） · [Shadow Traffic]({{ '/notes/2026/11/2026-11-03-hybrid-shadow-traffic/' | relative_url }})（安全发布与回滚） · [Knowledge Graph]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})。

