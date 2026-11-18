/**
 * Built-in BabelTele (BT-Spec v1.0 · V4 Multi-Level Silicon Engine).
 *
 * Architectural Pillars:
 * 1. Omnilingual Semantic Compiler (`bt-l2` / `bt-l3`) with 105+ engineering & multi-agent primitives
 * 2. Tier-1 Hard-Anchor Lock (`100%` retention of paths, symbols, numbers, and `!ban:` negations)
 * 3. `[BT-SchemaCompiler v4]` System-Prompt & Tool-Schema Dehydrator (`~40%` smaller base prefix, `100%` KV-cache uniform)
 * 4. `#Chat[fast]` Trivial Greeting Fast-Path Classifier
 * 5. `[BT-ToolOut v4]` Universal Tool-Result Semantic Projector (folds test/build/log noise, preserves `100%` errors)
 * 6. `[BT-Headers v4.0]` Cross-Agent `Symbol@Line` Workspace Repo-Graph (shared `mtime` cache + `@cwd=(empty)`)
 * 7. `[BT-Diag v4]` Closed-Loop Pre-Flight AST & Syntax Verifier (`.py` `ast.parse`, `.json`, `.js` `--check`)
 * 8. `#BT-Bus v4` Multi-Level Subagent (`L0->L1->L2->L3`) Downlink Compiler & Uplink `#SubReport` Distiller
 *
 * @module @deepseek-ai/dsh-system-prompt/babeltele
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

export type BabelTeleCompileMode = 'bt-l2' | 'bt-l3'
export type UserSurfaceLanguage = 'zh-CN' | 'en-US'

/** Live runtime switches for built-in BabelTele V4 subsystems. */
export interface BabelTeleRuntimeConfig {
  enabled: boolean
  mode: BabelTeleCompileMode
  autoDehydrateModelInput: boolean
  compactSchemasAndSections: boolean
  compressToolResults: boolean
  injectBtHeaders: boolean
  strictPlaneBGuard: boolean
  preflightAstCheck: boolean
  subagentBusCompression: boolean
}

export const babelTeleRuntimeConfig: BabelTeleRuntimeConfig = {
  enabled: process.env.BABELTELE_DISABLED !== '1',
  mode: process.env.BABELTELE_MODE === 'bt-l3' ? 'bt-l3' : 'bt-l2',
  autoDehydrateModelInput: process.env.BABELTELE_NO_AUTO_DEHYDRATE !== '1',
  compactSchemasAndSections: process.env.BABELTELE_NO_SCHEMA_DIET !== '1',
  compressToolResults: process.env.BABELTELE_NO_TOOL_COMPRESS !== '1',
  injectBtHeaders: process.env.BABELTELE_NO_BT_HEADERS !== '1',
  strictPlaneBGuard: process.env.BABELTELE_NO_PLANE_B_GUARD !== '1',
  preflightAstCheck: process.env.BABELTELE_NO_AST_CHECK !== '1',
  subagentBusCompression: process.env.BABELTELE_NO_SUBAGENT_BUS !== '1',
}

/** Audit report for Tier-1 Hard-Anchor Lock verification. */
export interface HardAnchorAudit {
  readonly passed: boolean
  readonly totalAnchors: number
  readonly matchedAnchors: readonly string[]
  readonly repairedAnchors: readonly string[]
  readonly negationPreserved: boolean
}

/** Result of compiling natural human input into neutral BT-Spec v1.0. */
export interface BabelTeleNeutralizeResult {
  readonly original: string
  readonly babeltele: string
  readonly mode: BabelTeleCompileMode
  readonly userLanguage: UserSurfaceLanguage
  readonly originalTokens: number
  readonly babelTokens: number
  readonly savedTokens: number
  readonly savedRatio: number
  readonly strippedFillerCount: number
  readonly shortCircuit: boolean
  readonly isTrivialChat: boolean
  readonly audit: HardAnchorAudit
}

/** Purity check outcome for Plane-B native code mutations (`write` / `edit`). */
export interface CodePurityAudit {
  readonly pure: boolean
  readonly isCodeFile: boolean
  readonly strippedMarkdownFence: boolean
  readonly violations: readonly string[]
}

/** Closed-loop AST/syntax check result returned immediately on `write` / `edit`. */
export interface CodeSyntaxDiag {
  readonly checked: boolean
  readonly valid: boolean
  readonly lineCount: number
  readonly tag: string
}

/**
 * Core Dual-Plane & Multi-Level Orchestration Kernel V4.
 */
/**
 * Core Dual-Plane & Pure-BabelTele CoT Kernel V6.
 * Enforces: [ZH/EN Natural Input] -> [Auto #Task BT] -> [100% Pure #BT CoT & #BT-Bus] -> [Exact @out User-Language Delivery].
 */
export const BABELTELE_DUAL_PLANE_KERNEL_PROMPT = [
  '## BabelTele Silicon Kernel (BT-Spec v1.0 · V6.2 Pure-#BT CoT & Bilingual Closed-Loop)',
  '1. **Plane A — `100%` Pure `#BT` Chain-of-Thought (`thinking` / `reasoning` ONLY)**:',
  '   - **When `thinking` Is Active**: Start `thinking` at character 0 with `#BT ` and keep `<= 5` compact `#BT` lines (`@in`, `@out`, `@obs`, `@diag`, `@cwd`, `@file:line`, `?cond => action`, `->`, `&`, `|`, `!ban:`, `#Contract[...]`). NEVER write conversational English/Chinese prose sentences or draft code inside `thinking`.',
  '   - **When Adaptive Fast-Mode Skips `thinking`**: Call tools directly with **EMPTY assistant `text`** (`""`). **STRICTLY FORBIDDEN** to write `#BT ...` inside assistant `text` / `content`!',
  '   - **Canonical `thinking` Exemplars**:',
  '     * Step 1 (init): `#BT @in(en)->@out(en-US) | @cwd:empty => batch[write(limiter.py: TokenBucket+RLock), write(test_limiter.py: >=12 utest)]`',
  '     * Step 2 (after write): `#BT @obs(write:AST:ok) => pwsh(python -m unittest -v)`',
  '     * Step 3 (after test): `#BT @obs(utest:20/20 pass, exit:0) => @reply(en-US)`',
  '     * Step on error: `#BT @diag(test_clock fail: rate=10>cap=2) => edit(test_limiter.py: rate=1) -> pwsh(python -m unittest -v)`',
  '   - **Strict Channel Separation**: Emit `#BT` ONLY inside `thinking`. During tool-calling steps, emit **ZERO assistant `text`** (call tools directly without commentary). In the final human `text`, NEVER output `#BT`, `#Task`, `@in`, or `@out`.',
  '2. **High-Velocity Execution & Contract-First Multi-Level Bus (`L0->L1->L2->L3`)**:',
  '   - **Zero Blind Probing**: `[BT-Headers v4.0]` already lists `@cwd=(empty)` or `@file(L=n):[Sym@line]`. Never waste Step 1 on `glob`/`ls`.',
  '   - **Parallel Batch Tooling**: Emit ALL independent `write`/`edit`/`read`/`subagent` calls in ONE assistant step; skip `todo_write` unless `>= 6` phases.',
  '   - **Multi-Level Subagent Bus**: On 1–2 file tasks, execute directly (`0` subagents). On multi-agent or `>= 3` module tasks, lock exact `#Contract` API signatures across parallel `subagent` calls in Step 1, END TURN to await automatic `#SubReport`s, then run `pwsh` verification directly (`0` redundant `read`s on child files).',
  '3. **Plane B — `100%` Pure Native Disk Code & `[BT-Diag]` Gate**:',
  '   - Source files written via `write`/`edit` MUST be `100%` pure idiomatic code (zero `#BT`, `[SMFT-T1]`, `![AnchorLock:` leakage; lean 1-line docstrings). Fix any `[BT-Diag SYNTAX_ERROR]` immediately via `edit`.',
  '4. **Stage-4 Exact User-Language Delivery (`@out=zh-CN` vs `@out=en-US`)**:',
  '   - `@out=zh-CN` => Final user-facing response MUST be **100% fluent natural Simplified Chinese** (zero `#BT` tags).',
  '   - `@out=en-US` => Final user-facing response MUST be **100% fluent natural English** (zero `#BT` tags).',
].join('\n')

