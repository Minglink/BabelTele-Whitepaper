# 巴别语 Agent (`babeltele-agent`)

> **全栈底层源码重构版 · V3 零盲探与双向压缩引擎（Bottom-Up Core & Minimalist Line UI）**  
> 将 **巴别语标准体系（`BT-Spec v1.0` · V3）** 直接内置固化进底层核心引擎、Agent Loop、双向工具输出折叠、语义默克尔压缩、子智能体总线、文件系统落盘守卫与极简细线条前端组件树（基于 MIT 开源基础设施 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 深度重构，**非外挂包装**）。

---

## 一、 `deepseek-flash` 真机在线实测提升（Verified Live API Metrics）

### 1. 全链路多步 Agent 工程交付实测（从空白目录编写双模块 + 执行自动化单测全通过）

测试任务：同一段冗长口语化中文工程需求（创建线程安全 `TokenBucket` + `PriorityTaskQueue` 模块 `token_limiter.py`、编写边界/并发/异常单测 `test_token_limiter.py`，并调用命令行执行 `python -m unittest -v` 全量通过），在 `deepseek-official/deepseek-flash` 真机并发盲测：

| 评测维度 | 原生基线 Agent (`BABELTELE_DISABLED=1`) | 巴别语 Agent V3 (`BABELTELE_DISABLED=0`) | 实测增益 |
| :--- | :---: | :---: | :---: |
| **多步全链路总耗时 (`wallMs`)** | `101.55 s` | **`64.08 s`** | **提速 `1.58x`（节省 `37.47 s` / `-36.9%`）** |
| **模型生成与推理词元 (`outputTokens`)** | `15,723` | **`10,174`** | **自回归生成开销下降 `35.3%`** |
| **累计上下文窗口读取 (`input + cacheRead`)** | `155,776 tok` | **`98,606 tok`** | **多步上下文吞吐缩减 `36.7%`** |
| **单元测试覆盖与源码纯度** | `22 / 22` 通过 (`614` 行) | **`29 / 29` 通过 (`674` 行 · `100%` 纯净)** | **单测覆盖提升 `+31.8%` · 零协议污染** |

### 2. 分项子系统微观基准（`deepseek-flash` 真机实测）

| 子系统维度 | 原生基线 | 巴别语 Agent V3 | 实测增益 |
| :--- | :---: | :---: | :---: |
| **单轮算法实现端到端耗时（CoT 微图谱纪律）** | `35.71 s` (`6,072 tok`) | **`9.99 s` (`1,711 tok`)** | **提速 `3.58x`（词元下降 `71.8%`）** |
| **日常问候快路径（`#Chat[fast]` 零工具免探索）** | `381 output tok` (`10.20 s`) | **`176 output tok` (`8.99 s`)** | **冗余思考与输出下降 `53.8%`** |
| **全语种工程指令脱水（`BT-L2` / `BT-L3`）** | `258 tok` | **`129 tok` (`L2`) / `125 tok` (`L3`)** | **缩减 `50.0% ~ 51.6%`（`10/10` 锚点硬锁）** |
| **`[BT-ToolOut]` 工具输出双向折叠（16 项单测日志）** | `1,718 chars` | **`277 chars` (`[BT-TestPass]`)** | **通过日志噪音缩减 `83.9%`（报错 `100%` 保留）** |
| **`/compact` 上下文压缩检查点（`[SMFT-T1]`）** | `2,889 chars` | **`727 chars`** | **检查点占用缩减 `74.8%`** |

---

## 二、 核心底层重写清单（Where BabelTele V3 Lives in Source）

| 层级 | 重写源码路径 | 内置机制 |
| :--- | :--- | :--- |
| **V3 全语种语义坍缩与双平面极速内核** | `packages/core/system-prompt/src/babeltele.ts`<br>`packages/core/system-prompt/src/index.ts` | 内置 **85+ 工程原语全语种坍缩表**（`@cwd`、`impl`、`+typed`、`+threadsafe`、`+stdlib_only`、`utest`、`edge_cases`、`=>pass` 等）、**`BT-L2 / BT-L3` 双档编译器**、**Tier-1 硬锚点锁**，以及强制并行批处理工具调用与 `<=8` 行 `#BT` 微图谱推理的 V3 内核 |
| **Agent 主循环双向脱水与问候快路径** | `packages/core/agent-loop/src/agent.ts` | 在 `ReactLoopAgent.buildRequest()` 内置 `WeakMap` 幂等双向投影：(1) `#Chat[fast]` 问候零工具快路径；(2) 用户输入自动脱水；(3) `[BT-ToolOut]` 自动折叠连续通过测试日志并 100% 保留异常堆栈，全程零破坏服务端 KV Cache |
| **零盲探 `[BT-Headers v3.0]` 工作区骨架** | `packages/session/working-directory/src/index.ts` | 基于 `mtime` 指纹提取顶层类/函数 AST 符号；**对空白目录显式注入 `@cwd=(empty_directory, 0 files)`**，彻底消除 Agent 第 1 步盲调 `glob`/`ls` 探路的整轮空耗 |
| **`[SMFT-T1]` 压缩 & `#SubTask` 总线** | `packages/compaction/compaction-basic/src/summarizer.ts`<br>`packages/subagent/tool-subagent/src/index.ts` | `/compact` 原生输出 `[SMFT-T1]` 默克尔检查点；父子智能体默认以 `#SubTask` / `#SubReport` 并发协同 |
| **Plane-B 零污染门禁 & Windows 终端优化** | `packages/fs/tool-fs/src/write.ts` & `edit.ts`<br>`packages/shell/pwsh-local/src/index.ts` | 自动剥离多余 Markdown 围栏并硬拦截 `#BT` 符号污染；消除 PowerShell 原生 `stderr` 误报退出码 |
| **DeepSeek 极简细线条原生界面** | `packages/client/ui-primitives/src/FishLogo.tsx`<br>`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`<br>`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx` | 纯粹极简 `1.5px` 细线塔标与「巴别语 Agent」字标，无冗余装饰色块；输入框原生融入细线版 **`BT-L2 · 均衡 / BT-L3 · 骨架`** 一键切换抽屉与自动提纯，思考流原生支持「中文透视」 |

---

## 三、 快速启动

- **Windows 一键启动**：双击 **`启动巴别语Agent.bat`**（默认监听 `http://127.0.0.1:3720`）。
- **命令行启动**：
  ```bash
  cd babeltele-agent
  pnpm install --ignore-scripts=false
  pnpm run build:babeltele   # 首次从源码克隆时执行
  DSH_HOME=./.dsh-home pnpm run web
  ```
