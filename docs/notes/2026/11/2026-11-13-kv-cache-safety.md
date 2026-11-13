---
layout: default
title: "KVGuard：为什么 KV Cache 会悄悄串写其他请求"
date: 2026-11-13
track: cross-deployment
tags: [llm-serving, kv-cache, memory-safety, paged-attention]
permalink: /notes/2026/11/2026-11-13-kv-cache-safety/
---
# KVGuard：为什么 KV Cache 会悄悄串写其他请求

> 研究日期 2026-11-13。论文 2026-11-04。作者结果与本站独立工程推导严格区分。

**[打开中文大字原理演示]({{ '/interactive/2026-11-13-kv-cache-safety-map.html' | relative_url }})** · [知识关系图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})

**解决什么：** 多个请求共享 GPU KV Cache 时，错误的块映射可能悄悄污染别人的状态。**学到什么：** 用所有权、初始化标记和五个检查点定位错误，并比较 On-prem 与 Controlled Hybrid 的实现代价。

## 1. 来源与证据边界

核心论文：[KVGuard: A KV Cache Safety Checker for LLM Serving Systems](https://arxiv.org/abs/2611.06138)，Jonguk Cheong、Myungbin Hwang、Eulgyu Kim、Byoungyoung Lee，2026-11-04。作者在 vLLM 和 SGLang 中实现检查器，报告检测 29 个历史缺陷、8 个新发现；本库未独立复现，也未确认 KVGuard 作者提供可直接使用的公开代码仓库。[PagedAttention 原论文](https://arxiv.org/abs/2309.06180)、[vLLM](https://github.com/vllm-project/vllm)、[SGLang](https://github.com/sgl-project/sglang) 是前置材料。[Compute Sanitizer](https://docs.nvidia.com/compute-sanitizer/ComputeSanitizer/index.html) 用于比较 GPU 内存检查抽象。以下教学状态机和部署建议是本站独立工程抽象，不是论文官方架构或本站实测。

## 2. 为什么地址合法仍会越权

Transformer 解码缓存先前 Token 的 Key 和 Value。忽略对齐时，KV 容量约为 **M = 2 × Layers × KVHeads × HeadDim × Tokens × BytesPerElement**。PagedAttention 把一个 cudaMalloc 大区域分成多个软件物理块 PB，并用 BlockTable[request, logicalBlock] 定位。GPU Kernel 最终访问地址为 **KVBase + PBIndex × BlockBytes + EntryOffset**。普通 CUDA 地址检查只知道地址是否在大区域内，无法知道 PBIndex 属于哪个请求。例子：请求 A/B 共享只读前缀 PB0，B 本应把新 KV 写入私有 PB2，却因过期 Slot Mapping 写入 PB0。CUDA 地址仍合法，但 A 后续读取的 Prefix 已被污染，进程可能不崩溃。这是软件块级内存安全，而非普通模型幻觉。

## 3. Shadow Block 与形式化不变量

论文为每个物理块维护 Shadow Block：**per-request Permission**（谁可读、谁可写）与 **per-entry Initialization**（本生命周期内哪个 KV 条目已写入）。共享 Prefix 应允许多个请求读取，但不允许后续写入。块释放后旧请求授权应删除；重分配时清空初始化位。读安全契约：**ReadOK(r,p,e) = CanRead(r,p) AND Initialized(p,e)**；写安全契约：**WriteOK(r,p,e) = CanWrite(r,p)**。论文使用不复用的 Request ID 表示生命周期；若系统自行复用 ID，应额外使用 Generation/Epoch 防止 ABA，这属于本站推导。Reference Count 不能替代请求级权限，也不能表示逐条初始化。

## 4. C1–C5 五个检查点

**C1 CPU Alloc/Share/Free**：检查块是否已经分配、是否允许共享、是否仍被引用，定位 double-free 和 use-after-free。**C2 CPU Block Table**：检查请求逻辑块映射的物理块确实授权给该请求。**C3 CPU→GPU Block Table**：核对 GPU 将消费的表与已提交的 CPU 映射快照一致，发现异步调度造成的 stale mapping。**C4 GPU Block Table Lookup**：Kernel 查表时验证 Request Row 和 Logical Index 的合法范围。**C5 GPU KV Entry Access**：在读写路径验证请求权限；读前检查 Initialization，写后设置对应初始化位。CPU 检查不等于 GPU 检查；必须确保 Shadow 状态与 Kernel Launch 的顺序一致。

## 5. 异步传输、缓存与信任边界

Prefix Cache、CUDA Graph Padding、Overlap Scheduler、Speculative Decoding、CPU KV Offload 和 P/D Disaggregation 都会改变块生命周期。传输发送端必须在 DMA/Copy 完成前保留源块；接收端只能把实际写入的 Entry 标记为初始化。异步取消时，先释放再读取会产生 UAF；短传输若被标记为完整，则产生未初始化读取。可信控制面包括 Allocator、Committed Block Table 和授权检查器；不可信对象包括外部请求、未校验的 GPU 表和未完成的异步数据。KVGuard 不替代认证、加密、Prompt Injection 防护或 Agent Sandbox。日志不得包含真实用户 KV 内容或敏感 Token。

## 6. 论文实验与 Benchmark 局限

作者环境：**单张 H100 80GB、Xeon Platinum 8468（16 vCPU）、Ubuntu 24.04、CUDA 13.0、vLLM v0.32.0/FlashAttention 3、SGLang v0.5.22/FlashInfer 0.7.1**。模型包括 Llama 3.2 1B、Llama 3.1 8B、Qwen 2.5 14B、Qwen 3.5 4B；工作负载 ShareGPT、LongBench、MMLU。作者报告 29/29 历史缺陷被检测、另发现 8 项、测试集无误报。Qwen 2.5 14B TPOT 几何均值开销：vLLM **3.0%**、SGLang **7.4%**；Shadow GPU 内存为 KV Pool 的 **0.05–0.11%**。但 Llama 1B 高请求率 TPOT 约 **3.5–3.7×**，LongBench 长上下文可达 **7.55×/10.84×**。这些数字不能推广到其他 GPU、引擎、模型或负载。Compute Sanitizer 对照还缩小了 KV Pool 避免 OOM，检查语义也不同。论文定位开发/CI 调试，不是建议直接生产常开。

## 7. 30–60 分钟本地实验

用 Python 标准库模拟 Shadow Block，无需 GPU、闭源 API 或真实数据。先复制下方代码执行，再故意制造共享块写入、未初始化读取和旧请求访问；所有失败都应由断言捕获。随后加入 CPU/GPU Block Table 两份映射，注入 GPU 表延迟一轮，记录 C2/C3 的首次不一致；加入 pending_transfer 模拟异步取消，保证传输未完成前不可释放源块。固定随机种子生成 1000 个 alloc/share/read/write/free 序列，与独立 Reference Model 对照，记录最小失败轨迹。CPU Mock 的运行时间不能冒充 H100 TPOT。

```python
class Unsafe(Exception): pass
class Shadow:
    def __init__(self,n=4):
        self.perm={}; self.initialized=[False]*n
    def alloc(self,r):
        if self.perm: raise Unsafe("C1 allocated")
        self.perm={r:"rw"}; self.initialized=[False]*len(self.initialized)
    def share(self,owner,other):
        if owner not in self.perm: raise Unsafe("C1 no owner")
        self.perm[owner]="r"; self.perm[other]="r"
    def access(self,r,i,write=False):
        if not 0<=i<len(self.initialized): raise Unsafe("C4 OOB")
        if write:
            if self.perm.get(r)!="rw": raise Unsafe("C5 write permission")
            self.initialized[i]=True
        elif self.perm.get(r) not in ("r","rw") or not self.initialized[i]:
            raise Unsafe("C5 read permission/initialization")
    def free(self,r):
        if r not in self.perm: raise Unsafe("C1 double free")
        del self.perm[r]
b=Shadow(); b.alloc("A"); b.access("A",0,True)
b.share("A","B"); b.access("B",0)
for fn in (lambda:b.access("B",1,True),lambda:b.access("B",2)):
    try: fn(); raise AssertionError("missing violation")
    except Unsafe as e: print("detected",e)
b.free("A"); b.free("B"); b.alloc("C")
try: b.access("B",0); raise AssertionError("stale access")
except Unsafe: print("detected stale lifetime")
```

## 8. On-prem 与 Controlled Hybrid

| 维度 | On-prem / Self-hosted | Controlled Hybrid |
|---|---|---|
| 数据 | Prompt/KV/Shadow/Trace 留在本地授权域 | 仅批准的公开或脱敏任务允许出域；禁止默认复制真实 KV |
| GPU 与 Serving | 固定本地 vLLM/SGLang 版本，在测试分支插桩 | 分离受控测试 GPU Pool 和私有生产 Serving |
| 网络 | 离线依赖镜像、禁无约束出站 | 私有连接、出站允许名单、区域限制与审批 |
| 治理 | CI 无生产凭据，最小化故障 Trace | 数据分级、租户隔离、留存期限、审计 |
| 成本 | GPU 机会成本、研发适配和回归时间 | 租用 GPU、传输、镜像和调度成本 |
| 许可证 | 核查引擎/依赖许可证；不能假定 KVGuard 已开源 | 另审云服务条款、数据处理责任与供应链 |
| 迁移 | 改 Allocator、Block Table 和 Kernel Hook | 同样的代码适配，加上跨域安全与合规验证 |

无论哪条路径，KV Cache 都可能包含用户输入派生状态，不应被当作无敏感性缓存。

## 9. 深入复现路线与失败模式

阶段 A：CPU 模型检查和 Property-Based 随机序列；阶段 B：固定 vLLM/SGLang Commit，定位 Allocator、Prefix Cache、Block Table Commit、Abort、Kernel 和 Offload；阶段 C：测试分支实现 C1–C5 并逐个 Kernel Family 验证插桩覆盖；阶段 D：从论文公开 Fix PR 选缺陷，分别在修复前后重放；阶段 E：固定模型、Tokenizer、KV Pool、Batch、Context、CUDA Graph、请求率、Seed，测 TTFT/TPOT/p99、误报、显存和 CPU 同步开销。失败模式包括漏 Hook、Request ID 重用、Shadow 与真实状态竞态、过期 GPU 表、Ring Buffer 日志泛洪、P/D Transfer 提前释放、部分 Copy 错误标记完整。检测器自身也需要验证，不可当作完美 Oracle。

## 10. 求职系统设计题

**题一：设计 1000 并发请求的 KV Cache 隔离与调试机制。** 区分 CUDA 分配边界与软件块权限，解释 Prefix 共享、请求 ID/Epoch、Shadow Metadata、C1–C5、CPU/GPU 同步与开销。**题二：模型输出偶发变化，怎样区分 KV 污染与采样随机性？** 固定权重、Tokenizer、Seed、Serving Commit，比较单/多并发、Prefix Hit、Abort、插桩/无插桩；以不变量违例而非输出差异为根因证据。**题三：如何将 KV 检查纳入受监管企业 CI？** 回答可信测试数据、版本锁定、权限隔离、异常 Fail-Closed、故障回放、性能门槛与 Trace 最小化。

## 11. 三项结论与未来研究

1. **CUDA 地址合法不代表请求有权访问该 KV Block。** 请求所有权、生命周期和初始化状态必须独立检查。
2. **检测点要覆盖错误发生的边界。** C1–C3 保护分配与映射，C4–C5 保护 Kernel 实际访问。
3. **开发期安全检查与生产期性能需要分开决策。** 作者的大模型平均开销不能覆盖小模型和长上下文的最差情况。

未来研究：异步 Scheduler Snapshot 一致性、KV Transfer Ownership、Prefix Cache 多租户隔离、CUDA Graph 插桩覆盖、Shadow Metadata 的 GPU 同步成本。关联阅读：[Paged Experts]({{ '/notes/2026/11/2026-11-07-paged-experts/' | relative_url }}) 管理专家权重容量；[Agent 评测有效性]({{ '/notes/2026/11/2026-11-10-agent-evaluation-validity/' | relative_url }}) 解释怎样避免把环境故障误判为模型能力。

