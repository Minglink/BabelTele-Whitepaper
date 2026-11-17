# ⚡ BabelTele Swarm (`@babeltele/swarm`)

**巴别语双平面极速项目推进引擎 (Dual-Plane Multi-Agent Project Accelerator)** — 控制与跨文件记忆平面 100% 采用高密度硅基巴别语 (`BT-Skeleton`) 极速流转，落盘源码平面 100% 输出**零污染、原生可编译的标准 Java / TypeScript / Python 工程代码**。

---

## 🛡️ 核心架构解答：全用巴别语推进项目，会把产出的 Java / Python / TS 代码搞坏吗？

**绝不会。** `@babeltele/swarm` 从底层强制执行 **双平面硬件级隔离架构 (Strict Dual-Plane Isolation)**：

| 平面维度 | 通信/存储介质 | 承载内容 | Token 压缩与保障机制 |
| :--- | :--- | :--- | :--- |
| **Plane 1：控制与记忆平面**<br>*(Control & Memory Plane)* | `BT-Skeleton` + `§SMFT` | 智能体间 `#PRD` (`<120 tok`)、`#ARCH` 接口契约、编码前 `#DRAFT` 思维草稿 (`<40 tok`)、`BT-Header` 跨文件符号头文件摘要、编译错误诊断 `#DIAG` | 砍除 **68%–82%** 礼貌寒暄与全量源码上下文重复投喂，交接提速 **2.5x–3.5x** |
| **Plane 2：产物与执行平面**<br>*(Artifact & Execution Plane)* | **100% 原生编程语言源码** | 写入 `workspaces/<runId>/` 的 `.java`、`.ts`、`.py`、`README.md` 等落盘文件 | **`ArtifactSanitizer` 词法级零污染门禁** + **真机编译器 (`javac` / `tsc` / `py_compile`) 与自测套件验收**，确保 **0 巴别语符号残留** |
| **Sidecar Lens：人类观测侧车** | 实时中文工程解码 | 控制流任意巴别语消息一键点击 **`👁️ 中文透视`**（或调用 `/api/decode-msg`） | 机器间极速巴别语通信，开发者侧 100% 透明可观测 |

### 跨文件 `BT-Header` 符号记忆池 (`§SMFT`)
每当一个 `.java` / `.ts` / `.py` 文件落盘后，`headerExtractor.ts` 机械提取其包路径、导出类/接口/枚举、精确方法参数与返回值签名及抛出异常，生成仅占原文件 **10%–16% Token 体积** 的 `#HDR[...]` 符号头文件并存入共享 `SMFT` 记忆池。后续 `Coder` 生成第 `2..N` 个文件时仅读取 `§SMFT` 符号表，既杜绝跨文件方法名幻觉，又节省约 **85%** 上下文开销。

---

## 🚀 快速上手

### 1. 安装与编译构建
```bash
npm install
npm run build
```

### 2. 启动实时流式战情室 Web UI（默认端口 `3722`）
```bash
npm start
# 浏览器访问 http://127.0.0.1:3722
```
战情室内置 **3 套完整可编译、带并发/单元自测的多文件实战蓝图**（免填 API Key 即可一键触发 SSE 流式构建 + 本地真机编译验收 + `BabelTele vs Verbose NL` 同台竞速对比），同时支持无缝切换至 **本机 Ollama (`127.0.0.1:11434`)** 或 **DeepSeek / Qwen / OpenAI 兼容 API** 驱动任意自定义需求！

### 3. 命令行极速推进 (`CLI`)
```bash
# 查看内置实战蓝图
npm run cli -- list-demos

# Java 21 高并发电商防超卖库存与订单服务（真机 javac 编译 + 50 线程抢购压测）
npm run cli -- run "开发高并发电商订单与防超卖库存服务" --lang java --bus babeltele --demo

# TypeScript 微服务 JWT 鉴权与令牌桶限流任务队列
npm run cli -- run "构建 JWT 鉴权限流优先级异步队列" --lang typescript --bus babeltele --demo

# Python 3.12 异步滑动时间窗金融风控规则引擎
npm run cli -- run "异步滑动时间窗实时风控规则引擎" --lang python --bus babeltele --demo

# 故障自愈演练：首轮故意注入巴别语算子污染，验证 ArtifactSanitizer 拦截 + Fixer 自动热修复
npm run cli -- run "故障自愈演练" --lang java --demo --fault-drill

# 连接真实云端大模型或本机 Ollama
npm run cli -- run "实现支持 LRU+TTL 的线程安全缓存库与测试" --lang java --engine ollama --model qwen2.5-coder:7b
```

### 4. 运行自动化测试套件
```bash
npm test
```

---

## 🔌 核心目录与模块说明

- `src/core/sanitizer.ts` — **`ArtifactSanitizer`**：词法状态机扫描源码（精准区分字符串/注释与活跃代码），拦截 `⟦⟧`、`#PRD/#DRAFT/#HDR`、`⇒/⊢/⊥/→` 等巴别语控制符泄漏、代码块围栏残留及括号失衡。
- `src/core/headerExtractor.ts` — **`BT-Header` 机械提取器 & `SMFTMemoryPool`**：支持 Java / TypeScript / Python 三语言符号签名压缩与跨文件记忆池管理。
- `src/core/verifier.ts` — **真机编译与契约验收引擎**：联动 `ArtifactSanitizer` + 架构师符号契约校验 + 本地 `javac`/`java`、`TypeScript Compiler API`、`python -m py_compile`/`unittest`，失败时自动浓缩为单行 `#DIAG[!Fail @File:Line ...]`。
- `src/core/sidecarDecoder.ts` — **`Sidecar Lens` 中文透视解码器**：将高密度 `BT-Skeleton` 指令无损还原为结构化中文工程说明。
- `src/agents/` & `src/orchestrator/swarmEngine.ts` — **4-Agent 双平面流水线**（`PM-Spec` → `Architect` → `Coder` → `Verifier & Fixer` 自愈闭环）及 `js-tiktoken (o200k_base)` 全链路精确计量。
- `src/server.ts` & `public/` — 基于原生 `node:http` + `SSE` 的三栏实时战情室 Web 服务。
