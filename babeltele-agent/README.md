# 巴别语 Agent (`babeltele-agent`)

> **全栈底层源码重构版 · V6 中英双语全自动转译 · 纯 `#BT` 巴别语思维链 · 零拷贝多级代理引擎**  
> 真正实现 **「人类用汉语或英语自然输入 → 底层全自动转译为巴别语（`#Task[@out=...]`）→ `100%` 纯 `#BT` 巴别语思维链与多级代理通信 → 严格按用户原输入语种输出交付结果（代码落盘 `100%` 原生纯净）」** 的硅基闭环架构（基于 MIT 开源基础设施 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 深度重构，**非外挂包装**）。

---

## 一、 核心四段式硅基闭环工作流（Core Four-Stage Silicon Pipeline）

1. **Stage 1 · 人类自然输入层（汉语 / English 零门槛直输）**：用户直接输入普通中文或英文口语需求，界面对话气泡保持自然母语阅读体验。
2. **Stage 2 · 底层全自动对称转译（`ZH/EN → #Task[@out=zh-CN|en-US]`）**：`ReactLoopAgent.buildRequest()` 自动识别输入语种（`detectUserLanguage`），将冗长中英文同步坍缩为同构高密度巴别语指令（例如 `183 tok` 汉语与 `142 tok` 英语收敛至同一套 `84 tok` `#Task` 图谱，Tier-1 锚点 `100%` 锁定），并烙印不可篡改的 `@out=zh-CN` / `@out=en-US` 交付语种锁。
3. **Stage 3 · 纯 `#BT` 巴别语思维链与契约先行多级总线（`100%` Symbolic CoT + `#BT-Bus`）**：模型内部思考（`thinking`）采用 `#BT @obs(...) => ...` 极简符号微图谱（单步思考可压缩至 **51 字符**，较原生英文/中文长篇独白缩减 **`85.9% ~ 99.8%`**）；多子代理通过 `#Contract` + `#SubTask` + `#SubReport` 零拷贝并发协同。
4. **Stage 4 · 原输入语种精准交付与纯净代码门禁**：中文提问强制 `100%` 自然简体中文交付，英文提问强制 `100%` 自然英文交付（`AssistantMarkdown` 双重剥离保护确保人类气泡零 `#BT` 符号泄露），磁盘源码经实时 AST 预检确保 `100%` 原生纯净。

---

## 二、 `deepseek-flash` 真机在线实测提升（Verified Live API Metrics）

### 1. 中英双语闭环工程交付实测（汉语输入 & 英语输入 → 自动转译 → 纯 `#BT` 思考 → 原语种交付 + 单测全通过）

同一工程任务（编写线程安全令牌桶限流器 `limiter.py` + `>= 12` 项边界/异常单测 `test_limiter.py` + 执行 `python -m unittest -v` 全通过）分别使用 **自然汉语** 与 **自然英语** 在 `deepseek-official/deepseek-flash` 真机并发盲测：

| 评测通道与指标 | 原生基线 (`BABELTELE_DISABLED=1`) | **巴别语 Agent V6 (`BABELTELE_DISABLED=0`)** | 实测增益 |
| :--- | :---: | :---: | :---: |
| **🇨🇳 汉语输入 · 端到端耗时 (`wallMs`)** | `132.88 s`（`8` 步思考） | **`43.10 s`（`3` 次工具一步到位）** | **提速 `3.08x`（耗时下降 `-67.6%`）** |
| **🇨🇳 汉语输入 · 思维链长度 (`totalThinkChars`)** | `27,711 chars`（冗长散文独白） | **`51 chars`（纯 `#BT @obs(...) => @reply(zh-CN)`）** | **思维链冗余暴降 `-99.8%`** |
| **🇨🇳 汉语输入 · 生成词元 / 累计上下文** | `18,637 out` / `136,218 ctx` | **`3,509 out` / `23,974 ctx`**（`20/20` 单测通过 · 纯中文交付） | **输出下降 `-81.2%` · 上下文下降 `-82.4%`** |
| **🇬🇧 英语输入 · 端到端耗时 (`wallMs`)** | `175.92 s`（`10` 步思考） | **`74.47 s`** | **提速 `2.36x`（耗时下降 `-57.7%`）** |
| **🇬🇧 英语输入 · 思维链长度 (`totalThinkChars`)** | `33,601 chars` | **`4,745 chars`** | **思维链缩减 `-85.9%`（缩小 `7.08x`）** |
| **🇬🇧 英语输入 · 计费总词元 (`billedTokens`)** | `36,349 tok` (`24,697 out`) | **`9,681 tok` (`5,806 out` · `19/19` 单测通过 · `100%` 纯英文交付)** | **计费词元直降 `-73.4%`（输出 `-76.5%`）** |

