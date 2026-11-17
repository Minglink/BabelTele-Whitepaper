# ⚡ BabelTele Super Agent（巴别语极速超级 Agent）

> **开源重构基座**：基于 MIT 协议知名开源智能体架构 [`SWE-agent/mini-swe-agent`](https://github.com/SWE-agent/mini-swe-agent)（自主执行循环与沙箱子进程环境）与 [`HKUDS/nanobot`](https://github.com/HKUDS/nanobot)（工作区工具体系、上下文自动折叠与子智能体委派）深度重构，全面植入 **巴别语规范（`BT-Spec v1.0`）**。

---

## 一、 核心架构解决的工程痛点

1. **输入端：三级混合巴别语中性提纯器（`protocol/neutralizer.py`）**
   - **`<1ms` 零密钥离线规则脱水**：无需配置任何 API Key，即可毫秒级剥离人类自然语言中的寒暄、抱怨与情绪冗余，转化为冷静中性的 `#Task` 巴别语工程规格；配置模型后更支持一键大模型深度形式化提纯。
   - **Tier-1 工程硬锚点锁（100% 防丢）**：机械扫描并逐位锁定所有数字阈值、文件路径、API 路由、驼峰/下划线标识符与否定豁免边界（`严禁` / `!exc`），结合 `o200k_base` 真实分词防膨胀熔断。
2. **思考与通信端：`#BT` 硅基思考 + `SMFT` 默克尔记忆树 + 子智能体总线**
   - **推理输出减半**：中间工具调用轮次采用单行 `#BT` 形式化硅基思考（每步仅 `5~18` tokens，较传统冗长自然语言 CoT 节省 `65%~80%` 生成耗时），同时前端配备毫秒级 **「👁️ 人话透视镜」** 随时对照阅读。
   - **跨文件 `BT-Header` 索引与 `SMFT` 记忆折叠（`memory/`）**：自动提取工作区代码签名（压缩 `80%+`），并将旧工具轮次滚动折叠为 `[T1] -> [T2]` 默克尔摘要节点，支持一键无损回溯冷库原始消息。
   - **子智能体 `babeltele/1.0` 协同（`spawn_subagent`）**：父子 Agent 之间全程走高密度巴别语消息总线，杜绝多智能体间互相客套寒暄。
3. **产物端：双平面零污染隔离卫士（`protocol/sanitizer.py`）**
   - 严格物理隔离 **「硅基思考控制面（Plane A）」** 与 **「原生工程产物数据面（Plane B）」**。无论内部巴别语思考多么极致压缩，`write_file` / `edit_file` 落盘产出的 Python、Java、TypeScript、Go、SQL、HTML 代码均经由 `ArtifactSanitizer` 实时审计，确保 **100% 纯正原生语法，零巴别语符号污染**。
4. **交互端：100% 零外部 CDN 本地全图形化 IDE 控制台（`web/`）**
   - 零外部静态资源依赖（断网或内网环境秒开），一站式集成：**图形化模型与密钥配置（支持连接握手实测与本机 Ollama 一键探测）**、**图形化本地磁盘目录选择器**、**实时 SSE 执行流**、**Unified Diff 代码变更审计**与**实时终端输出**。

---

## 二、 10 秒快速启动

### 方式 A：Windows 一键双击启动（推荐）
直接双击运行本目录下的 **`启动巴别语超级Agent.bat`**，系统将自动拉起本地服务并在浏览器打开 `http://127.0.0.1:3720`。

### 方式 B：命令行启动图形工作台
```bash
cd babeltele-agent
python start.py --port 3720 --open
```
> 依赖仅需标准 Python `3.10+` 与 `flask`、`requests`（若环境中尚未安装，执行 `pip install flask requests`；可选安装 `tiktoken` 启用官方 C 扩展分词）。

### 方式 C：无头命令行模式（Headless CLI）
```bash
python start.py --workspace ./my-demo --task "创建一个带单元测试的 LRU 缓存模块 lru_cache.py 并运行 unittest 验证"
```

---

## 三、 目录结构说明

```text
babeltele-agent/
├── start.py                        # 统一启动入口 (Web IDE + Headless CLI)
├── 启动巴别语超级Agent.bat           # Windows 双击一键启动器
├── pyproject.toml                  # Python 包定义与依赖清单
├── LICENSE                         # MIT 开源许可证（含上游架构致谢）
├── babeltele_agent/
│   ├── config.py                   # 多厂商模型预设、密钥脱敏持久化与 Ollama 探测
│   ├── protocol/
│   │   ├── tokenizer.py            # o200k_base BPE 分词预算核算与熔断器
│   │   ├── neutralizer.py          # 3级混合中性提纯器、Tier-1 锚点审计与人话透视解码
│   │   ├── sanitizer.py            # 双平面零污染代码审计卫士 (ArtifactSanitizer)
│   │   └── prompts.py              # 双平面系统提示词与常规自然语言对照基线
│   ├── memory/
│   │   ├── header_index.py         # 跨文件 BT-Header 符号拓扑提取器
│   │   └── smft.py                 # SMFT 语义默克尔折叠树 (T1->T2) 与冷库无损回溯
│   ├── tools/
│   │   ├── workspace.py            # 沙箱文件读写、精确替换、正则搜索、Diff 与子进程终端
│   │   └── registry.py             # OpenAI Function Calling 工具注册表
│   ├── agent/
│   │   ├── llm_provider.py         # 通用 OpenAI 兼容驱动（支持原生 tool_calls 与代码块回退）
│   │   └── runner.py               # BabelTeleSuperAgent 主循环与子智能体总线
│   └── web/
│       ├── server.py               # Flask 图形接口与 SSE 实时事件流服务
│       └── static/                 # 100% 零外部 CDN 本地图形化三栏 IDE 前端
└── tests/
    └── test_super_agent.py         # 全链路端到端自动化验证套件（含本地 Mock LLM 实测）
```
