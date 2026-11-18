# 巴别语 Agent (`babeltele-agent`)

> **全栈底层源码重构版 · V5 契约先行与零拷贝多级代理硅基引擎（Bottom-Up Core & Minimalist Line UI）**  
> 围绕 **巴别语标准体系（`BT-Spec v1.0` · V5）** 全栈重构底层核心引擎：内置 **契约先行多级代理总线（`#Contract` + `#BT-Bus` `L0→L1→L2→L3`）**、**全局工具契约编译器（`[BT-SchemaCompiler]`）**、**跨代理共享 `Symbol@Line` 符号坐标图谱（`[BT-Headers v4.0]`）**、**双向工具回执折叠（`[BT-ToolOut]`）**、**落盘实时 AST 语法预检门禁（`[BT-Diag]`）** 与 **DeepSeek 极简细线条原生界面**（基于 MIT 开源基础设施 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 深度重构，**非外挂包装**）。

---

## 一、 `deepseek-flash` 真机在线实测提升（Verified Live API Metrics）

### 1. 多级并行子智能体协同交付实测（`L0` 协调器 + 双 `L1` 并行研发子代理 + 综合单测全通过）

**实测任务**：同一段中文复杂多模块需求——并行派出两个子智能体分别独立实现线程安全 `LRUTTLCache` 缓存引擎 `cache_engine.py` 与双模限流网关 `rate_gateway.py`（`SlidingWindowLimiter` + `TokenBucketLimiter`，均带完整类型注解、零第三方依赖），再编写综合单测套件 `test_platform.py`（`>= 16` 个边界/并发/淘汰/异常用例）并执行 `python -m unittest -v` 全部通过：

| 核心评测维度 | 原生多代理基线 (`BABELTELE_DISABLED=1`) | **巴别语 Agent V5 (`#Contract` + `#BT-Bus`)** | 真机实测增益 |
| :--- | :---: | :---: | :---: |
| **多代理端到端总耗时 (`wallMs`)** | `352.23 s`（近 6 分钟） | **`81.96 s`（1 分 21 秒）** | **提速 `4.30x`（净省 `270.27 s` / `-76.7%`）** |
| **主控累计上下文吞吐 (`input + cacheRead`)** | `363,585 tok`（`104` 事件） | **`60,506 tok`（`34` 事件）** | **上下文消耗骤降 `-83.4%`（缩小 `6.01x`）** |
| **计费总词元 (`input + output`)** | `26,144 tok` | **`12,932 tok`**（缓存命中率 `94.1%`） | **API 计费词元直降 `-50.5%`** |
| **未命中缓存新增输入 (`inputTokens`)** | `11,585 tok` | **`3,546 tok`** | **新增输入词元下降 `-69.4%`** |
| **工具调用步数与联调返工次数** | `21` 次调用（含 `4` 次回读 + **`5` 轮 `edit` 返工**） | **`7` 次调用（`0` 次回读子代理文件 · `0` 次 `edit` 返工）** | **一次联调 `100%` 命中 · 工具调用减少 `-66.7%`** |
| **单元测试通过率与源码纯度** | `26 / 26` 通过（`706` 行） | **`32 / 32` 一次全通过（`715` 行 · AST/纯度 `100%`）** | **单测覆盖提升 `+23.1%` · 零协议符号污染** |

### 2. 单代理工程交付与子系统微观基准（`deepseek-flash` 真机实测）

| 测试场景 | 原生基线 | **巴别语 Agent V5** | 实测增益 |
| :--- | :---: | :---: | :---: |
| **单轮首包底座词元开销（System + Tools 前缀）** | `6,560 tok` | **`5,513 tok`**（含完整巴别语双平面与多级总线内核） | **全局底座反降 `-16.0%`（较 V3 下降 `-22.3%`）** |
| **日常问候零工具快路径（`#Chat[fast]`）** | `400 output tok` | **`179 output tok`** | **冗余思考与输出下降 `-55.3%`** |
| **单代理多文件实现 + 自动化单测全链路** | `101.55 s` (`155,776` 上下文 tok) | **`64.08 s` (`98,606` 上下文 tok · `29/29` 通过)** | **提速 `1.58x`（生成开销 `-35.3%`）** |
| **单轮算法实现端到端耗时（CoT 微图谱纪律）** | `35.71 s` (`6,072 tok`) | **`9.99 s` (`1,711 tok`)** | **提速 `3.58x`（总词元下降 `-71.8%`）** |
| **`[BT-ToolOut]` 工具单测输出双向折叠** | `1,718 chars` | **`277 chars` (`[BT-TestPass]`)** | **通过日志噪音缩减 `-83.9%`（报错 `100%` 保留）** |
| **`/compact` 长程语义检查点（`[SMFT-T1]`）** | `2,889 chars` | **`727 chars`** | **检查点占用缩减 `-74.8%`** |