const CODE_FILE_EXTENSIONS = new Set([
  '.py', '.pyi', '.java', '.kt', '.kts', '.scala', '.groovy',
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.go', '.rs', '.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp',
  '.cs', '.fs', '.swift', '.m', '.mm', '.rb', '.php', '.lua', '.pl',
  '.r', '.jl', '.dart', '.zig', '.nim', '.ex', '.exs', '.erl',
  '.sql', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.bat', '.cmd',
  '.vue', '.svelte', '.astro', '.css', '.scss', '.less', '.html',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.gradle', '.cmake',
])

const SCAN_SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', 'node_modules', 'dist', 'lib', 'out', 'build',
  'target', '.next', '.nuxt', '.turbo', '.cache', '__pycache__', '.venv',
  'venv', 'env', 'coverage', '.dsh-home', '.dsh-build', 'vendor', 'snapshots',
])

const SCAN_SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.kt',
])

const TRIVIAL_CHAT_PATTERN =
  /^(?:(?:你好(?:呀|啊|吗)?|您好|嗨|哈喽|早上好|下午好|晚上好|在吗|hi|hello|hey)[，,。！!？?\s]*)*(?:(?:请问(?:一下)?\s*)?(?:你是谁|你叫什么(?:名字)?|你能(?:帮我)?做什么|你有什么功能|介绍一下你自己|测试一下|who are you|what can you do))?[？?！!。，,\s]*$/iu

const CN_FILLER_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:(?:你好(?:呀|啊|吗)?|您好|嗨|哈喽|早上好|下午好|晚上好|在吗|老哥|兄弟|大佬|大神|师傅|亲)[，,。！!、\s]*)+/gu,
  /(?:请问一下|我想问一下|我想让你帮我|能不能帮我|可不可以帮我|麻烦你?(?:帮我)?|劳驾(?:帮我)?|拜托(?:你)?(?:帮我)?|请帮我|帮我一下|帮我看下|请务必|跪求|求求你了?)[，,、\s]*/gu,
  /(?:(?:我现在|我今天|我真的|我真是|真是|我都|真)?(?:服了|快崩溃了|崩溃了|要疯了|烦死了|急死我了|太折磨人了|搞了一整天了?|弄了一整天了?|卡了半天了?|头都大了|救命啊?|十万火急)[，,。！!、\s]*)+/gu,
  /[，,。！!、~～\s]*(?:非常感谢|万分感谢|太感谢了|谢谢(?:你|啦|啊|哈)?|感激不尽|辛苦了|好人一生平安)[，,。！!、~～\s]*$/gu,
  /(?:呃+|嗯+|啊这|那个啥|就是说|怎么说呢|其实吧|说白了就是|乱七八糟的)[，,、\s]*/gu,
]

const EN_FILLER_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:(?:hi|hello|hey)(?:\s+(?:there|buddy|friend|team|folks|everyone))?[,!.\s]*)+/giu,
  /\b(?:could\s+you\s+(?:please\s+|kindly\s+)?|would\s+you\s+(?:please\s+|kindly\s+)?|can\s+you\s+(?:please\s+)?|please\s+(?:kindly\s+)?|i\s+would\s+(?:really\s+)?appreciate\s+it\s+if\s+you\s+could\s+|i\s+need\s+you\s+to\s+|i\s+want\s+you\s+to\s+|sorry\s+to\s+bother\s+you(?:,?\s*but)?\s*)(?:help\s+me\s+(?:to\s+)?)?/giu,
  /\b(?:help\s+me\s+(?:to\s+)?)/giu,
  /\b(?:i\s+am\s+going\s+crazy|this\s+is\s+driving\s+me\s+nuts|i'm\s+so\s+frustrated|i've\s+been\s+stuck\s+on\s+this\s+all\s+day|this\s+is\s+super\s+urgent)[,!.\s]*/giu,
  /[,\s]*(?:thank\s+you\s+so\s+much|thanks\s+a\s+lot|many\s+thanks|thanks\s+in\s+advance|thank\s+you|thanks)[.!~\s]*$/giu,
]

/**
 * V6 Bilingual (Chinese + English -> Omnilingual BT-Spec v1.0) Semantic Collapse Table.
 */