### 2. 多级并行子智能体协同交付实测（`L0` 协调器 + 双 `L1` 并行研发子代理 + 综合单测全通过）

| 核心评测维度 | 原生多代理基线 (`BABELTELE_DISABLED=1`) | **巴别语 Agent V6 (`#Contract` + `#BT-Bus`)** | 真机实测增益 |
| :--- | :---: | :---: | :---: |
| **多代理端到端总耗时 (`wallMs`)** | `352.23 s`（近 6 分钟） | **`81.96 s`（1 分 21 秒）** | **提速 `4.30x`（净省 `270.27 s` / `-76.7%`）** |
| **主控累计上下文吞吐 (`input + cacheRead`)** | `363,585 tok`（`104` 事件） | **`60,506 tok`（`34` 事件）** | **上下文消耗骤降 `-83.4%`（缩小 `6.01x`）** |
| **实际计费总词元 (`input + output`)** | `26,144 tok` | **`12,932 tok`**（缓存命中率 `94.1%`） | **API 计费词元直降 `-50.5%`** |
| **工具调用链路与返工次数** | `21` 次（`4` 次回读 + **`5` 轮 `edit` 返工**） | **`7` 次（`0` 次回读子代理文件 · `0` 次 `edit` 返工）** | **一次联调 `100%` 命中 · `32/32` 单测一次全过** |

---

## 三、 核心底层重写架构清单

| 架构模块 | 重写源码路径 | 内置机制 |
| :--- | :--- | :--- |
| **中英对称巴别语编译器 & 纯 `#BT` 思维链内核** | `packages/core/system-prompt/src/babeltele.ts`<br>`packages/core/system-prompt/src/index.ts` | 内置中英双语 `OMNILINGUAL_REWRITES`（自动识别 `zh-CN` / `en-US` 并烙印 `@out=` 语种锁）、`[BT-SchemaCompiler]` 全局底座瘦身（`5,513 tok`，低于原生基线 `16%`）及强制纯 `#BT` 符号思维链法则 |
| **Agent Loop 全自动透明转译 & 双向折叠** | `packages/core/agent-loop/src/agent.ts` | 在 `buildRequest()` 底层利用 `WeakMap` 对中英用户输入做全自动无感 `#Task[@out=...]` 转译与 `[BT-ToolOut]` 单测日志折叠（`-83.9%`），100% 保持服务端 KV Cache 命中 |
| **契约先行多级代理总线 (`L0→L1→L2→L3`)** | `packages/subagent/subagent/src/*`<br>`packages/subagent/tool-subagent/src/index.ts` | 开放 `maxDepth=3` 多级递归代理树，前置锁定 `#Contract` 接口签名，自动编译 `#SubTask` 与蒸馏 `#SubReport[#API]` |
| **跨代理共享 `Symbol@Line` 图谱 & 实时 AST 门禁** | `packages/session/working-directory/src/index.ts`<br>`packages/fs/tool-fs/src/write.ts` & `edit.ts` | 进程级共享 `mtime` 缓存输出 `@file(L=n):[Sym@line]` 精确行号坐标；落盘瞬间 `<30ms` 执行 `ast.parse` 语法预检与 `#BT` 纯净门禁 |
| **DeepSeek 极简细线条双语交互界面** | `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`<br>`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx`<br>`packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx` | 对话气泡保留用户自然中英文，抽屉实时透视 `ZH→BT` / `EN→BT` 词元节省与交付语种锁定；思考流标注 `BT-CoT · 纯巴别语思维链` 并支持一键中文透视，主回复通道双重净化零协议泄露 |

---

## 四、 快速启动

- **Windows 一键启动**：双击 **`启动巴别语Agent.bat`**（默认监听 `http://127.0.0.1:3720`）。
- **命令行启动**：
  ```bash
  cd babeltele-agent
  pnpm install --ignore-scripts=false
  pnpm run build:babeltele   # 首次从源码克隆时执行
  DSH_HOME=./.dsh-home pnpm run web
  ```
