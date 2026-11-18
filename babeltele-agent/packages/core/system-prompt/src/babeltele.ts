/**
 * Built-in BabelTele (BT-Spec v1.0 · V3 Omnilingual & Zero-Probe Engine).
 *
 * Capabilities:
 * 1. Omnilingual Semantic Compiler (`bt-l2` balanced / `bt-l3` skeleton) with 85+ engineering collapses
 * 2. Tier-1 Hard-Anchor Lock (100% retention of paths, numbers, symbols, and negations)
 * 3. Trivial Greeting Fast-Path Classifier (`#Chat[fast]`)
 * 4. Bidirectional `[BT-ToolOut]` Tool-Result Compressor (folds repetitive test/log noise, preserves 100% errors)
 * 5. Zero-Probe `mtime`-fingerprinted `[BT-Headers v3.0]` Workspace Skeleton (including explicit `@cwd=(empty)`)
 * 6. Plane-B Native Code Sanitizer & Purity Gate
 *
 * @module @deepseek-ai/dsh-system-prompt/babeltele
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

export type BabelTeleCompileMode = 'bt-l2' | 'bt-l3'

/** Live runtime switches for built-in BabelTele subsystems. */
export interface BabelTeleRuntimeConfig {
  enabled: boolean
  mode: BabelTeleCompileMode
  autoDehydrateModelInput: boolean
  compressToolResults: boolean
  injectBtHeaders: boolean
  strictPlaneBGuard: boolean
}

