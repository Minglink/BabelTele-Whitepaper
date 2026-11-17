# 🗼 BabelTele Studio (`@babeltele/studio`)

**Industrial-Grade 3-Stage Hybrid Neutralizing Compiler, Subword BPE Token Accountant, Tier-1 Deterministic Hard-Anchor Auditor, CLI & Interactive Web Studio for `BT-Spec v1.0`.**

---

## ✨ Core Architecture (3-Stage Hybrid Pipeline)

1. **Stage 1 — `<2ms` Deterministic Dehydrator & Offline Neutralizer (`src/core/ruleEngine.ts`)**
   - Strips emotional venting, sycophantic/polite conversational padding, and subjective framing in Chinese & English.
   - Collapses verbose natural-language clauses into tokenizer-safe 1-token ASCII operators (`=>`, `->`, `<=>`, `&`, `|`, `!`, `?`, `@`, `#`, `=`) with **zero multi-byte emoji inflation**.
   - Serves both as a Stage-1 pre-processor before neural compilation and as an instant `<2ms` zero-dependency offline compiler (`engine: "offline-rule"`).

2. **Stage 2 — Universal OpenAI-Compatible & Local Ollama Neural Adapter (`src/core/llmClient.ts` & `src/core/prompts.ts`)**
   - Works out-of-the-box with **DeepSeek** (`https://api.deepseek.com/v1`), **Qwen DashScope** (`https://dashscope.aliyuncs.com/compatible-mode/v1`), **OpenAI**, **Gemini OpenAI-compat**, **LM Studio**, and **Local Ollama** (`http://127.0.0.1:11434/v1`).
   - Built-in `probeOllama()` auto-detects running local Ollama instances (`GET /api/tags`, 1.5s timeout) and recommends installed small models (`qwen2.5:3b`, `qwen2.5:7b`, `llama3.2`, etc.).
   - Automatically strips `<think>...</think>` blocks emitted by reasoning models so thinking tokens never pollute compiled BabelTele payloads.

3. **Stage 3 — Real Subword BPE Accountant, Tier-1 Hard-Anchor Lock & Circuit Breaker (`src/core/tokenizer.ts` & `src/core/auditor.ts`)**
   - **Real BPE Measurement**: Uses `js-tiktoken` (`o200k_base` & `cl100k_base`) to verify true subword token reduction ($\Delta L_{\text{BPE}} < 0$) and detect the **Naive Symbol Illusion** ($\Delta L_{\text{BPE}} \ge 0$ despite shorter character count).
   - **Tier-1 Deterministic Hard-Anchor Auditor (`<2ms`)**: Mechanically extracts exact numbers, percentages, scientific notation, versions (`v1.2.3`), URLs/IPs/paths, code identifiers (`camelCase`, `PascalCase`, `snake_case`, HTTP methods), `BIBREF`/`TABREF` placeholders, and semantic negations (`严禁`, `除非`, `except`, `without`).
   - **Anchor Lock & Circuit Breaker**: Automatically appends `![Lock: ...]` if an upstream LLM drops any hard number/identifier, and triggers a circuit breaker if a short/dense input would suffer BPE token inflation.

---

## 🚀 Quick Start

```bash
cd babeltele-studio
npm install
npm run build

# Start Interactive Web Studio (default http://127.0.0.1:3721)
npm start

# Run Automated Unit & HTTP Integration Tests
npm test
```

Copy `.env.example` to `.env` if you want default upstream API credentials pre-loaded:

```ini
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=deepseek-chat
PORT=3721
```

---

## 🎯 Official `BT-Spec v1.0` Compiler Profiles

| Profile ID | Name | Target Tier | Use Case |
| :--- | :--- | :---: | :--- |
| **`neutral-formal`** *(Default)* | 中性形式化提纯器 | `BT-L2 Neutral` | Strips emotional/colloquial bias into clinical `#Domain @Entities ?Conditions => Target !Boundaries` |
| **`bt-core`** | 标准通用编译器 (`C.1` / `BT-P7`) | `BT-L2 (25%–40%)` | Cross-model omnilingual compression enforcing $\Delta L_{\text{BPE}} < 0$ |
| **`bt-memory`** | 自适应五维记忆清单 (`BT-P1`) | `BT-L1 ~ BT-L2` | Agent long-term session memory folding (SMFT checkpoints) |
| **`bt-skeleton`** | 纯 ASCII 代码与规约骨架 (`BT-P13`) | `BT-L2 ~ BT-L3` | Architecture specs, API contracts, RFCs & large codebases (`#`, `@`, `$`, `?[]=>[]`, `!`, `<>`) |
| **`bt-zero`** | 零开销扁平键值流 (`BT-P2`) | `BT-L3` | Ultra-flat `\|`-delimited `K=V` stream without JSON braces/quotes |

Plus **`BT-Decoder`** (`zh` / `en`) for lossless natural-language sidecar restoration.

---

## 💻 CLI Usage

```bash
# 1. Offline <2ms Neutralizing Compile
npm run cli -- compile "你好请问能不能麻烦帮我看看！/api/v2/checkout 超过 50 件商品时延迟飙到 3500ms，要求压到 200ms 以内，严禁直查 MySQL，除非 Redis 宕机！" --offline

# 2. Compile a file with BT-Skeleton profile or upstream LLM
npm run cli -- compile ./spec.md --profile bt-skeleton --base-url http://127.0.0.1:11434/v1 --model qwen2.5:3b

# 3. Lossless Sidecar Decode (zh | en)
npm run cli -- decode "#OrderSpec /api/v2/checkout ?items>50 => latency<=200ms & !MySQL !exc:Redis_down" --lang zh --offline

# 4. Standalone Tier-1 Hard-Anchor & BPE Audit
npm run cli -- audit "timeout <= 200ms & !directDB" "#Spec $timeout<=200ms & !directDB"

# 5. Start Web Studio on custom port
npm run cli -- serve --port 3721
```

---

## 🌐 REST API Endpoints

| Method & Route | Description |
| :--- | :--- |
| `GET /api/health` | Service metadata, default config status, 5 compiler profiles & 4 preset scenarios |
| `GET /api/ollama/detect` | Probes `http://127.0.0.1:11434/api/tags` (1.5s timeout) and recommends local small models |
| `POST /api/tokenize` | Live `js-tiktoken` BPE subword counter (`chars`, `o200k_base`, `cl100k_base`) |
| `POST /api/compile` | Runs full 3-Stage Hybrid Compiler, returning BT output, dual BPE report & Tier-1 anchor audit |
| `POST /api/decode` | Restores BabelTele into fluent `zh` or `en` prose with post-decode anchor verification |
| `POST /api/audit` | Runs standalone Tier-1 Hard-Anchor & BPE audit on `{ sourceText, btText }` |
| `POST /api/relay` | Compiles user input -> BabelTele -> dispatches to target AI (with optional A/B raw comparison) |

---

## 📦 Programmatic TypeScript / Node.js SDK

```ts
import {
  compileToBabelTele,
  decodeFromBabelTele,
  auditBabelTele,
  compareTokenMetrics,
} from "@babeltele/studio";

const result = await compileToBabelTele(
  "如果 JWT.alg 设置为 'none' 或 JWT.exp 缺失，立即返回 HTTP 401，除非访问 /healthz",
  { profile: "neutral-formal", offline: true },
);

console.log(result.output);
console.log(result.tokenMetrics.o200k_base); // { sourceTokens, compiledTokens, deltaTokens, compressionRatioPct, ... }
console.log(result.audit.passed);            // true
```
