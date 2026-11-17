# ⚡ BabelTele · DSH Super Agent（基于 DeepSeek Harness 深度魔改版）

> **开源底座声明**：本项目基于 DeepSeek AI 官方开源的智能体运行时与界面框架 **[DeepSeek Harness (`@deepseek-ai/dsh`)](https://github.com/deepseek-ai/deepseek-harness)**（MIT License，Cordis 全插件架构）深度魔改构建，严格遵循 DeepSeek Harness 社区品牌规范（使用 `DSH` 生态缩写与自定义 `BabelTele` 品牌标识），将 **巴别语规范（`BT-Spec v1.0`）** 完整植入官方 DSH Web 界面与自主执行内核。

---

## 一、 核心魔改架构：官方 DSH 全套交互 × 巴别语 `BT-Spec v1.0` 超速内核

本实现保留了 **DeepSeek Harness 原生全功能 Web UI**（多工作区管理、会话持久化、Settings → Models 多厂商模型与 API Key 管理、内置文件树、实时终端 PTY 面板、Subagent 子智能体树、Agent Teams 协作看板、Plan 规划模式与 `/goal` 目标驱动），并通过双端插件 [`@babeltele/dsh-plugin`](./plugins/babeltele-dsh-plugin/) 与配置层 [`config/babeltele.patch.yml`](./config/babeltele.patch.yml) 完成五大核心升级：

1. **预设级默认挂载：`⚡ 巴别语极速模式 (BabelTele Turbo)`（`preset-babeltele`）**
   * 新建会话默认选中 `BabelTele Turbo` 预设，同时完整保留原生 `standard`、`ptc`、`minimal` 预设，支持随时在同一个 DSH 界面内做 **巴别语 vs 常规自然语言** 同台对比。
2. **输入框原生集成：3 级混合巴别语中性提纯器与一键实战模板（`conversation.input.right` + `conversation.input.dock`）**
   * 在 DSH 原生聊天输入框右侧内嵌 **「⚡ 巴别语提纯 / 模板」** 按钮：
     * **免密钥 `<1ms` 离线规则脱水**：瞬间剥离人类输入中的口水寒暄与情绪宣泄词，输出冷静客观的 `#Task` 巴别语规格；
     * **真实 `js-tiktoken`（`o200k_base`）算账 + Tier-1 硬锚点锁**：逐位锁定精确数值、IP、路径、代码类名与否定边界（`!禁止:` / `!exc:`），支持一键替换草稿、一键调用当前配置的大模型深度提纯，或一键回退原话。
3. **推理流原生透视：`#BT` 硅基思考与中文旁路透视镜（`conversation.chat.reasoning.body`）**
   * 接管 DSH 聊天流的推理折叠槽位，支持在 **`⚡ #BT 硅基原文`** 与 **`👁️ 中文人话透视`** 之间零延迟一键切换，同时在会话顶栏（`conversation.session.header.utilities`）实时显示累计省流 Token 数与内核开关。
4. **长程记忆升级：`SMFT` 语义默克尔压缩引擎（`smft-compaction.mjs`）与跨文件 `BT-Header` 索引**
   * 继承扩展 `@deepseek-ai/dsh-compaction-basic` 的 `BasicCompactionEngine`，在复用大模型热 KV Prefix Cache 的前提下，将 `/compact` 与自动上下文压缩产物升级为高密度 `[SMFT-T1]` 巴别语检查点；并自动扫描当前工作区注入跨文件 `BT-Header` 函数/类签名拓扑。
5. **落盘零污染硬门禁：双平面 `ArtifactSanitizer`（`tools/pre-execute`）**
   * 严格物理隔离 **Plane A（巴别语极速思考与子智能体通信）** 与 **Plane B（工程源码落盘）**。每次调用 `write` / `edit` 写盘前自动审计代码纯净度，严防任何 `#BT` 符号混入 `.py` / `.java` / `.ts` / `.go` / `.rs` / `.html` 等工程代码。
6. **内置专属设置页与页内目录选择器**
   * 在 DSH 左下角 **Settings（设置）** 面板内新增 **「⚡ 巴别语内核」** 独立设置页；并将工作区目录选择器固定为页内可视化浏览组件（`directory-picker-browse`），避免本地弹窗被浏览器遮挡。

---

## 二、 快速启动指南

### 环境要求
* **Node.js `>= 24.0.0`** 与 **`pnpm`**

### 方式 A：Windows 双击一键启动（自动打开鉴权页面）
直接双击运行本目录下的 **`启动巴别语超级Agent.bat`**。

### 方式 B：命令行启动
```bash
cd babeltele-agent
pnpm install
pnpm web
```
启动后控制台会输出带本地安全鉴权令牌的访问地址（形如 `http://127.0.0.1:3720/?token=...`）并自动唤起浏览器：
1. 点击左下角 **Settings（设置） → Models（模型）**，填入您的 DeepSeek API Key 或添加任意 OpenAI / Anthropic / Gemini / 本地 Ollama 兼容模型；
2. 点击首页 **Choose workspace（选择工作区）** 选定任意本地项目目录；
3. 在输入框直接输入需求（或点击右下角 **「⚡ 巴别语模板 / 提纯」**）即可极速推进项目！

---

## 三、 自动化测试验证

```bash
cd babeltele-agent
pnpm test
```
