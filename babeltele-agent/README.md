# 🗼 BabelTele · 巴别语超级 Agent (`babeltele-agent`)

> **全栈底层源码重构版（Bottom-Up Core & UI Refactoring）**  
> 将 **巴别语标准体系（`BT-Spec v1.0`）** 直接内置固化进底层核心引擎、Agent Loop、语义默克尔压缩、子智能体总线、文件系统落盘守卫与前端原生组件树（基于 MIT 开源基础设施 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 深度重构，**非外挂包装**）。

---

## ⚡ 一、核心底层重写清单（Where BabelTele Lives in Source）

| 层级 | 重写源码路径 | 内置巴别语核心机制 |
| :--- | :--- | :--- |
| **系统提示词与双平面协议引擎** | `packages/core/system-prompt/src/babeltele.ts`<br>`packages/core/system-prompt/src/index.ts` | 原生内置 `BABELTELE_DUAL_PLANE_KERNEL`：离线 `<1ms` 口水话/情绪词脱水编译器（`neutralizeToBabelTele`）、BPE 词元预算熔断器、**Tier-1 硬锚点 100% 防丢锁**（自动锁定路径、数值、API 标识符与 `!禁止:` 否定边界）及中文旁路解码器 |
| **Agent 主循环自动脱水（保热缓存）** | `packages/core/agent-loop/src/agent.ts` | 在 `ReactLoopAgent.buildRequest()` 底层内置基于 `WeakMap` 的跨步幂等消息投影：自动将冗长自然语言输入脱水为 `#Task` 硅基指令，同时保持历史对象引用恒定以 **100% 复用服务端 KV Prefix Cache** |
| **工作区 `[BT-Headers]` 骨架自动感知** | `packages/session/working-directory/src/index.ts` | 在 `WorkingDirectoryService` 原生注册 `BABELTELE_HEADERS` 上下文槽位，自动扫描工作区生成 `@relPath(L=n):[symbols]` 高密度代码骨架图谱 |
| **`[SMFT-T1]` 语义默克尔上下文压缩** | `packages/compaction/compaction-basic/src/summarizer.ts` | 底层重写 `/compact` 与自动压缩指令，输出 `#Intent` / `#Stack` / `#Files` / `#DiagFix` / `#Next` / `#Anchors` 结构化 `[SMFT-T1]` 检查点，压缩率提升 ~60% 且保留热前缀缓存 |
| **`babeltele/1.0` 子智能体高密协同总线** | `packages/subagent/tool-subagent/src/index.ts` | 重写 `subagent` 与 `subagent_fork` 底层协议，父子智能体默认通过 `#SubTask @scope ?constraints => goal` 与 `#SubReport` 极速传递任务与事实 |
| **Plane-B 工程代码 100% 零污染硬门禁** | `packages/fs/tool-fs/src/write.ts`<br>`packages/fs/tool-fs/src/edit.ts` | 在 `parseWriteArgs` 与 `parseEditArgs` 底层直接接入 `sanitizeCodeArtifact` / `auditCodeArtifactPurity`：自动剥离多余外层 Markdown 代码块围栏，并硬拒绝任何含 `#BT`、`⟦...⟧`、`[SMFT-T1]` 内部符号污染的 `.py` / `.java` / `.ts` / `.go` / `.rs` 等源码落盘 |
| **前端原生 Composer 提纯器 & 思考透视镜** | `packages/client/ui-primitives/src/babeltele.ts`<br>`packages/client/ui-conversation/src/client/skeleton/InputBar.tsx`<br>`packages/client/ui-chat/src/client/chat/ReasoningContent.tsx` | 全套自定义巴别语硅基塔徽标（`FishLogo.tsx` / `BrandWordmark.tsx`）；聊天输入框原生内嵌 **`⚡ 巴别语提纯 / 模板`** 实时预览面板与 **`🧹 自动脱水`** 开关；推理折叠块原生内嵌 **`👁️ 中文人话透视 / ⚡ #BT 硅基原文`** 一键切换 |

---

## 🚀 二、快速启动（Windows / macOS / Linux）

### 方式 1：Windows 一键双击启动
直接双击本目录下的 **`启动巴别语超级Agent.bat`**，自动启动并打开浏览器工作台（默认监听 `http://127.0.0.1:3720`）。

### 方式 2：命令行启动与重编译
```bash
cd babeltele-agent
pnpm install --ignore-scripts=false

# 若克隆自 Git 仓库首次运行，先执行全量源码编译：
pnpm run build:babeltele

# 启动内置 Web 超级智能体工作台（默认端口 3720）
DSH_HOME=./.dsh-home pnpm run web
```

---

## 📜 开源协议与致谢
- 本项目遵循 **MIT License** 开源。
- 底层运行时框架与插件系统基于开源项目 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)（MIT License）重构演化，谨向原开源团队致谢；所有品牌标识与核心协议层已遵照开源规范独立重塑为 **BabelTele (`BT-Spec v1.0`)**。
