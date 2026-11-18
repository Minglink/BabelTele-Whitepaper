# 巴别语 Agent (`babeltele-agent`)

> **全栈底层源码重构版（Bottom-Up Core & Minimalist Line UI）**  
> 将 **巴别语标准体系（`BT-Spec v1.0` V2）** 直接内置固化进底层核心引擎、Agent Loop、语义默克尔压缩、子智能体总线、文件系统落盘守卫与极简线条风格前端组件树（基于 MIT 开源基础设施 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 深度重构，**非外挂包装**）。

---

## 一、 `deepseek-flash` 真机在线实测提升（Verified Live API Metrics）

| 核心维度 | 原生基线 (`deepseek-flash`) | 巴别语 Agent V2 (`deepseek-flash`) | 实测增益 |
| :--- | :---: | :---: | :---: |
| **端到端代码生成耗时** | `35.71 s` | **`9.99 s`** | **提速 `3.58x`（耗时下降 `72.0%`）** |
| **内部推理词元 (`reasoning_tokens`)** | `5,193` | **`1,189`** | **推理开销下降 `77.1%`** |
| **单轮总计费词元 (`total_tokens`)** | `6,072` | **`1,711`** | **总词元下降 `71.8%`** |
| **人类口语输入脱水率** | `157 tok` | **`71 tok`** | **输入缩减 `55%`（锚点 `100%` 锁定）** |
| **`/compact` 上下文压缩体积** | `2,889 chars` | **`727 chars` (`[SMFT-T1]`)** | **检查点占用缩减 `74.8%`** |
| **多步工具循环 KV Cache 命中率** | — | **`99.5%`** (`39,680 / 39,876`) | **幂等脱水零缓存击穿** |

---

## 二、 核心底层重写清单（Where BabelTele Lives in Source）

| 层级 | 重写源码路径 | 内置机制 |
| :--- | :--- | :--- |
| **双平面极速内核 V2 & 全词法脱水器** | `packages/core/system-prompt/src/babeltele.ts`<br>`packages/core/system-prompt/src/index.ts` | 内置 `BABELTELE_DUAL_PLANE_KERNEL`（严控 `<think>` 微图谱推理、杜绝思考流二次默写代码冗余）、全词法脱水器（`+typed`、`+threadsafe`、`!ban:`）与 **Tier-1 硬锚点锁** |
| **Agent 主循环自动脱水（保热缓存）** | `packages/core/agent-loop/src/agent.ts` | 在 `ReactLoopAgent.buildRequest()` 底层内置 `WeakMap` 幂等消息投影，自动脱水口语输入并 100% 保持历史引用恒定 |
| **实时 `mtime` 指纹顶层 AST 骨架** | `packages/session/working-directory/src/index.ts` | 自动提取顶层类/函数符号生成 `[BT-Headers v2.0]` 骨架，文件写入/编辑瞬间自动失效刷新 |
| **`[SMFT-T1]` 压缩 & `#SubTask` 总线** | `packages/compaction/compaction-basic/src/summarizer.ts`<br>`packages/subagent/tool-subagent/src/index.ts` | `/compact` 原生输出 `[SMFT-T1]` 默克尔检查点；父子智能体默认以 `#SubTask` / `#SubReport` 并发协同 |
| **Plane-B 零污染门禁 & Windows 终端优化** | `packages/fs/tool-fs/src/write.ts` & `edit.ts`<br>`packages/shell/pwsh-local/src/index.ts` | 自动剥离多余 Markdown 围栏并硬拦截 `#BT` 符号污染；消除 PowerShell 原生 `stderr` 误报退出码 |
| **DeepSeek 极简细线条原生界面** | `packages/client/ui-primitives/src/FishLogo.tsx`<br>`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`<br>`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx` | 纯粹极简 `1.5px` 细线塔标与「巴别语 Agent」字标，无冗余装饰色块；输入框原生融入细线版「提纯 / 自动提纯」抽屉，思考流原生支持「中文透视」 |

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