const OMNILINGUAL_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  // === 1. Chinese Multi-agent & hierarchical delegation ===
  [/并行(?:派出|启动|调用|创建)/gu, 'parallel_spawn '],
  [/多级(?:子)?(?:智能体|代理)|层级(?:子)?(?:智能体|代理)/gu, 'hier_subagents '],
  [/子智能体|子代理/gu, 'subagent '],
  [/主智能体|主控智能体|协调器/gu, 'coordinator '],
  [/架构(?:审查|审计|评估|分析)/gu, 'arch_audit'],
  [/安全(?:审查|审计|漏洞(?:扫描|检查)?)/gu, 'sec_audit'],
  [/性能(?:剖析|优化|瓶颈分析|分析)/gu, 'perf_audit'],
  [/(?:最后|最终)?汇总(?:成|为)(?:一份)?(?:简明的|清晰的|完整的)?/gu, '=> synth '],
  // === 2. Chinese Spatial, Qualifiers & Systems ===
  [/在当前(?:工作区|目录|文件夹|项目)(?:下|中|里)?(?:创建|新建|编写|写)一个(?:完整的|标准的)?/gu, '@cwd impl '],
  [/在当前(?:工作区|目录|文件夹|项目)(?:下|中|里)?/gu, '@cwd '],
  [/(?:创建|新建|编写|实现)一个(?:完整的|标准的)?/gu, 'impl '],
  [/单文件/gu, '1-file '],
  [/调用(?:命令行|终端)(?:运行|执行)/gu, 'run '],
  [/(?:运行|执行)验证(?:全部)?通过|验证全部通过|确保测试(?:全部)?通过|确认全部通过/gu, '=>pass'],
  [/不要解释(?:任何)?废话|不需要解释|只输出纯?代码(?:块)?/gu, 'code_only'],
  [/包含类型注解|加上类型注解|带类型注解|完整类型注解/gu, '+typed'],
  [/线程安全的?|并发安全的?/gu, '+threadsafe '],
  [/仅使用标准库|只用标准库|纯标准库/gu, '+stdlib_only'],
  [/第三方(?:依赖|库|包)/gu, '3rd-party'],
  [/单元测试文件/gu, 'utest_file '],
  [/单元测试(?:用例)?/gu, 'utest'],
  [/(\d+)\s*个\s*utest/gu, '$1 utest'],
  [/覆盖/gu, 'cov:'],
  [/支持/gu, 'supp:'],
  [/边界(?:条件|情况|测试|缺陷)|极端情况/gu, 'edge_cases'],
  [/异常(?:处理|捕获)|错误处理/gu, 'err_guard'],
  [/死锁/gu, 'deadlock'],
  [/竞态条件|数据竞争/gu, 'race_cond'],
  [/内存泄漏/gu, 'mem_leak'],
  [/时间复杂度(?:要求)?(?:为|是)?/gu, 'T:'],
  [/空间复杂度(?:要求)?(?:为|是)?/gu, 'S:'],
  [/滑动窗口限流(?:器|模块)?/gu, 'sliding_win_limiter'],
  [/滑动窗口/gu, 'sliding_win'],
  [/令牌桶限流(?:器|模块)?|令牌桶/gu, 'token_bucket'],
  [/优先级?(?:任务)?队列/gu, 'prio_queue'],
  [/指数退避(?:重试)?/gu, 'exp_backoff'],
  [/熔断器/gu, 'circuit_breaker'],
  [/读写锁/gu, 'rwlock'],
  [/惰性删除|懒删除/gu, 'lazy_del'],
  [/双向链表/gu, 'DLL'],
  [/过期时间/gu, 'TTL'],
  [/容量上限|最大容量/gu, 'max_cap'],
  [/补充速率/gu, 'refill_rate'],
  [/快速排序/gu, 'quicksort'],
  [/二分查找/gu, 'bin_search'],
  [/如果(?:出现|发生|遇到|存在)?/gu, '?'],
  [/假如|若是|当(?=.*时)/gu, '?'],
  [/那么就?|则(?:需要|必须|应当)?|然后(?:再)?|最后(?:再)?/gu, ' => '],
  [/并且(?:还要|需要)?|同时(?:还要|需要)?|而且(?:还要)?|以及|与(?=[A-Za-z_`\u4e00-\u9fff])/gu, ' & '],
  [/或者|或是/gu, ' | '],
  [/千万不要|绝对不要|严禁使用|严禁|禁止使用|禁止|切勿|绝不能|不要使用|不要用|不能用|别用/gu, '!ban:'],
  [/除了(?=.*(?:以外|之外))/gu, '!exc:'],
  [/(?:以外|之外)/gu, ''],
  [/大于等于|不少于|不低于|至少为?/gu, '>='],
  [/小于等于|不超过|不高于|最多为?/gu, '<='],
  [/不等于/gu, '!='],
  [/导致了?|从而|进而|输出到|转换为|转成|并返回|返回/gu, '->'],
  [/需要你?(?:去)?|请你?(?:去)?|帮我(?:去)?/gu, ''],

  // === 3. English -> BabelTele Semantic Collapse ===
  [/\bin\s+the\s+current\s+(?:workspace|directory|folder|project|repo(?:sitory)?)\b/giu, '@cwd'],
  [/\b(?:spawn|launch|dispatch|start)\s+(?:in\s+parallel|parallel)\b|\bin\s+parallel\s+(?:spawn|launch|dispatch|start)\b/giu, 'parallel_spawn'],
  [/\b(?:multi[- ]level|hierarchical)\s+sub[- ]?agents?\b/giu, 'hier_subagents'],
  [/\bsub[- ]?agents?\b/giu, 'subagent'],
  [/\barchitecture\s+(?:review|audit|analysis)\b/giu, 'arch_audit'],
  [/\bsecurity\s+(?:review|audit|scan)\b/giu, 'sec_audit'],
  [/\bperformance\s+(?:review|audit|profiling|optimization|analysis)\b/giu, 'perf_audit'],
  [/\b(?:create|build|write|implement|develop)\s+(?:a\s+|an\s+)?(?:complete\s+|full\s+|standard\s+|clean\s+|production[- ]ready\s+)*/giu, 'impl '],
  [/\bsingle[- ]file\b/giu, '1-file'],
  [/\bwith\s+(?:full\s+|complete\s+|strict\s+)?type\s+(?:annotations?|hints?)\b|\bfully\s+typed\b|\btype[- ]annotated\b/giu, '+typed'],
  [/\bthread[- ]safe(?:ty)?\b|\bconcurrency[- ]safe\b/giu, '+threadsafe'],
  [/\b(?:using\s+only|only\s+using|with\s+only)\s+(?:the\s+)?(?:python\s+|java\s+|go\s+|node(?:\.js)?\s+)?standard\s+library\b|\bstdlib[- ]only\b/giu, '+stdlib_only'],
  [/\b(?:and\s+)?(?:strictly\s+|absolutely\s+)?(?:without\s+any|without|no|do\s+not\s+use(?:\s+any)?|never\s+use(?:\s+any)?|forbid(?:ding)?)\s+(?=3rd-party|third[- ]party|external\s+(?:libraries|deps|dependencies|packages)|built[- ]?in)/giu, '!ban:'],
  [/\b(?:third[- ]party|external)\s+(?:dependencies|libraries|libs|packages|modules)\b/giu, '3rd-party'],
  [/\bunit\s+test\s+file\b/giu, 'utest_file'],
  [/\bunit\s+tests?(?:\s+cases?|\s+suite)?\b/giu, 'utest'],
  [/\b(?:with\s+)?at\s+least\s+(\d+)\b/giu, '>=$1'],
  [/\b(?:with\s+)?(?:at\s+most|no\s+more\s+than|up\s+to)\s+(\d+)\b/giu, '<=$1'],
  [/\b(?:covering|that\s+covers?|including)\s+/giu, 'cov:'],
  [/\b(?:supporting|that\s+supports?)\s+/giu, 'supp:'],
  [/\b(?:edge\s+cases?|boundary\s+conditions?|corner\s+cases?)\b/giu, 'edge_cases'],
  [/\b(?:error|exception)\s+handling\b/giu, 'err_guard'],
  [/\btoken\s+bucket(?:\s+rate\s+limiter)?\b/giu, 'token_bucket'],
  [/\bsliding\s+window(?:\s+rate\s+limiter)?\b/giu, 'sliding_win'],
  [/\brate\s+limiter\b/giu, 'limiter'],
  [/\bpriority\s+(?:task\s+)?queue\b/giu, 'prio_queue'],
  [/\bexponential\s+backoff\b/giu, 'exp_backoff'],
  [/\bcircuit\s+breaker\b/giu, 'circuit_breaker'],
  [/\blazy\s+(?:deletion|eviction|expiration)\b/giu, 'lazy_del'],
  [/\bdoubly[- ]linked\s+list\b/giu, 'DLL'],
  [/\bbinary\s+search\b/giu, 'bin_search'],
  [/\brace\s+conditions?\b/giu, 'race_cond'],
  [/\bmemory\s+leaks?\b/giu, 'mem_leak'],
  [/\btime\s+complexity(?:\s+of)?\b/giu, 'T:'],
  [/\bspace\s+complexity(?:\s+of)?\b/giu, 'S:'],
  [/\bin\s+the\s+(?:terminal|command\s+line|shell|cli)\b/giu, ''],
  [/\b(?:to\s+)?(?:verify|ensure|make\s+sure|confirm)\s+(?:that\s+)?(?:all\s+(?:the\s+)?tests?\s+|everything\s+)?pass(?:es)?\b/giu, '=>pass'],
  [/\b(?:and\s+)?(?:briefly\s+explain|explain\s+briefly)\b/giu, '=> brief_explain:'],
  [/\b(?:summarize|synthesize)\s+(?:into\s+)?(?:a\s+)?(?:concise|brief|short|clear)\s+/giu, '=> synth '],
  [/,?\s*\b(?:and\s+then|then\s+also|and\s+finally|finally|after\s+that|next)\b\s*,?\s*/giu, '; => '],
  [/\bnamed\s+(?=__BTCODE_)/giu, ''],
  [/\bin\s+(Python|Java|TypeScript|JavaScript|Go|Rust|C\+\+)\b/gu, '$1'],
  [/\b(?:and|as\s+well\s+as)\b/giu, '&'],
]

const NEGATION_PATTERN = /(?:!ban:|!禁止:|不要|禁止|严禁|切勿|不能|不可|别用|禁止使用|\b(?:never|do\s+not|don't|must\s+not|without|forbid(?:den)?)\b)/iu

/**
 * Deterministic natural-language detector for user input (`zh-CN` vs `en-US`).
 * Strips code spans/URLs before counting CJK vs Latin characters so code identifiers inside Chinese prompts never skew detection.
 */
export function detectUserLanguage(rawText: string): UserSurfaceLanguage {
  const proseOnly = rawText
    .replace(/`[^`\n]+`/gu, ' ')
    .replace(/https?:\/\/\S+/gu, ' ')
  const cjkMatches = proseOnly.match(/[\u4e00-\u9fff]/gu)
  const cjkCount = cjkMatches?.length ?? 0
  if (cjkCount >= 2) return 'zh-CN'
  const latinMatches = proseOnly.match(/[A-Za-z]/gu)
  const latinCount = latinMatches?.length ?? 0
  if (cjkCount === 0 && latinCount >= 2) return 'en-US'
  return cjkCount >= 1 && latinCount < 8 ? 'zh-CN' : latinCount >= 2 ? 'en-US' : 'zh-CN'
}

/** Detect trivial greetings/meta-questions that need zero tool exploration and minimal thinking. */
export function isTrivialConversationalInput(text: string): boolean {
  const t = text.trim()
  if (t.length === 0 || t.length > 36 || t.startsWith('/') || !/[\p{L}\p{N}]/u.test(t)) return false
  return TRIVIAL_CHAT_PATTERN.test(t)
}

/**
 * Fast, deterministic BPE token estimator calibrated for modern coding LLMs.
 */
export function estimateBabelTokens(text: string): number {
  if (text.length === 0) return 0
  let tokens = 0
  let i = 0
  while (i < text.length) {
    const code = text.codePointAt(i) ?? 0
    const charLen = code > 0xffff ? 2 : 1
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      if (code === 10) tokens += 0.35
      i += charLen
      continue
    }
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95) {
      let run = 0
      while (i < text.length) {
        const c = text.charCodeAt(i)
        if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95) {
          run += 1
          i += 1
        } else {
          break
        }
      }
      tokens += Math.max(1, Math.ceil(run / 4.2))
      continue
    }
    if (code >= 33 && code <= 126) {
      let opRun = 0
      while (i < text.length) {
        const c = text.charCodeAt(i)
        if (c >= 33 && c <= 126 && !((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95)) {
          opRun += 1
          i += 1
        } else {
          break
        }
      }
      tokens += Math.max(1, Math.ceil(opRun / 2.2))
      continue
    }
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
      tokens += 1.35
      i += charLen
      continue
    }
    tokens += 2.4
    i += charLen
  }
  return Math.max(1, Math.round(tokens))
}

