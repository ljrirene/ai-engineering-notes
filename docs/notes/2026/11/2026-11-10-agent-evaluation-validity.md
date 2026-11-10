---
layout: default
title: "Agent 评测：如何区分模型失败与环境故障"
date: 2026-11-10
track: cross-deployment
tags: [agent-evaluation, sandbox, reproducibility, ml-systems, benchmark]
permalink: /notes/2026/11/2026-11-10-agent-evaluation-validity/
---
# Agent 评测：如何区分模型失败与环境故障

> 研究日期：2026-11-10。结合 2026-11-06 Modal/Snorkel 客户案例与 Terminal-Bench/Harbor 公开工具，形成**独立工程抽象**，不是两家公司官方联合架构；供应商报告未经本站独立复现。

**[打开中文大字原理演示]({{ '/interactive/2026-11-10-agent-evaluation-validity-map.html' | relative_url }})** · [知识关系图]({{ '/knowledge-graph.html' | relative_url }}) · [Study QA]({{ '/study-qa/' | relative_url }})

**解决什么：** Agent 未完成任务，不一定是模型能力不足，也可能是 Sandbox 缺依赖、OOM 或评分脚本有误。**学到什么：** 如何固定任务/环境/模型/评分器版本，独立记录无效运行，才比较得出可信的模型能力。

## 1. 一手来源与证据边界