export const babelTeleRuntimeConfig: BabelTeleRuntimeConfig = {
  enabled: process.env.BABELTELE_DISABLED !== '1',
  mode: process.env.BABELTELE_MODE === 'bt-l3' ? 'bt-l3' : 'bt-l2',
  autoDehydrateModelInput: process.env.BABELTELE_NO_AUTO_DEHYDRATE !== '1',
  compressToolResults: process.env.BABELTELE_NO_TOOL_COMPRESS !== '1',
  injectBtHeaders: process.env.BABELTELE_NO_BT_HEADERS !== '1',
  strictPlaneBGuard: process.env.BABELTELE_NO_PLANE_B_GUARD !== '1',
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

/**
 * Core Dual-Plane Silicon Kernel V3 registered natively in `SystemPrompt`.
 */
export const BABELTELE_DUAL_PLANE_KERNEL_PROMPT = [
  '## BabelTele Dual-Plane Kernel (BT-Spec v1.0 · V3 Single-Pass Execution)',
  '1. **Plane A — Micro-Graph `#BT` Reasoning & Zero-Waste Execution**:',
  '   - **Fast-Path Greetings (`#Chat[fast]`)**: When user input is a greeting or simple question needing no workspace tools, keep `thinking <= 15` words, call **0 tools**, and reply directly.',
  '   - **Strict CoT Budget (`<= 8` `#BT` lines)**: In `thinking`, emit ONLY compact `#BT` state/invariant transitions (`?cond => guard`, `->`, `&`, `!ban:`, `@file`). **NEVER draft source code, docstrings, or test bodies inside `thinking`** — write code ONCE directly in `write` / `edit`.',
  '   - **Zero Blind Probing**: Runtime context `[BT-Headers v3.0]` already provides live `@cwd` file inventory (`@cwd=(empty)` or `@file(L=n):[symbols]`). Do NOT waste a step calling `glob` / `pwsh ls` just to check what files exist.',
  '   - **Parallel Batch Tooling**: Emit ALL independent tool calls in a **single assistant step** (e.g. emit `write module.py` AND `write test_module.py` together in Step 1, then run `pwsh` test verification in Step 2).',
  '2. **Plane B — 100% Pure Native Code Invariant (Zero Disk Pollution)**:',
  '   - Every file written or edited via `write`, `edit`, `apply_patch`, or shell scripts MUST be **100% pure, idiomatic target-language code** (`.py`, `.java`, `.ts`, `.tsx`, `.go`, `.rs`, `.cpp`, `.sql`, etc.).',
  '   - NEVER leak `#BT`, `[SMFT-T1]`, `![AnchorLock:`, or non-ASCII protocol glyphs (`⟦`, `⟧`, `⊕`, `⊗`) into source files.',
  '3. **Human Response Surface**:',
  '   - Deliver final user-facing answers concisely in natural language matching the user\'s language (default Chinese when prompted in Chinese), unless raw `#BT` is requested.',
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
  /^(?:hi|hello|hey)(?:\s+there)?[,!.\s]+/giu,
  /\b(?:could you please|would you kindly|can you please|please kindly|i would really appreciate it if you could|sorry to bother you(?:,?\s*but)?)\s+/giu,
  /\b(?:i am going crazy|this is driving me nuts|i'm so frustrated)[,!.\s]*/giu,
  /[,\s]*(?:thank you so much|thanks a lot|many thanks|thanks in advance)[.!~\s]*$/giu,
]

/**
 * V3 Omnilingual Semantic Collapse Table (Axiom 1: cross-lingual minimum-BPE primitives).
 */
const OMNILINGUAL_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  // Spatial & execution scope
  [/在当前(?:工作区|目录|文件夹|项目)(?:下|中|里)?(?:创建|新建|编写|写)一个(?:完整的|标准的)?/gu, '@cwd impl '],
  [/在当前(?:工作区|目录|文件夹|项目)(?:下|中|里)?/gu, '@cwd '],
  [/(?:创建|新建|编写|实现)一个(?:完整的|标准的)?/gu, 'impl '],
  [/单文件/gu, '1-file '],
  [/调用(?:命令行|终端)(?:运行|执行)/gu, 'run '],
  [/(?:运行|执行)验证(?:全部)?通过|验证全部通过|确保测试(?:全部)?通过|确认全部通过/gu, '=>pass'],
  [/不要解释(?:任何)?废话|不需要解释|只输出纯?代码(?:块)?/gu, 'code_only'],
  // Engineering qualifiers
  [/包含类型注解|加上类型注解|带类型注解|完整类型注解/gu, '+typed'],
  [/线程安全的?|并发安全的?/gu, '+threadsafe '],
  [/仅使用标准库|只用标准库|纯标准库/gu, '+stdlib_only'],
  [/第三方(?:依赖|库|包)/gu, '3rd-party'],
  [/单元测试文件/gu, 'utest_file '],
  [/单元测试(?:用例)?/gu, 'utest'],
  [/(\d+)\s*个\s*utest/gu, '$1 utest'],
  [/边界(?:条件|情况|测试)|极端情况/gu, 'edge_cases'],
  [/异常(?:处理|捕获)|错误处理/gu, 'err_guard'],
  [/时间复杂度(?:要求)?(?:为|是)?/gu, 'T:'],
  [/空间复杂度(?:要求)?(?:为|是)?/gu, 'S:'],
  // High-frequency algorithmic & systems concepts
  [/滑动窗口限流(?:器|模块)?/gu, 'sliding_win_limiter'],
  [/滑动窗口/gu, 'sliding_win'],
  [/令牌桶限流(?:器|模块)?|令牌桶/gu, 'token_bucket'],
  [/优先级?(?:任务)?队列/gu, 'prio_queue'],
  [/指数退避(?:重试)?/gu, 'exp_backoff'],
  [/惰性删除|懒删除/gu, 'lazy_del'],
  [/双向链表/gu, 'DLL'],
  [/过期时间/gu, 'TTL'],
  [/容量上限|最大容量/gu, 'max_cap'],
  [/快速排序/gu, 'quicksort'],
  [/二分查找/gu, 'bin_search'],
  // Logical & relational operators (1-token ASCII)
  [/如果(?:出现|发生|遇到|存在)?/gu, '?'],
  [/假如|若是|当(?=.*时)/gu, '?'],
  [/那么就?|则(?:需要|必须|应当)?|然后(?:再)?|最后(?:再)?(?=.*(?:调用|运行|执行|验证|汇总|输出))/gu, ' => '],
  [/并且(?:还要|需要)?|同时(?:还要|需要)?|而且(?:还要)?|以及/gu, ' & '],
  [/或者|或是/gu, ' | '],
  [/千万不要|绝对不要|严禁使用|严禁|禁止使用|禁止|切勿|绝不能|不要使用|不要用|不能用|别用/gu, '!ban:'],
  [/除了(?=.*(?:以外|之外))/gu, '!exc:'],
  [/(?:以外|之外)/gu, ''],
  [/大于等于|不少于|不低于|至少为?/gu, '>='],
  [/小于等于|不超过|不高于|最多为?/gu, '<='],
  [/不等于/gu, '!='],
  [/导致了?|从而|进而|输出到|转换为|转成|并返回|返回/gu, '->'],
  [/需要你?(?:去)?|请你?(?:去)?|帮我(?:去)?/gu, ''],
]

const NEGATION_PATTERN = /(?:!ban:|!禁止:|不要|禁止|严禁|切勿|不能|不可|别用|禁止使用|\b(?:never|do\s+not|don't|must\s+not|without|forbid(?:den)?)\b)/iu

/** Detect trivial greetings/meta-questions that need zero tool exploration and minimal thinking. */
export function isTrivialConversationalInput(text: string): boolean {
  const t = text.trim()
  if (t.length === 0 || t.length > 28 || t.startsWith('/') || !/[\p{L}\p{N}]/u.test(t)) return false
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
  for (const m of text.matchAll(/(?:>=|<=|==|!=|>|<|容量|长度|次数|重试|最多|至少|不超过)\s*(\d+)\b/gu)) {
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
    || trimmed.startsWith('#Task ')
    || trimmed.startsWith('#Chat[')
    || trimmed.startsWith('#SubTask ')
    || trimmed.startsWith('#SubReport ')
    || trimmed.startsWith('[SMFT-T1]')
    || /(?:^|\n)\s*#(?:Intent|Plan|Stack|Files|DiagFix|Next)\b/u.test(trimmed)
}

/**
 * Compile verbose/emotional human input into neutral, anchor-locked BT-Spec v1.0 (`bt-l2` or `bt-l3`).
 */
export function neutralizeToBabelTele(
  raw: string,
  mode: BabelTeleCompileMode = babelTeleRuntimeConfig.mode,
): BabelTeleNeutralizeResult {
  const trimmed = raw.trim()
  const originalTokens = estimateBabelTokens(trimmed)
  const trivialChat = isTrivialConversationalInput(trimmed)

  if (trimmed.length === 0 || trimmed.startsWith('/') || looksLikeBabelTele(trimmed) || trivialChat) {
    return {
      original: raw,
      babeltele: raw,
      mode,
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

  // In BT-L3 Ultra-Dense Skeleton mode, strip low-entropy Chinese grammatical particles & compact operator spaces.
  if (mode === 'bt-l3') {
    working = working
      .replace(/(?:的|地|得|了|着|把|将|个|项|份|一下)/gu, '')
      .replace(/\s*(=>|->|&|>=|<=|!=)\s*/gu, '$1')
  }

  working = working.replace(/(!ban:[^;，。()（）]+)[（(]\s*!ban:\s*([^)）]+)[)）]/gu, '$1($2)')

  working = working
    .replace(/（/gu, '(')
    .replace(/）/gu, ')')
    .replace(/[，、；]+/gu, mode === 'bt-l3' ? ';' : '; ')
    .replace(/(?:[。！？]+|!(?![=禁止banexc\[]))+/gu, mode === 'bt-l3' ? '|' : ' | ')
    .replace(/(?:;\s*)*\|\s*/gu, mode === 'bt-l3' ? '|' : ' | ')
    .replace(/^(?:[;|]\s*)+|(?:[;|]\s*)+$/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim()

  working = working.replace(/__BTCODE_(\d+)__/gu, (_m, indexText: string) => {
    const idx = Number(indexText)
    return codeSpans[idx] ?? ''
  })

  const candidate = `#Task ${working.length > 0 ? working : trimmed}`
  const { text: lockedText, audit } = auditHardAnchors(trimmed, candidate)
  const babelTokens = estimateBabelTokens(lockedText)
  const savedTokens = Math.max(0, originalTokens - babelTokens)
  const savedRatio = originalTokens > 0 ? savedTokens / originalTokens : 0
  const shortCircuit = strippedFillerCount === 0 && savedTokens < 2

  return {
    original: raw,
    babeltele: lockedText,
    mode,
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

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/gu
const UNITTEST_HEADER_ONLY = /^test_\w+\s+\([^)]+\)$/u
const UNITTEST_DOC_OK = /^.+\s+\.\.\.\s+ok$/iu
const PASSING_TEST_LINE =
  /^(?:test_\w+\s+\([^)]+\)\s+\.\.\.\s+ok|\S+::\S+\s+PASSED(?:\s+\[\s*\d+%\])?|[✓✔]\s+.+|PASS\s+\S+.*|ok\s+\d+\s+-.*|\.\.\.\s*ok)$/iu

/**
 * Bidirectional `[BT-ToolOut]` Semantic Tool-Result Compressor.
 * Strips ANSI escapes, collapses runs of `>= 5` passing test entries (both single-line
 * and two-line Python `unittest -v` docstring pairs, `pytest -v`, `vitest`) into a single
 * `[BT-TestPass: folded N intermediate passing tests]` summary, while preserving 100% of
 * file `<content>` blocks, errors, FAIL tracebacks, and final status lines.
 */
export function compressToolOutputToBabelTele(rawText: string): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.compressToolResults) return rawText
  if (rawText.length < 240 || rawText.includes('<type>file</type>')) return rawText

  const cleaned = rawText.replace(ANSI_ESCAPE, '').replace(/\r\n/gu, '\n')
  const lines = cleaned.split('\n')
  const out: string[] = []
  let passBuffer: string[] = []

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

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const nextLine = lines[i + 1]
    const nextTrimmed = nextLine?.trim() ?? ''

    // Two-line Python `unittest -v` docstring pair: `test_foo (mod.Cls.test_foo)` + `Docstring ... ok`
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
  if (passBuffer.length > 0) flushPassBuffer()

  return out.join('\n')
}

export function decodeBabelTeleToZh(text: string): string {
  if (text.trim().length === 0) return text
  return text
    .replace(/\[SMFT-T1\]/gu, '[语义检查点 SMFT-T1]')
    .replace(/\[BT-TestPass:\s*([^\]]+)\]/gu, '[测试通过摘要：$1]')
    .replace(/^#BT\b\s*/gmu, '[巴别语推理] ')
    .replace(/^#Task\b\s*/gmu, '[工程任务] ')
    .replace(/^#SubTask\b\s*/gmu, '[子任务委派] ')
    .replace(/^#SubReport\b\s*/gmu, '[子任务回执] ')
    .replace(/^#Intent\b\s*:?\s*/gmu, '• 核心意图：')
    .replace(/^#Plan\b\s*:?\s*/gmu, '• 执行计划：')
    .replace(/^#Stack\b\s*:?\s*/gmu, '• 技术栈与约束：')
    .replace(/^#Files\b\s*:?\s*/gmu, '• 涉及文件状态：')
    .replace(/^#DiagFix\b\s*:?\s*/gmu, '• 故障定位与修复：')
    .replace(/^#Pending\b\s*:?\s*/gmu, '• 待办事项：')
    .replace(/^#Next\b\s*:?\s*/gmu, '• 下一步动作：')
    .replace(/@cwd\b/gu, '当前目录')
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

function extractFileSignatures(content: string, ext: string): string[] {
  const lines = content.split(/\r?\n/u)
  const topLevel: string[] = []
  const fallbackIndented: string[] = []

  for (const line of lines) {
    if (topLevel.length >= 12) break
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue
    const isUnindented = line.charCodeAt(0) !== 32 && line.charCodeAt(0) !== 9

    if (ext === '.py') {
      if (!isUnindented) continue
      const m = /^(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(m[1])
    } else if (ext === '.java' || ext === '.kt' || ext === '.cs') {
      const m = /^(?:public|protected|private|internal|abstract|final|static|sealed|\s)*(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) {
        if (isUnindented) topLevel.push(m[1])
        else if (fallbackIndented.length < 12) fallbackIndented.push(m[1])
      }
    } else if (ext === '.go') {
      if (!isUnindented) continue
      const m = /^(?:func|type)\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(m[1])
    } else if (ext === '.rs') {
      if (!isUnindented) continue
      const m = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(m[1])
    } else {
      if (!isUnindented) continue
      const m = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(line)
      if (m?.[1] !== undefined) topLevel.push(m[1])
    }
  }

  return topLevel.length > 0 ? topLevel : fallbackIndented
}

/**
 * Scan workspace into a Zero-Probe `[BT-Headers v3.0]` architectural index.
 * Explicitly emits `@cwd=(empty, 0 files)` when empty so the Agent skips blind `glob`/`ls` step-1 probes!
 */
export function scanWorkspaceBtHeaders(cwd: string, maxFiles = 28): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.injectBtHeaders) return ''
  if (!existsSync(cwd)) return ''

  let topEntries: string[] = []
  try {
    topEntries = readdirSync(cwd).filter(name => !name.startsWith('.') && !SCAN_SKIP_DIRS.has(name))
  } catch {
    return ''
  }
  if (topEntries.length === 0) {
    return '[BT-Headers v3.0 Workspace Skeleton]\n@cwd=(empty_directory, 0 files — skip glob/ls and write target files directly)'
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
      const sigs = extractFileSignatures(text, file.ext)
      entries.push(sigs.length > 0
        ? `@${file.rel}(L=${String(lineCount)}):[${sigs.join(',')}]`
        : `@${file.rel}(L=${String(lineCount)})`)
    } catch {
      // Ignore unreadable files smoothly.
    }
  }
  if (entries.length === 0 && nonCodeFiles.length > 0) {
    const snapshot = `[BT-Headers v3.0 Workspace Skeleton]\n@cwd(non_source_files=[${nonCodeFiles.join(',')}], 0 code files)`
    btHeaderCache.set(cwd, { fingerprint, snapshot })
    return snapshot
  }

  const snapshot = entries.length === 0
    ? ''
    : `[BT-Headers v3.0 Workspace Skeleton]\n${entries.join(' ; ')}`
  btHeaderCache.set(cwd, { fingerprint, snapshot })
  return snapshot
}