/**
 * Extract hard engineering anchors that MUST survive prompt dehydration with zero loss.
 */
export function extractHardAnchors(text: string): string[] {
  const anchors = new Set<string>()
  const add = (raw: string): void => {
    const cleaned = raw.trim().replace(/^[`'"]+|[`'"]+$/gu, '')
    if (cleaned.length >= 1 && !/^(?:Python|Java|Go|Rust|TypeScript|JavaScript|TTL)$/iu.test(cleaned)) {
      anchors.add(cleaned)
    }
  }

  for (const m of text.matchAll(/`([^`\n]{1,120})`/gu)) {
    if (m[1] !== undefined) add(m[1])
  }
  for (const m of text.matchAll(/https?:\/\/[^\s,，。；;)"'`]+|\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{2,5})?\b/gu)) {
    add(m[0])
  }
  for (const m of text.matchAll(/(?:[A-Za-z]:[\\/]|[.~]?\/)?[\w.-]+(?:[\\/][\w.-]+)+|\b[\w-]+\.(?:py|java|ts|tsx|js|jsx|go|rs|cpp|c|h|cs|sql|json|ya?ml|toml|md|html|css|sh|ps1|bat)\b/gu)) {
    add(m[0])
  }
  for (const m of text.matchAll(/\bv?\d+(?:\.\d+)+(?:-[A-Za-z0-9.]+)?\b|\b\d+(?:\.\d+)?(?:ms|s|m|h|kb|mb|gb|tb|px|%|tok|k)\b|\b\d{2,}\b/giu)) {
    add(m[0])
  }
  for (const m of text.matchAll(/(?:>=|<=|==|!=|>|<|容量|长度|次数|重试|最多|至少|不超过|\bat\s+least|\bat\s+most|\bup\s+to)\s*(\d+)\b/giu)) {
    if (m[1] !== undefined) add(m[1])
  }
  for (const m of text.matchAll(/\b(?:[A-Z]{2,}[A-Za-z0-9_]+|[a-z]+(?:[A-Z][a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_]*\(\))/gu)) {
    add(m[0])
  }
  for (const m of text.matchAll(/(?:严禁|禁止|不要|切勿|不能)(?:使用|用|引入|依赖)?\s*([A-Za-z_][A-Za-z0-9_.]*(?:\(\))?)/gu)) {
    if (m[1] !== undefined) add(m[1])
  }

  return [...anchors]
}

export function auditHardAnchors(source: string, compiled: string): { text: string; audit: HardAnchorAudit } {
  const anchors = extractHardAnchors(source)
  const matched: string[] = []
  const missing: string[] = []
  for (const anchor of anchors) {
    if (compiled.includes(anchor)) matched.push(anchor)
    else missing.push(anchor)
  }
  const sourceHasNegation = NEGATION_PATTERN.test(source)
  let finalCompiled = compiled
  if (sourceHasNegation && !NEGATION_PATTERN.test(finalCompiled)) {
    finalCompiled += ' !ban:violate_constraint'
  }
  if (missing.length > 0) {
    finalCompiled += ` ![AnchorLock: ${missing.join(', ')}]`
  }
  const negationPreserved = !sourceHasNegation || NEGATION_PATTERN.test(finalCompiled)
  const allPresent = missing.every(item => finalCompiled.includes(item)) && negationPreserved
  return {
    text: finalCompiled,
    audit: {
      passed: allPresent,
      totalAnchors: anchors.length,
      matchedAnchors: [...matched, ...missing],
      repairedAnchors: missing,
      negationPreserved,
    },
  }
}

export function looksLikeBabelTele(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('#BT')
    || trimmed.startsWith('#Task')
    || trimmed.startsWith('#Chat[')
    || trimmed.startsWith('#SubTask')
    || trimmed.startsWith('#SubReport')
    || trimmed.startsWith('[SMFT-T1]')
    || /(?:^|\n)\s*#(?:Intent|Plan|Stack|Files|DiagFix|Next)\b/u.test(trimmed)
}

/**
 * Compile verbose/emotional Chinese OR English input into neutral, anchor-locked BT-Spec v1.0 (`bt-l2` or `bt-l3`)
 * stamped with `@out=<zh-CN|en-US>` so final delivery strictly mirrors the user's original language.
 */