---

## 二、 六大核心架构设计（Why BabelTele Agent V5 Is Fast, Low-Token & Accurate）

| 架构支柱 | 重写源码路径 | 底层机制解析 |
| :--- | :--- | :--- |
| **1. 契约先行 · 零拷贝多级代理总线 (`#Contract` + `#BT-Bus` `L0→L1→L2→L3`)** | `packages/subagent/subagent/src/index.ts`<br>`packages/subagent/subagent/src/continuation-messages.ts`<br>`packages/subagent/tool-subagent/src/index.ts` | 原生开放 **3 层递归代理深度（`maxDepth=3`，并发池 `12`）**；主控 `L0` 在并发派发前强制锁定 `#Contract` 精确类/构造函数/方法签名并自动脱水为 `#SubTask[L1/3\|spawn]`；子代理强制遵循精炼代码预算并返回含 `#API` 签名的 `<=8` 行 `#SubReport`，使父代理 **无需回读子代理源码即可零拷贝一次通过集成测试** |
| **2. 全局协议与工具契约瘦身编译器 (`[BT-SchemaCompiler]`)** | `packages/core/system-prompt/src/babeltele.ts`<br>`packages/core/system-prompt/src/index.ts` | 在 `SystemPrompt.assemble()` 装配层对 35+ 工具描述、参数说明与冗余系统段落做无损语义压缩，将全局底座压降至 `5,513 tok`（低于原生无巴别语基线），且跨 `L0~L3` 保持 **100% 相同前缀以共享服务端 KV Cache** |
| **3. 跨代理共享 `Symbol@Line` 仓库图谱 (`[BT-Headers v4.0]`)** | `packages/session/working-directory/src/index.ts`<br>`packages/core/system-prompt/src/babeltele.ts` | 基于进程级共享 `mtime` 缓存提取顶层类/函数及精确行号（如 `@limiter.py(L=184):[TokenBucket@18,PriorityQueue@96]`）；空白目录显式标记 `@cwd=(empty)`，让主控与所有子代理零盲探直跳目标行 |
| **4. 落盘实时闭环 AST 语法预检门禁 (`[BT-Diag]`)** | `packages/fs/tool-fs/src/write.ts` & `edit.ts`<br>`packages/core/system-prompt/src/babeltele.ts` | 每次 `write`/`edit` 落盘瞬间执行 `<30ms` 无副作用语法树校验（Python `ast.parse`、JSON、`node --check`、冲突标记检测）与 `#BT` 纯净度门禁，当场回传 `[L=n, AST:ok]` 或精确到行列的 `[BT-Diag SYNTAX_ERROR @line:col]` |
| **5. Agent Loop 幂等双向投影 (`WeakMap` 保热缓存)** | `packages/core/agent-loop/src/agent.ts` | 在 `ReactLoopAgent.buildRequest()` 内通过 `WeakMap` 一次性完成 `#Chat[fast]` 问候快路径标记、`BT-L2/L3` 口语脱水（105+ 工程原语 + Tier-1 锚点硬锁）与 `[BT-ToolOut]` 日志折叠，历史消息引用永不突变，实测 KV Cache 命中率达 **`94.1% ~ 99.5%`** |
| **6. DeepSeek 极简细线条原生界面** | `packages/client/ui-primitives/src/FishLogo.tsx`<br>`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`<br>`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx` | 纯粹极简 `1.5px` 细线塔标与「巴别语 Agent」字标；输入框内置细线版 `BT-L2 · 均衡 / BT-L3 · 骨架` 切换、锚点计数与 `AST 预检 · 纯净守卫` 状态条，思考流支持一键「中文透视」 |

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
