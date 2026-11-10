---
layout: default
title: "ReplaySSM：缓存 SSM 输入，而不是每步写状态"
date: 2026-10-31
track: onprem
tags: [research, architecture, systems]
permalink: /notes/2026/10/2026-10-31-onprem-replayssm/
---
# ReplaySSM：缓存 SSM 输入，而不是每步写状态

> **2026-10-31 的历史精读专题（2026-11-04 重新整理）** · 本文根据此前实际讨论的选题与公开一手资料重新组织，不声称逐字还原当天聊天原文。性能结果属于原文作者报告，未经本站独立复现。

**原理对照：** [比较常见做法和研究方案]({{ '/interactive/2026-10-31-replayssm-map.html' | relative_url }})。先看具体例子，再点击步骤了解机制、收益和限制。




## 筛选依据与原始资料
- [ReplaySSM: Cache SSM Inputs, Not State](https://arxiv.org/abs/2610.13778) — Ze-Wei Liou 等，2026-10-09 原始 arXiv 论文。
- [作者开源实现 Johnny-Liou/ReplaySSM](https://github.com/Johnny-Liou/ReplaySSM) — vLLM、Mamba-2、Gated DeltaNet 相关实现/适配。部署前核对分支和许可证。

**为何进入 10 月 31 日榜单**：这是一项具有机制解释和明确性能结果的推理引擎优化，不只是模型排行榜：优化对象从 LLM 计算切换到循环状态在 HBM 中的写回成本。对 ML Systems/Inference Engineer 的面试价值高于一般模型发布消息。

## First Principles：状态 I/O 为什么会比计算贵？
对 recurrent SSM，可抽象为 h_t = F(h_(t-1),u_t)，y_t = G(h_t)。传统实现每个 token 均读取、计算、写入完整的状态 h_t。若每请求状态大小为 S bytes、batch 为 B、生成 T tokens，忽略缓存与 kernel 融合时状态读写主导的近似流量是 2BST；这只是教学上界式的模型，不代表设备实测。

ReplaySSM 将状态表示为一个周期更新的 checkpoint C 及尚未合并的近期输入 u_(k+1..t)：
- 输出计算可由 C 与近期输入 replay/组合，避免每一步将巨大状态落盘 HBM；
- 窗口边界将输入批量折叠入 C；
- Speculative decoding 拒绝 token 后回滚 buffer 指针，而不是恢复多个完整 recurrent state；
- 低精度输出计算路径与高精度 recurrent checkpoint 路径可分离，减少量化误差向后传播。

论文在 batch size 256 的四种混合模型上报告 vLLM 相比调优基线标准解码 1.20–1.47× 提升，120B 级两模型 speculative decoding 吞吐约 1.8×；这些是论文指定设置的数据，不能线性外推到 RTX 单卡。

## 设计取舍与失败模式
- 更长 replay window 减少状态写回，却可能增加重放计算和输入 buffer 成本；最优窗口需按模型状态结构、batch、序列长度测量。
- Kernel 的输出应与原始模型在误差容忍范围内一致；量化 state 的低精度版本不能反向污染高精度 recurrent update。
- 只有 Mamba/SSM/GDN 等依赖 recurrent state 的路径明显受益；纯 Transformer KV Cache 不可直接照搬。
- Prefix caching 与 speculative rollback 的状态一致性检查比跑通单个 sample 更关键。

## On-prem 与 Controlled Hybrid
| 维度 | On-prem | Controlled Hybrid |
|---|---|---|
| 适用性 | vLLM 等推理引擎合适模型上的 kernel/状态优化 | 云托管 SSM Serving 可在流量大时进一步压榨 HBM |
| 内存 | 关注 batch × recurrent state × 缓冲窗口 | 同时关注跨服务权重/状态迁移成本 |
| 数据边界 | token 与 state 全留内网 | 仅允许批准的请求、模型与数据出域 |
| 风险 | 自定义 kernel 版本兼容、回滚 | 服务升级/跨版本 state ABI 不兼容 |

## 30–60 分钟可复现实验（不依赖云 API）
写一个 NumPy toy recurrence：逐步更新 h；每隔 K 步固化一次 checkpoint，其间保存输入；验证 replay 输出与 eager 输出在 float64 下几乎相同。分别记录每生成 token 的“完整状态写回次数”和 replay 运算次数，绘制 K={1,4,8,16,32} 的权衡曲线。**注意 toy 不能证明真实 GPU 加速。**

## 求职与知识沉淀
面试问题：Explain why a recurrent model can be bandwidth-bound during decode; design rollback for speculative decoding without copying an entire state.核心：①减少 HBM I/O 常比减少 FLOPs 更有效；②状态表示能决定回滚复杂度；③精度正确性与吞吐要一起测。

**未覆盖**：没有本地 96GB GPU Benchmark，也没有独立复现实验结果；候选排名依据是当期选题主题，非能追溯的完整搜索清单。