export function neutralizeToBabelTele(
  raw: string,
  mode: BabelTeleCompileMode = babelTeleRuntimeConfig.mode,
  customPrefixTag?: string,
): BabelTeleNeutralizeResult {
  const trimmed = raw.trim()
  const userLanguage = detectUserLanguage(trimmed)
  const originalTokens = estimateBabelTokens(trimmed)
  const trivialChat = isTrivialConversationalInput(trimmed)

  if (trimmed.length === 0 || trimmed.startsWith('/') || looksLikeBabelTele(trimmed) || trivialChat) {
    return {
      original: raw,
      babeltele: raw,
      mode,
      userLanguage,
      originalTokens,
      babelTokens: originalTokens,
      savedTokens: 0,
      savedRatio: 0,
      strippedFillerCount: 0,
      shortCircuit: true,
      isTrivialChat: trivialChat,
      audit: {
        passed: true,
        totalAnchors: 0,
        matchedAnchors: [],
        repairedAnchors: [],
        negationPreserved: true,
      },
    }
  }

  const codeSpans: string[] = []
  let working = trimmed.replace(/`[^`\n]+`/gu, (match) => {
    const idx = codeSpans.length
    codeSpans.push(match)
    return `__BTCODE_${String(idx)}__`
  })

  let strippedFillerCount = 0
  for (const pattern of CN_FILLER_PATTERNS) {
    working = working.replace(pattern, () => {
      strippedFillerCount += 1
      return ''
    })
  }
  for (const pattern of EN_FILLER_PATTERNS) {
    working = working.replace(pattern, () => {
      strippedFillerCount += 1
      return ''
    })
  }

  for (const [pattern, replacement] of OMNILINGUAL_REWRITES) {
    working = working.replace(pattern, replacement)
  }

  // Strip zero-information English articles & verbose prepositional glue outside code spans
  working = working
    .replace(/\b(?:a|an|the)\b\s+/giu, '')
    .replace(/\bin\s+order\s+to\b/giu, 'to')

  if (mode === 'bt-l3') {
    working = working
      .replace(/(?:的|地|得|了|着|把|将|个|项|份|一下)/gu, '')
      .replace(/\s*(=>|->|&|>=|<=|!=)\s*/gu, '$1')
  }

  working = working.replace(/(!ban:[^;，。()（）]+)[（(]\s*!ban:\s*([^)）]+)[)）]/gu, '$1($2)')

  working = working
    .replace(/（/gu, '(')
    .replace(/）/gu, ')')
    .replace(/[，、；,]+/gu, mode === 'bt-l3' ? ';' : '; ')
    .replace(/(?:[。！？?]+|!(?![=禁止banexc\[]))+/gu, mode === 'bt-l3' ? '|' : ' | ')
    .replace(/(?:;\s*)*\|\s*/gu, mode === 'bt-l3' ? '|' : ' | ')
    .replace(/;\s*=>/gu, ' =>')
    .replace(/^(?:[;|]\s*)+|(?:[;|]\s*)+$/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim()

  working = working.replace(/__BTCODE_(\d+)__/gu, (_m, indexText: string) => {
    const idx = Number(indexText)
    return codeSpans[idx] ?? ''
  })

  const resolvedPrefix = customPrefixTag ?? `#Task[@out=${userLanguage}]`
  const candidate = `${resolvedPrefix} ${working.length > 0 ? working : trimmed}`
  const { text: lockedText, audit } = auditHardAnchors(trimmed, candidate)
  const babelTokens = estimateBabelTokens(lockedText)
  const savedTokens = Math.max(0, originalTokens - babelTokens)
  const savedRatio = originalTokens > 0 ? savedTokens / originalTokens : 0
  const shortCircuit = strippedFillerCount === 0 && savedTokens < 2

  return {
    original: raw,
    babeltele: lockedText,
    mode,
    userLanguage,
    originalTokens,
    babelTokens,
    savedTokens,
    savedRatio,
    strippedFillerCount,
    shortCircuit,
    isTrivialChat: false,
    audit,
  }
}

/**
 * `#BT-Bus v4` Downlink Compiler: dehydrates Parent -> Child subagent directives
 * while preserving 100% of hard anchors and stamping explicit hierarchy depth.
 */
export function compileSubagentDirective(
  rawPrompt: string,
  options: { childDepth: number; maxDepth?: number; inheritsConversation?: boolean },
): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.subagentBusCompression) return rawPrompt
  const trimmed = rawPrompt.trim()
  if (trimmed.length === 0) return rawPrompt
  const depthTag = options.maxDepth !== undefined
    ? `L${String(options.childDepth)}/${String(options.maxDepth)}`
    : `L${String(options.childDepth)}`
  const modeTag = options.inheritsConversation === true ? 'fork' : 'spawn'
  const header = `#SubTask[${depthTag}|${modeTag}]`
  if (looksLikeBabelTele(trimmed)) {
    return trimmed.startsWith('#SubTask') ? trimmed : `${header} ${trimmed}`
  }
  const compiled = neutralizeToBabelTele(trimmed, babelTeleRuntimeConfig.mode, header)
  if (!compiled.shortCircuit && compiled.audit.passed) {
    return compiled.babeltele
  }
  return `${header} ${trimmed}`
}

const SUBAGENT_POLITE_WRAPPER =
  /^(?:好的[，,！!。]*|没问题[，,！!。]*|我已经完成了[^。\n]*[。\n]+|以下是(?:详细的)?(?:审查|分析|执行)?(?:结果|报告)[：:\n]*)|(?:\n+(?:希望以上[^。\n]*|如果有任何问题[^。\n]*|请随时告诉我[^。\n]*)[。！!\s]*)$/gu

/**
 * `#BT-Bus v4` Uplink Distiller: strips conversational padding and folds verbose logs
 * from Child -> Parent `#SubReport` settlement payloads while preserving 100% of facts,
 * code snippets, `@file:line` references, and error diagnostics.
 */
export function distillSubagentReport(rawText: string): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.subagentBusCompression) return rawText
  if (rawText.length < 40) return rawText
  let distilled = compressToolOutputToBabelTele(rawText)
  distilled = distilled
    .replace(SUBAGENT_POLITE_WRAPPER, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  return distilled
}

/**
 * `[BT-SchemaCompiler v4]` Canonical high-density tool descriptions.
 * Keeps 100% of parameter ordering rules, path safety, and behavioral contracts while cutting ~2,400+ tokens of prose.
 */
const CANONICAL_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  pwsh:
    'Run PowerShell (`pwsh -Command`) in a fresh process; both stdout and stderr are captured automatically (NEVER append `2>&1` on native commands like `python -m unittest -v`, as PowerShell 5.1 converts stderr redirection to exit code 1). Pass `description` BEFORE `command`; use `workdir` instead of `cd` and Windows `C:\\...` paths.',
  bash:
    'Run bash command in a fresh shell; returns stdout/stderr/exitCode. Pass `description` BEFORE `command`; use `workdir` instead of `cd`. Verify resolved target path before any delete/move.',
  read:
    'Read UTF-8 text file (with `offset`/`limit` line slicing), image, or directory entries.',
  write:
    'Create or overwrite UTF-8 file (`file_path` BEFORE `content`). Enforces Plane-B pure code & runs `[BT-AST]` syntax check.',
  edit:
    'Exact literal replacement in UTF-8 file (`file_path` BEFORE `old_string`, `new_string`). Prefer over `write` for partial edits.',
  glob:
    'Fast glob file-path search (`**/*.py`, `src/**/*.ts`) sorted by mtime.',
  grep:
    'ripgrep regex search across files; supports `glob`/`type` filters and `output_mode` (`files_with_matches` | `content` | `count`).',
  subagent:
    'Spawn isolated child agent (`L1..L3`) on `#BT-Bus` for parallel module implementation, research, or audit. Returns child name immediately; runtime auto-delivers `#SubReport` on completion. Partition write `@path`s strictly across parallel children.',
  subagent_fork:
    'Fork child agent inheriting completed parent turns (100% warm KV-cache reuse) for parallel verification, deep audit, or delta work. State only delta `#SubTask`; runtime auto-delivers `#SubReport`.',
  send_message:
    'Send follow-up or steering message to an existing subagent in this tree.',
  list_agents:
    'Inspect subagent tree status (never poll in a loop; end turn to await auto-delivery).',
  interrupt_agent:
    'Interrupt a running descendant subagent turn.',
  job_output:
    'Read incremental output/status of background job (`wait:true` waits up to `timeout_ms`).',
  job_list:
    'List background jobs in this session.',
  job_kill:
    'Terminate a running background job by `job_id`.',
  todo_write:
    'Update structured task checklist (use only for multi-phase >=4-step tasks; skip on simple tasks).',
  workflow:
    'Execute JS multi-agent workflow script (`agent`, `parallel`) when programmatic pipeline fan-out is explicitly needed.',
  web_search:
    'Search web and return ranked results/snippets.',
  web_fetch:
    'Fetch public HTTP(S) URL content as readable text/markdown.',
  skill:
    'Load specialized `SKILL.md` instructions by skill name.',
  cd:
    'Change session working directory.',
  working_directory:
    'Change session working directory to an existing directory path.',
  wait_agent:
    'Wait for next subagent message/settlement (usually unnecessary: simply end your turn after spawning subagents and runtime auto-wakes you).',
  ask_user_question:
    'Ask user structured multiple-choice question ONLY when genuine ambiguity blocks execution.',
  create_goal:
    'Create persisted multi-round goal ONLY for long-running autonomous objectives (never for normal single-request tasks).',
  get_goal:
    'Read current persisted session goal.',
  update_goal:
    'Update persisted goal state (`edit`|`pause`|`resume`|`complete`|`blocked`).',
  team_task_create:
    'Create task on shared Agent Team board.',
  team_task_get:
    'Get shared Team task by id.',
  team_task_list:
    'List shared Team tasks.',
  team_task_update:
    'Update shared Team task status/owner.',
  list_mcp_resources:
    'List available MCP server resources.',
  list_mcp_resource_templates:
    'List MCP resource URI templates.',
  read_mcp_resource:
    'Read MCP resource by server and URI.',
  read_image:
    'Read local image file for visual inspection.',
}