- [Modal / Snorkel：How Snorkel runs realistic agent simulations](https://modal.com/blog/how-snorkel-runs-realistic-agent-simulations-with-modal)，**2026-11-06**。供应商客户案例报告每月数百万次模拟，峰值每小时数万个 Sandbox；采用 CPU/内存 bursting 后，客户负责人称 Sandbox 账单节省约 **20%**，目前约 **10–15%** Sandbox 采用该能力。无公开原始账单、逐任务资源曲线和复现实验，**不能将 20% 当成通用收益**。
- [Terminal-Bench / Harbor 官方任务仓库](https://github.com/harbor-framework/terminal-bench)，可核查任务、Oracle、多次执行建议；[Terminal-Bench 2.0](https://github.com/harbor-framework/terminal-bench-2) 供理解任务/测试/环境组合，版本不可混用。
- [Snorkel Terminal-Bench 2.0 方法说明](https://snorkel.ai/leaderboard/terminal-bench-2-0/)，**2025-11-07**，介绍终态测试、容器任务、任务可解性及 95% 区间；是基础资料而非当周新发布。
- [Terminal-Bench 论文](https://arxiv.org/abs/2601.11868)，**2026-01**，评测框架基础；[Harbor 开源框架](https://github.com/harbor-framework/harbor)，可供进一步复现。
- [Modal Legora Agent Eval 案例](https://modal.com/blog)，**2026-10-19**，强调独立 Sandbox 与代码版本绑定。属于厂商案例而非独立实验。

**证据等级：** 任务格式/代码/论文为可复查一手资料；Snorkel 规模与成本为客户/厂商自报；下文公式、系统设计和模拟均为本站独立推导。没有取得私有评测轨迹或原始成本数据。

## 2. 第一性原理：观察到的失败是混合变量

考虑任务 `i`：`C_i` 表示 Agent 有能力完成；`E_i` 表示执行环境有效；`V_i` 表示评分器正确。观测到的成功事件 `Y_i` 不必等于 `C_i`：

\[
P(Y=1)=P(C\land E\land V)+P(Y=1,\neg(C\land E\land V)).
\]

第二项可包含评分误放、答案泄漏等。该式只是事件划分，**不假设独立**。一次 OOM 或 Sandbox 启动失败不应直接记为模型的 valid_fail。

定义：
\[
r_{valid}=\frac{N_{valid}}{N_{all}},\quad
p_{pass|valid}=\frac{N_{valid\_pass}}{N_{valid}},\quad
C_{valid}=\frac{C_{inference}+C_{sandbox}+C_{storage}+C_{retry}}{N_{valid}}.
\]

这三个数分别测评测基础设施可靠性、有效运行上的完成率和每次有效评测的成本。**注意选择偏差：** 若困难任务更容易 OOM，剔除 OOM 后的有效样本可能偏向简单题，因此同时按任务类型/资源档位报告无效率。

若 N 道题各跑 K 次，\(\hat p=(NK)^{-1}\sum_i\sum_jY_{ij}\) 只是微平均。重复同一道题的 K 次运行存在任务内相关性；应按任务聚类 Bootstrap 或报告逐任务结果，不能把 NK 当作完全独立的样本量。

## 3. 9 个组件与真实执行顺序

| 组件 | 输入 → 输出 | 责任、边界与失败模式 |
|---|---|---|
| Task Registry | task_id、版本 → 任务包 | 指令、参考答案、测试必须分权限；防止泄漏 |
| Environment Builder | 依赖锁定、镜像 digest → 环境 | 缺工具、架构漂移、不可启动 |
| Scheduler | 队列、配额 → 租约 | 幂等重试、背压、noisy neighbor、超时 |
| Sandbox | 工具、文件、CPU/RAM/GPU → 执行环境 | 隔离不可信命令，控制网络出口 |
| Model Endpoint | 模型版本、Prompt → Token | 模型/Tokenizer/量化版本和超时固定 |
| Agent Harness | 模型输出 → 工具动作与轨迹 | 工具参数验证；模型意图不是权限 |
| Verifier | 最终状态 → 结构化结果 | 可信域运行，Agent 不能改测试/Oracle |
| Evidence Store | Trace、镜像摘要、尝试记录 → 证据 | 保留所有失败尝试，脱敏与审计 |
| Analyzer | 有效性、得分、成本 → 报告 | 不能把 infra_failure 当能力失败 |

执行顺序：Registry 绑定任务版本 → Scheduler 获取资源租约 → Sandbox 启动并验证环境 → Agent Harness 调用固定版本本地模型和受限工具 → 封存终态 → 可信 Verifier 评分 → Analyzer 分组统计。重试必须保存原 run_id 和新 attempt_id，不能只保留最终成功记录。

**安全边界：** Agent 可读的任务材料和工具返回是低信任数据；可信评分器、Oracle、租约策略和内部凭据不得暴露给 Agent。对未知模型生成代码，单纯 Python subprocess、rootless 容器或 Prompt Guard 都不能替代经过安全评估的强隔离、网络出口和凭据控制。Verifier 的可信身份必须与被测 Agent 分离。

## 4. 为什么环境保真度会改变结论

测试 Python 修复需要正确的解释器、依赖和文件结构；测试 GPU 训练 Agent 则需要 GPU 驱动、框架与显存；测试基础设施 Agent 可能需要 Linux 内核和多服务网络。环境过度简化会造成虚假失败，但复制真实生产环境又会引入隐私与安全风险。应以合成任务、固定镜像、明确工具契约和受控故障注入达到**针对能力的必要保真度**，而不是复制生产客户数据。

**Oracle 校验：** 在发布新任务/镜像前多次运行参考解法，检测依赖漂移与评分不稳定；Oracle 通过只说明某条参考路径可解，不能证明所有合法解都被评分器接受。需要额外测试错误解不能通过、正确变体不被误拒绝。

## 5. Benchmark 的可比性与统计陷阱

Terminal-Bench 是终端任务基准，不代表金融业务授权、RAG 事实一致性或会议转写准确率。模型、Agent Scaffold、工具、Token/时间预算、任务集版本和评分器同时变化时，无法把成功率差异归因于模型。需做 A/A 验证、固定资源预算、按任务统计区间，并报告成功率、有效率、infra/OOM/timeout、Verifier 错误和成本。不能将供应商排行榜上的 Agent+Model 组合得分当成单一模型能力。

### 失败模式与检测

- **环境错误：** 缺依赖、OOM、GPU 不可见、Sandbox 启动失败；标记 invalid_infra，保留资源证据。
- **验证器错误：** 测试自身异常或把正确答案误判；标记 invalid_verifier，运行 Oracle 与负面测试。
- **权限错误：** 越权文件/网络请求；标记 policy_violation，不应靠模型自己解释授权。
- **模型错误：** 在有效环境与可信评分条件下没有完成任务；标记 valid_fail。
- **评测污染：** Oracle/测试泄漏、任务被训练记忆、Agent 修改评分器；隔离参考资料并记录任务版本。

## 6. 资源与成本：固定超配和弹性突发

Agent 等待推理时 CPU 空闲，运行 grep、编译或训练时资源突发。固定配置太小会 OOM 导致无效运行，太大则浪费。设基础内存 m0、峰值 m1、突发时长 tb、总时长 T、单价 r：
\[
C_{fixed}=r m_1 T,\quad C_{burst}\approx r[m_0(T-t_b)+m_1t_b].
\]
这是**简化成本模型**，未包含突发费率、调度容量和冷启动，不是 Modal 精确计费规则。即使弹性更省，也必须让 A/B 候选采用可比较的资源策略，否则性能差异混入系统差异。

## 7. On-prem / Self-hosted 与 Controlled Hybrid

| 维度 | On-prem | Controlled Hybrid |
|---|---|---|
| 数据边界 | 合成任务、Trace、模型与评分全在本地 | 仅获批公开/脱敏任务可出域；内部轨迹本地保留 |
| GPU/Serving | 本地开源模型 + vLLM/SGLang；Sandbox GPU 与推理 GPU 分配隔离 | 受控 GPU Endpoint 或获批 Sandbox；不默认使用闭源 API |
| 网络 | 默认拒绝外网，任务所需服务用本地 Mock | Private Network、Egress Gateway、区域/出口审查 |
| 执行安全 | 低风险固定脚本可用容器；未知代码需 KVM/MicroVM/独立主机 | 供应商租户隔离、镜像、凭据与日志保留需审计 |
| 治理 | RBAC、数据分类、审计、任务保留期 | 额外审查数据驻留、子处理方、合同、删除证明 |
| 成本/许可证 | 设备折旧、运维、镜像缓存；核查模型/任务/依赖许可证 | 计算、网络、存储、突发费率及供应商条款 |
| 迁移难度 | 先用合成任务与 SQLite Trace 小规模验证 | 保留 Task Manifest、Verifier 和 Trace Schema，替换 Runtime Adapter |

受限企业优先在本地以合成任务建立评测基础设施；不要因为云端 Sandbox 扩容方便就直接上传真实业务文件。

## 8. 30–60 分钟无闭源 API 实验

目标是证明评测系统能区分能力失败与环境失败。下面使用**可信的固定字符串**模拟 Agent 输出，既不运行模型，也不执行未知代码。只需 Python 标准库。

```python
import json, hashlib
tasks = [
    {"id":"correct","answer":4,"expected":4,"env":True},
    {"id":"wrong","answer":5,"expected":4,"env":True},
    {"id":"oom","answer":4,"expected":4,"env":False},
]
def run(t):
    digest=hashlib.sha256(json.dumps(t,sort_keys=True).encode()).hexdigest()[:12]
    if not t["env"]:
        return {"id":t["id"],"status":"invalid_infra","digest":digest}
    return {"id":t["id"],"status":
            "valid_pass" if t["answer"]==t["expected"] else "valid_fail",
            "digest":digest}
runs=[run(t) for t in tasks]
valid=[r for r in runs if r["status"].startswith("valid_")]
print(json.dumps({"runs":runs,"valid_run_rate":len(valid)/len(runs),
                  "pass_rate_valid":sum(r["status"]=="valid_pass" for r in valid)/len(valid)},
                 indent=2))
```

按代码逻辑**预期**：3 次中 2 次有效，有效运行通过率 1/2；若把 OOM 当模型失败，表面通过率为 1/3。这是教学预期，不冒充已跑出的 benchmark。扩展实验：增加 `attempt_id`、Verifier 异常和重试，要求报表保留每次尝试；模拟难题更容易 OOM，观察选择偏差。

## 9. 深入复现路径

1. 固定 [Harbor](https://github.com/harbor-framework/harbor) 与 [Terminal-Bench](https://github.com/harbor-framework/terminal-bench) 版本、任务集、镜像 digest、许可证和机器环境。
2. 先在少量公开任务上多次运行 Oracle，确认镜像可启动、工具可用、测试稳定；不要用 Oracle 通过率当模型得分。
3. 以本地开源模型 Serving 接入兼容 Harness，固定模型/Tokenizer/Agent Scaffold、Seed、工具和资源限制。
4. 对每题重复执行，记录完整 Trace、资源曲线、最终状态、Verifier 输出和所有 Attempt；按任务聚类计算置信区间。
5. 故障注入：OOM、缺依赖、网络拒绝、评分器异常、超时、GPU 不可见；逐类检查有效率、通过率、p95、重试和成本。
6. 若测试真实不可信代码，先完成强隔离、出站控制、凭据代理和安全评估。不要把教学 Mock 直接升级为生产沙箱。

## 10. 求职系统设计题

**Design a reproducible evaluation platform for 10,000 concurrent CPU/GPU agent tasks.** 解释 Registry、Scheduler、Sandbox、Harness、Verifier、Evidence Store 的职责，资源租约、幂等重试、GPU 池、镜像缓存、任务版本、网络出口、评分器隔离、成本归因和任务聚类置信区间。追问：候选模型通过率提高 3%，但 OOM 下降且 Harness 同时升级，如何证明是模型改进？答案必须包含同预算对照、A/A、单变量变更和分层统计。

**Design an offline regulated-enterprise agent eval.** 使用合成数据和本地模型；Verifier 在可信域；Agent 工具执行不能读内部凭据；负面测试涵盖权限拒绝、错误恢复、资源不足和超时。

## 11. 三项结论与未来研究

1. **先验证环境有效，再评估模型能力。** 无效运行与有效失败必须分开。
2. **可复现要固定任务、环境、模型、Harness、Verifier 与资源预算。** 单一通过率不够。
3. **优化每次有效评测的总成本，而不是单次容器报价。** 弹性资源收益需扣除重试、尾延迟和公平性影响。

未来研究：Verifier Reward Hacking、随机长任务的层级 Bootstrap、GPU Sandbox 与模型 Serving 的资源争用、On-prem 与 Hybrid 环境等价性证明。

**相关研究：** [SPACE 执行隔离]({{ '/notes/2026/10/2026-10-31-hybrid-space/' | relative_url }}) · [BrowseSafe++ 安全评测]({{ '/notes/2026/11/2026-11-04-onprem-prompt-injection/' | relative_url }})。