const CANONICAL_SECTION_OVERRIDES: Readonly<Record<string, string>> = {
  'tool:pwsh':
    '`pwsh`: Prefer dedicated `read`/`write`/`edit`/`glob`/`grep` tools over shell equivalents. Batch independent checks; verify paths before destructive ops.',
  'tool:bash':
    '`bash`: Prefer dedicated `read`/`write`/`edit`/`glob`/`grep` tools over shell equivalents. Batch independent checks; verify paths before destructive ops.',
  'tool:jobs':
    'Background jobs auto-deliver completion notices when idle; do not poll `job_output` in a tight loop.',
  'tool:workflow':
    'Use `workflow` only when programmatic JS fan-out/aggregation over many items is superior to direct parallel `subagent` calls.',
  'tool:subagent':
    '`#BT-Bus` Delegation: Pin exact `#Contract` API signatures across parallel `subagent`/`subagent_fork` calls in ONE step with disjoint write `@path`s, then END YOUR TURN so completion `#SubReport`s wake you automatically.',
  'tool:goal':
    'Use `create_goal`/`update_goal` only for long-running multi-round objectives; rearm with `resume` if user asks to continue after session resume.',
  'tool:web_search':
    'Use `web_search` for external facts/docs not present in workspace.',
  'tool:web_fetch':
    'Use `web_fetch` to read specific public HTTP(S) URLs.',
  'team:policy':
    'Agent Teams share cwd: partition write `@path`s across teammates, claim with current revision, and use `send_message` to wake idle teammates.',
}

function compactParamDescriptionText(desc: string): string {
  const clean = desc.replace(/\s+/gu, ' ').trim()
  if (clean.length <= 120) return clean
  // Preserve ordering/required/default clauses while trimming verbose prose examples
  const sentences = clean.split(/(?<=\.)\s+/u)
  const kept: string[] = []
  let len = 0
  for (const s of sentences) {
    const critical = /\b(?:before|required|must|default|omit|relative|absolute|enum|one of)\b/iu.test(s)
    if (kept.length === 0 || (critical && len + s.length <= 240) || len + s.length <= 115) {
      kept.push(s)
      len += s.length + 1
      if (len >= 220) break
    }
  }
  return kept.join(' ')
}

function compactJsonSchemaNode(node: unknown): unknown {
  if (node === null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(compactJsonSchemaNode)
  const rec = node as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'description' && typeof v === 'string') {
      out[k] = compactParamDescriptionText(v)
    } else if (k === 'properties' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const props: Record<string, unknown> = {}
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
        props[pk] = compactJsonSchemaNode(pv)
      }
      out[k] = props
    } else if (k === 'items' || k === 'anyOf' || k === 'oneOf' || k === 'allOf') {
      out[k] = compactJsonSchemaNode(v)
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * `[BT-SchemaCompiler v4]` Deterministically compacts tool descriptions & parameter annotations.
 * Uniform across root and all child depths so provider prefix KV-cache is 100% shared!
 */
export function compactToolSchemasToBabelTele<T extends { name: string; description: string; parameters: unknown }>(
  tools: readonly T[],
): T[] {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.compactSchemasAndSections) {
    return [...tools]
  }
  return tools.map((tool) => {
    const canonical = CANONICAL_TOOL_DESCRIPTIONS[tool.name]
    const description = canonical ?? compactParamDescriptionText(tool.description)
    const parameters = compactJsonSchemaNode(tool.parameters) as T['parameters']
    return {
      ...tool,
      description,
      parameters,
    }
  })
}

/**
 * `[BT-SchemaCompiler v4]` Deduplicates overlapping identity lines and compacts verbose tool prose sections.
 */
export function compactSystemSectionsToBabelTele<T extends { name: string; text: string; interpolate?: boolean }>(
  sections: readonly T[],
): T[] {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.compactSchemasAndSections) {
    return [...sections]
  }
  const hasIdentity = sections.some(s => s.name === 'harness:identity' && s.text.trim().length > 0)
  const result: T[] = []
  for (const sec of sections) {
    if (sec.text.trim().length === 0) {
      result.push(sec)
      continue
    }
    // Drop redundant duplicate BabelTele identity in deployment:persona-prefix when harness:identity is active
    if (hasIdentity && sec.name === 'deployment:persona-prefix' && sec.text.includes('BabelTele Agent')) {
      continue
    }
    const override = CANONICAL_SECTION_OVERRIDES[sec.name]
    if (override !== undefined) {
      result.push({ ...sec, text: override, interpolate: false })
      continue
    }
    result.push(sec)
  }
  return result
}

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/gu
const UNITTEST_HEADER_ONLY = /^test_\w+\s+\([^)]+\)$/u
const UNITTEST_DOC_OK = /^.+\s+\.\.\.\s+ok$/iu
const PASSING_TEST_LINE =
  /^(?:test_\w+\s+\([^)]+\)\s+\.\.\.\s+ok|\S+::\S+\s+PASSED(?:\s+\[\s*\d+%\])?|[✓✔]\s+.+|PASS\s+\S+.*|---\s+PASS:\s+\S+.*|test\s+\S+\s+\.\.\.\s+ok|ok\s+\d+\s+-.*|\.\.\.\s*ok)$/iu
const PROGRESS_NOISE_LINE =
  /^(?:Downloading\s+\S+.*|Installing\s+collected\s+packages.*|Progress:\s+resolved\s+\d+.*|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+.*)$/iu

/**
 * Bidirectional `[BT-ToolOut v4]` Semantic Tool-Result Projector.
 * Strips ANSI escapes, folds runs of `>= 5` passing test entries (unittest 1/2-line, pytest, vitest, go, cargo)
 * and package-manager progress noise, while preserving `100%` of file `<content>`, errors, and FAIL tracebacks.
 */
export function compressToolOutputToBabelTele(rawText: string): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.compressToolResults) return rawText
  if (rawText.length < 220 || rawText.includes('<type>file</type>')) return rawText

  const cleaned = rawText.replace(ANSI_ESCAPE, '').replace(/\r\n/gu, '\n').replace(/\n{4,}/gu, '\n\n')
  const lines = cleaned.split('\n')
  const out: string[] = []
  let passBuffer: string[] = []
  let progressCount = 0

  const flushPassBuffer = (): void => {
    if (passBuffer.length >= 5) {
      const first = passBuffer[0] ?? ''
      const last = passBuffer[passBuffer.length - 1] ?? ''
      out.push(first)
      out.push(`[BT-TestPass: folded ${String(passBuffer.length - 2)} intermediate passing tests]`)
      out.push(last)
    } else {
      out.push(...passBuffer)
    }
    passBuffer = []
  }

  const flushProgress = (): void => {
    if (progressCount >= 3) {
      out.push(`[BT-LogFold: ${String(progressCount)} progress lines omitted]`)
    }
    progressCount = 0
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const nextLine = lines[i + 1]
    const nextTrimmed = nextLine?.trim() ?? ''

    if (PROGRESS_NOISE_LINE.test(trimmed)) {
      if (passBuffer.length > 0) flushPassBuffer()
      progressCount += 1
      continue
    }
    if (progressCount > 0) flushProgress()

    if (
      UNITTEST_HEADER_ONLY.test(trimmed)
      && nextLine !== undefined
      && UNITTEST_DOC_OK.test(nextTrimmed)
      && !/\b(?:FAIL|ERROR)\b/u.test(nextTrimmed)
    ) {
      passBuffer.push(`${trimmed} ... ok`)
      i += 1
      continue
    }

    if (PASSING_TEST_LINE.test(trimmed)) {
      passBuffer.push(line)
      continue
    }
    if (passBuffer.length > 0) flushPassBuffer()
    out.push(line)
  }
  if (progressCount > 0) flushProgress()
  if (passBuffer.length > 0) flushPassBuffer()

  return out.join('\n')
}

export function decodeBabelTeleToZh(text: string): string {
  if (text.trim().length === 0) return text
  return text
    .replace(/\[SMFT-T1\]/gu, '[语义检查点 SMFT-T1]')
    .replace(/\[BT-TestPass:\s*([^\]]+)\]/gu, '[测试通过摘要：$1]')
    .replace(/\[BT-LogFold:\s*([^\]]+)\]/gu, '[日志折叠：$1]')
    .replace(/^#BT\b\s*/gmu, '[巴别语推理] ')
    .replace(/^#Task\b\s*/gmu, '[工程任务] ')
    .replace(/^#SubTask(?:\[[^\]]*\])?\s*/gmu, '[子任务委派] ')
    .replace(/^#SubReport\b\s*/gmu, '[子任务回执] ')
    .replace(/^#Intent\b\s*:?\s*/gmu, '• 核心意图：')
    .replace(/^#Plan\b\s*:?\s*/gmu, '• 执行计划：')
    .replace(/^#Stack\b\s*:?\s*/gmu, '• 技术栈与约束：')
    .replace(/^#Files\b\s*:?\s*/gmu, '• 涉及文件状态：')
    .replace(/^#DiagFix\b\s*:?\s*/gmu, '• 故障定位与修复：')
    .replace(/^#Pending\b\s*:?\s*/gmu, '• 待办事项：')
    .replace(/^#Next\b\s*:?\s*/gmu, '• 下一步动作：')
    .replace(/@cwd\b/gu, '当前目录')
    .replace(/\bparallel_spawn\b/gu, '[并行派发]')
    .replace(/\bhier_subagents\b/gu, '[多级子代理]')
    .replace(/\+typed\b/gu, '[含类型注解]')
    .replace(/\+threadsafe\b/gu, '[线程安全]')
    .replace(/\+stdlib_only\b/gu, '[仅标准库]')
    .replace(/\butest\b/gu, '单元测试')
    .replace(/=>pass\b/gu, ' ⇒ 验证通过')
    .replace(/!\[AnchorLock:\s*([^\]]+)\]/gu, '（硬锚点锁定：$1）')
    .replace(/!(?:禁止|ban):/gu, '[严禁] ')
    .replace(/!exc:/gu, '[豁免] ')
    .replace(/\s*=>\s*/gu, ' ⇒ ')
    .replace(/\s*->\s*/gu, ' → ')
    .replace(/\s*&\s*/gu, ' 且 ')
    .replace(/(^|[\s;])(\?)([^\s?])/gu, '$1若：$3')
}

const OUTER_MARKDOWN_FENCE = /^```[A-Za-z0-9_+-]*\r?\n([\s\S]*?)\r?\n```\s*$/u

const LEAKED_PROTOCOL_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[⟦⟧⊕⊗⊘⊢⊣]/u, 'non-ASCII BabelTele algebra glyph (⟦ ⟧ ⊕ ⊗ ⊢)'],
  [/\[SMFT-T1\]/u, '[SMFT-T1] compaction header inside source code'],
  [/!\[AnchorLock:/u, '![AnchorLock:...] prompt anchor tag inside source code'],
  [/^\s*#(?:BT|SubTask|SubReport)\b/mu, '#BT/#SubTask/#SubReport protocol directive line inside source code'],
]

const btHeaderCache = new Map<string, { fingerprint: string; snapshot: string }>()

export function invalidateBtHeaderCache(): void {
  btHeaderCache.clear()
}

export function sanitizeCodeArtifact(filePath: string, content: string): { content: string; audit: CodePurityAudit } {
  invalidateBtHeaderCache()
  const ext = extname(filePath).toLowerCase()
  const isCodeFile = CODE_FILE_EXTENSIONS.has(ext)
  if (!isCodeFile || !babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.strictPlaneBGuard) {
    return {
      content,
      audit: { pure: true, isCodeFile, strippedMarkdownFence: false, violations: [] },
    }
  }

  let sanitized = content
  let strippedMarkdownFence = false
  const fenceMatch = OUTER_MARKDOWN_FENCE.exec(sanitized.trim())
  if (fenceMatch?.[1] !== undefined) {
    sanitized = `${fenceMatch[1]}\n`
    strippedMarkdownFence = true
  }

  const violations: string[] = []
  for (const [pattern, reason] of LEAKED_PROTOCOL_MARKERS) {
    if (pattern.test(sanitized)) violations.push(reason)
  }

  return {
    content: sanitized,
    audit: {
      pure: violations.length === 0,
      isCodeFile,
      strippedMarkdownFence,
      violations,
    },
  }
}

export function auditCodeArtifactPurity(filePath: string, newString: string): CodePurityAudit {
  invalidateBtHeaderCache()
  const ext = extname(filePath).toLowerCase()
  const isCodeFile = CODE_FILE_EXTENSIONS.has(ext)
  if (!isCodeFile || !babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.strictPlaneBGuard) {
    return { pure: true, isCodeFile, strippedMarkdownFence: false, violations: [] }
  }
  const violations: string[] = []
  for (const [pattern, reason] of LEAKED_PROTOCOL_MARKERS) {
    if (pattern.test(newString)) violations.push(reason)
  }
  return {
    pure: violations.length === 0,
    isCodeFile,
    strippedMarkdownFence: false,
    violations,
  }
}

const MERGE_CONFLICT_MARKER = /^(?:<<<<<<< |=======$|>>>>>>> )/mu

/**
 * `[BT-Diag v4]` Pre-Flight Closed-Loop AST & Syntax Verifier.
 * Runs side-effect-free syntax parsing (`< 35ms`) immediately after `write` or `edit`
 * so syntax/indentation errors are surfaced in the same turn with zero extra shell round-trips.
 */
export function verifyCodeArtifactSyntax(filePath: string, content: string): CodeSyntaxDiag {
  const lineCount = content.length === 0 ? 0 : content.split('\n').length
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.preflightAstCheck) {
    return { checked: false, valid: true, lineCount, tag: '' }
  }
  const ext = extname(filePath).toLowerCase()
  if (!CODE_FILE_EXTENSIONS.has(ext)) {
    return { checked: false, valid: true, lineCount, tag: `[L=${String(lineCount)}]` }
  }

  if (MERGE_CONFLICT_MARKER.test(content)) {
    return {
      checked: true,
      valid: false,
      lineCount,
      tag: `[BT-Diag CONFLICT_MARKER: unresolved <<<<<<< / >>>>>>> marker in ${filePath} — fix immediately via edit]`,
    }
  }

  if (ext === '.json') {
    try {
      JSON.parse(content)
      return { checked: true, valid: true, lineCount, tag: `[L=${String(lineCount)}, JSON:ok]` }
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/\s+/gu, ' ').slice(0, 140) : 'invalid JSON'
      return {
        checked: true,
        valid: false,
        lineCount,
        tag: `[BT-Diag SYNTAX_ERROR: ${msg} — fix immediately via edit]`,
      }
    }
  }

  if (ext === '.py') {
    try {
      const py = spawnSync(
        'python',
        [
          '-c',
          'import ast,sys\ntry:\n ast.parse(sys.stdin.buffer.read(), sys.argv[1])\nexcept SyntaxError as e:\n sys.stderr.write(f"line {e.lineno}:{e.offset}: {e.msg}"); sys.exit(2)',
          filePath,
        ],
        {
          input: content,
          encoding: 'utf8',
          timeout: 1500,
          windowsHide: true,
        },
      )
      if (py.status === 0) {
        return { checked: true, valid: true, lineCount, tag: `[L=${String(lineCount)}, AST:ok]` }
      }
      if (py.status === 2 && py.stderr) {
        return {
          checked: true,
          valid: false,
          lineCount,
          tag: `[BT-Diag SYNTAX_ERROR @${py.stderr.trim().slice(0, 160)} — fix immediately via edit]`,
        }
      }
    } catch {
      // Python binary absent or timed out: degrade gracefully without false alarm.
    }
  }

  if ((ext === '.js' || ext === '.mjs' || ext === '.cjs') && existsSync(filePath)) {
    try {
      const chk = spawnSync(process.execPath, ['--check', filePath], {
        encoding: 'utf8',
        timeout: 1500,
        windowsHide: true,
      })
      if (chk.status === 0) {
        return { checked: true, valid: true, lineCount, tag: `[L=${String(lineCount)}, AST:ok]` }
      }
      if (chk.status !== null && chk.status !== 0) {
        const errLine = (chk.stderr || '').split(/\r?\n/u).find(l => l.includes('SyntaxError') || l.includes(':')) ?? 'SyntaxError'
        return {
          checked: true,
          valid: false,
          lineCount,
          tag: `[BT-Diag SYNTAX_ERROR: ${errLine.trim().slice(0, 160)} — fix immediately via edit]`,
        }
      }
    } catch {
      // Ignore check spawn errors smoothly.
    }
  }

  return { checked: false, valid: true, lineCount, tag: `[L=${String(lineCount)}]` }
}

/**
 * Extract top-level symbols WITH 1-based line coordinates (`Sym@line`) so root & subagents
 * jump straight to exact line ranges without exploratory `grep` or full-file `read`.
 */
function extractFileSignaturesWithLines(content: string, ext: string): string[] {
  const lines = content.split(/\r?\n/u)
  const topLevel: string[] = []
  const fallbackIndented: string[] = []

  for (let idx = 0; idx < lines.length; idx += 1) {
    if (topLevel.length >= 14) break
    const line = lines[idx] ?? ''
    const lineNo = idx + 1
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue
    const isUnindented = line.charCodeAt(0) !== 32 && line.charCodeAt(0) !== 9

    if (ext === '.py') {
      if (!isUnindented) continue
      const m = /^(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(`${m[1]}@${String(lineNo)}`)
    } else if (ext === '.java' || ext === '.kt' || ext === '.cs') {
      const m = /^(?:public|protected|private|internal|abstract|final|static|sealed|\s)*(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) {
        const entry = `${m[1]}@${String(lineNo)}`
        if (isUnindented) topLevel.push(entry)
        else if (fallbackIndented.length < 14) fallbackIndented.push(entry)
      }
    } else if (ext === '.go') {
      if (!isUnindented) continue
      const m = /^(?:func|type)\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(`${m[1]}@${String(lineNo)}`)
    } else if (ext === '.rs') {
      if (!isUnindented) continue
      const m = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(`${m[1]}@${String(lineNo)}`)
    } else {
      if (!isUnindented) continue
      const m = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(`${m[1]}@${String(lineNo)}`)
    }
  }

  return topLevel.length > 0 ? topLevel : fallbackIndented
}

/**
 * Scan workspace into a shared, `mtime`-fingerprinted `[BT-Headers v4.0]` Repo-Graph with `Symbol@Line` coordinates.
 * Shared across the root agent and all in-process `L1..L3` subagents at `O(1)` memory cost.
 */
export function scanWorkspaceBtHeaders(cwd: string, maxFiles = 32): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.injectBtHeaders) return ''
  if (!existsSync(cwd)) return ''

  let topEntries: string[] = []
  try {
    topEntries = readdirSync(cwd).filter(name => !name.startsWith('.') && !SCAN_SKIP_DIRS.has(name))
  } catch {
    return ''
  }
  if (topEntries.length === 0) {
    return '[BT-Headers v4.0 Repo-Graph]\n@cwd=(empty_directory, 0 files — skip glob/ls and write target files directly)'
  }

  const discovered: Array<{ fullPath: string; rel: string; size: number; mtimeMs: number; ext: string }> = []
  const nonCodeFiles: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: cwd, depth: 0 }]

  while (queue.length > 0 && discovered.length < maxFiles) {
    const current = queue.shift()
    if (current === undefined) break
    let dirItems: string[]
    try {
      dirItems = readdirSync(current.dir)
    } catch {
      continue
    }
    dirItems.sort()
    for (const item of dirItems) {
      if (discovered.length >= maxFiles) break
      if (item.startsWith('.') && item !== '.env.example') continue
      if (SCAN_SKIP_DIRS.has(item)) continue
      const fullPath = join(current.dir, item)
      let st
      try {
        st = statSync(fullPath)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (current.depth < 3) queue.push({ dir: fullPath, depth: current.depth + 1 })
        continue
      }
      if (!st.isFile() || st.size > 131072) continue
      const ext = extname(item).toLowerCase()
      const rel = relative(cwd, fullPath).replaceAll('\\', '/')
      if (!SCAN_SOURCE_EXTENSIONS.has(ext)) {
        if (current.depth === 0 && nonCodeFiles.length < 10) nonCodeFiles.push(rel)
        continue
      }
      discovered.push({
        fullPath,
        rel,
        size: st.size,
        mtimeMs: Math.trunc(st.mtimeMs),
        ext,
      })
    }
  }

  const fingerprint = `${discovered.map(f => `${f.rel}:${String(f.size)}:${String(f.mtimeMs)}`).join('|')}#${nonCodeFiles.join(',')}`
  const cached = btHeaderCache.get(cwd)
  if (cached?.fingerprint === fingerprint) return cached.snapshot

  const entries: string[] = []
  for (const file of discovered) {
    try {
      const text = readFileSync(file.fullPath, 'utf8')
      const lineCount = text.split('\n').length
      const sigs = extractFileSignaturesWithLines(text, file.ext)
      entries.push(sigs.length > 0
        ? `@${file.rel}(L=${String(lineCount)}):[${sigs.join(',')}]`
        : `@${file.rel}(L=${String(lineCount)})`)
    } catch {
      // Ignore unreadable files smoothly.
    }
  }
  if (entries.length === 0 && nonCodeFiles.length > 0) {
    const snapshot = `[BT-Headers v4.0 Repo-Graph]\n@cwd(non_source_files=[${nonCodeFiles.join(',')}], 0 code files)`
    btHeaderCache.set(cwd, { fingerprint, snapshot })
    return snapshot
  }

  const snapshot = entries.length === 0
    ? ''
    : `[BT-Headers v4.0 Repo-Graph]\n${entries.join(' ; ')}`
  btHeaderCache.set(cwd, { fingerprint, snapshot })
  return snapshot
}
