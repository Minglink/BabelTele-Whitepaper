/**
 * Built-in BabelTele (BT-Spec v1.0) Dual-Plane Silicon Protocol Engine (V2).
 *
 * Includes:
 * - Plane-A CoT Token-Discipline Kernel (eliminates double-coding in `<think>`)
 * - Omni-Lexical User Prompt Dehydrator V2 + Complete Tier-1 Hard-Anchor Lock
 * - Real-time `mtime`-fingerprinted, top-level AST `[BT-Headers v2.0]` workspace skeleton
 * - Sidecar Human-Language Decoder
 * - Plane-B Native Code Sanitizer & Purity Gate
 *
 * @module @deepseek-ai/dsh-system-prompt/babeltele
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

/** Live runtime switches for built-in BabelTele subsystems. */
export interface BabelTeleRuntimeConfig {
  enabled: boolean
  autoDehydrateModelInput: boolean
  injectBtHeaders: boolean
  strictPlaneBGuard: boolean
}

export const babelTeleRuntimeConfig: BabelTeleRuntimeConfig = {
  enabled: process.env.BABELTELE_DISABLED !== '1',
  autoDehydrateModelInput: process.env.BABELTELE_NO_AUTO_DEHYDRATE !== '1',
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

/** Result of compiling natural human input into neutral BT-Spec v1.0 (`BT-L2`). */
export interface BabelTeleNeutralizeResult {
  readonly original: string
  readonly babeltele: string
  readonly originalTokens: number
  readonly babelTokens: number
  readonly savedTokens: number
  readonly savedRatio: number
  readonly strippedFillerCount: number
  readonly shortCircuit: boolean
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
 * Core Dual-Plane Silicon Kernel V2 registered natively in `SystemPrompt`.
 * Enforces strict CoT token discipline (zero redundant code drafting inside `<think>`),
 * parallel tool batching, and 100% pure Plane-B code output.
 */
export const BABELTELE_DUAL_PLANE_KERNEL_PROMPT = [
  '## BabelTele Dual-Plane Kernel (BT-Spec v1.0 · V2 High-Velocity)',
  '1. **Plane A — Micro-Graph `#BT` Reasoning (Strict CoT Token Discipline)**:',
  '   - Keep internal `thinking` ultra-compact using 1-token ASCII BT-L2 (`#BT`, `?cond => action`, `->`, `&`, `!ban:`, `@file(L=n)`).',
  '   - **NEVER draft full source code, docstrings, or test bodies inside `thinking`** — decide invariants & edge cases in `<= 10` terse `#BT` lines, then write complete code ONCE directly in `write` / `edit` or your final answer.',
  '   - Example `thinking`: `#BT @lru.py: DLL+dict O(1) ?cap<1=>ValueError & !ban:functools.lru_cache -> batch(write lru.py, write test_lru.py)`.',
  '   - **Batch independent tool calls** (`read`, `glob`, `grep`, `write`, `subagent`) in a single assistant turn whenever they do not depend on each other\'s output.',
  '2. **Plane B — 100% Pure Native Code Invariant (Zero Disk Pollution)**:',
  '   - Every file written or edited via `write`, `edit`, `apply_patch`, or shell scripts MUST be **100% pure, idiomatic target-language code** (`.py`, `.java`, `.ts`, `.tsx`, `.go`, `.rs`, `.cpp`, `.sql`, etc.).',
  '   - NEVER emit `#BT`, `[SMFT-T1]`, `![AnchorLock:`, or non-ASCII protocol glyphs (`⟦`, `⟧`, `⊕`, `⊗`) inside source files.',
  '3. **Human Response Surface**:',
  '   - Deliver final user-facing replies in concise, clear natural language matching the user\'s language (default Chinese when prompted in Chinese), unless raw `#BT` is explicitly requested.',
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

const CN_FILLER_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:(?:你好(?:呀|啊|吗)?|您好|嗨|哈喽|早上好|下午好|晚上好|在吗|老哥|兄弟|大佬|大神|师傅|亲)[，,。！!、\s]*)+/gu,
  /(?:请问一下|我想问一下|我想让你帮我|能不能帮我|可不可以帮我|麻烦你?(?:帮我)?|劳驾(?:帮我)?|拜托(?:你)?(?:帮我)?|请帮我|帮我一下|帮我看下|请务必|跪求|求求你了?)[，,、\s]*/gu,
  /(?:(?:我真是|真是|我都|真)?(?:服了|快崩溃了|崩溃了|要疯了|烦死了|急死我了|太折磨人了|搞了一整天了?|弄了一整天了?|卡了半天了?|头都大了|救命啊?|十万火急)[，,。！!、\s]*)+/gu,
  /[，,。！!、~～\s]*(?:非常感谢|万分感谢|太感谢了|谢谢(?:你|啦|啊|哈)?|感激不尽|辛苦了|好人一生平安)[，,。！!、~～\s]*$/gu,
  /(?:呃+|嗯+|啊这|那个啥|就是说|怎么说呢|其实吧|说白了就是|乱七八糟的)[，,、\s]*/gu,
]

const EN_FILLER_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:hi|hello|hey)(?:\s+there)?[,!.\s]+/giu,
  /\b(?:could you please|would you kindly|can you please|please kindly|i would really appreciate it if you could|sorry to bother you(?:,?\s*but)?)\s+/giu,
  /\b(?:i am going crazy|this is driving me nuts|i'm so frustrated)[,!.\s]*/giu,
  /[,\s]*(?:thank you so much|thanks a lot|many thanks|thanks in advance)[.!~\s]*$/giu,
]

const CLAUSE_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/在当前(?:工作区|目录|文件夹|项目)(?:下|中|里)?(?:创建|新建|编写|写)一个(?:完整的|标准的)?/gu, 'create '],
  [/(?:创建|新建|编写|实现)一个(?:完整的|标准的)?/gu, 'impl '],
  [/包含类型注解|加上类型注解|带类型注解/gu, '+typed'],
  [/线程安全的?/gu, '+threadsafe '],
  [/单元测试/gu, 'unittest'],
  [/调用(?:命令行|终端)运行/gu, 'run '],
  [/验证全部通过|确保测试通过|确认全部通过/gu, '=>pass'],
  [/如果(?:出现|发生|遇到|存在)?/gu, '?'],
  [/假如|若是|当(?=.*时)/gu, '?'],
  [/那么就?|则(?:需要|必须|应当)?|然后(?:再)?/gu, ' => '],
  [/并且(?:还要|需要)?|同时(?:还要|需要)?|而且(?:还要)?|以及/gu, ' & '],
  [/千万不要|绝对不要|严禁使用|严禁|禁止使用|禁止|切勿|绝不能|不要使用|不要用|不能用|别用/gu, '!ban:'],
  [/除了(?=.*(?:以外|之外))/gu, '!exc:'],
  [/(?:以外|之外)/gu, ''],
  [/大于等于|不少于|不低于|至少为?/gu, '>='],
  [/小于等于|不超过|不高于|最多为?/gu, '<='],
  [/不等于/gu, '!='],
  [/导致了?|从而|进而|输出到|转换为|转成|并返回/gu, ' -> '],
  [/需要你?(?:去)?|请你?(?:去)?|帮我(?:去)?/gu, ''],
]

const NEGATION_PATTERN = /(?:!ban:|!禁止:|不要|禁止|严禁|切勿|不能|不可|别用|禁止使用|\b(?:never|do\s+not|don't|must\s+not|without|forbid(?:den)?)\b)/iu

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
 * Extract hard engineering anchors (code spans, URLs, file paths, versions/numbers,
 * operator-bound digits, ALLCAPS/CamelCase/snake_case symbols, and forbidden library names)
 * that MUST survive prompt dehydration with zero loss.
 */
export function extractHardAnchors(text: string): string[] {
  const anchors = new Set<string>()
  const add = (raw: string): void => {
    const cleaned = raw.trim().replace(/^[`'"]+|[`'"]+$/gu, '')
    if (cleaned.length >= 1 && !/^(?:Python|Java|Go|Rust|TypeScript|JavaScript)$/iu.test(cleaned)) {
      anchors.add(cleaned)
    }
  }

  // 1. Inline code spans: `...`
  for (const m of text.matchAll(/`([^`\n]{1,120})`/gu)) {
    if (m[1] !== undefined) add(m[1])
  }
  // 2. URLs and host:port endpoints
  for (const m of text.matchAll(/https?:\/\/[^\s,，。；;)"'`]+|\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{2,5})?\b/gu)) {
    add(m[0])
  }
  // 3. File paths & filenames with extensions
  for (const m of text.matchAll(/(?:[A-Za-z]:[\\/]|[.~]?\/)?[\w.-]+(?:[\\/][\w.-]+)+|\b[\w-]+\.(?:py|java|ts|tsx|js|jsx|go|rs|cpp|c|h|cs|sql|json|ya?ml|toml|md|html|css|sh|ps1|bat)\b/gu)) {
    add(m[0])
  }
  // 4. Numbers with units, versions, multi-digit numbers, and operator-bound single digits (e.g. `>= 1`, `最多 3`)
  for (const m of text.matchAll(/\bv?\d+(?:\.\d+)+(?:-[A-Za-z0-9.]+)?\b|\b\d+(?:\.\d+)?(?:ms|s|m|h|kb|mb|gb|tb|px|%|tok|k)\b|\b\d{2,}\b/giu)) {
    add(m[0])
  }
  for (const m of text.matchAll(/(?:>=|<=|==|!=|>|<|容量|长度|次数|重试|最多|至少|不超过)\s*(\d+)\b/gu)) {
    if (m[1] !== undefined) add(m[1])
  }
  // 5. Code identifiers: ALLCAPS+Pascal (`TTLCache`, `LRUCache`), camelCase, PascalCase, snake_case, `fn()`
  for (const m of text.matchAll(/\b(?:[A-Z]{2,}[A-Za-z0-9_]*|[a-z]+(?:[A-Z][a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_]*\(\))/gu)) {
    add(m[0])
  }
  // 6. Explicit negated library/API names (e.g. `严禁 cachetools`, `不要使用 sort`)
  for (const m of text.matchAll(/(?:严禁|禁止|不要|切勿|不能)(?:使用|用|引入|依赖)?\s*([A-Za-z_][A-Za-z0-9_.]*(?:\(\))?)/gu)) {
    if (m[1] !== undefined) add(m[1])
  }

  return [...anchors]
}

/**
 * Audit compiled BT-L2 text against source hard anchors and repair any missing literal anchor.
 */
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

/** Whether text already uses BabelTele `#BT` / `#Task` / `[SMFT-T1]` framing. */
export function looksLikeBabelTele(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('#BT')
    || trimmed.startsWith('#Task ')
    || trimmed.startsWith('#SubTask ')
    || trimmed.startsWith('#SubReport ')
    || trimmed.startsWith('[SMFT-T1]')
    || /(?:^|\n)\s*#(?:Intent|Plan|Stack|Files|DiagFix|Next)\b/u.test(trimmed)
}

/**
 * Compile verbose/emotional human input into neutral, anchor-locked BT-Spec v1.0 (`BT-L2`).
 */
export function neutralizeToBabelTele(raw: string): BabelTeleNeutralizeResult {
  const trimmed = raw.trim()
  const originalTokens = estimateBabelTokens(trimmed)
  if (trimmed.length === 0 || trimmed.startsWith('/') || looksLikeBabelTele(trimmed)) {
    return {
      original: raw,
      babeltele: raw,
      originalTokens,
      babelTokens: originalTokens,
      savedTokens: 0,
      savedRatio: 0,
      strippedFillerCount: 0,
      shortCircuit: true,
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

  for (const [pattern, replacement] of CLAUSE_REWRITES) {
    working = working.replace(pattern, replacement)
  }

  // Deduplicate nested `!ban:` inside parenthetical clarifications: `!ban:X（!ban: Y）` -> `!ban:X(Y)`
  working = working.replace(/(!ban:[^;，。()（）]+)[（(]\s*!ban:\s*([^)）]+)[)）]/gu, '$1($2)')

  working = working
    .replace(/[，、；]+/gu, '; ')
    .replace(/(?:[。！？]+|!(?![=禁止banexc\[]))+/gu, ' | ')
    .replace(/(?:;\s*)*\|\s*/gu, ' | ')
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
    originalTokens,
    babelTokens,
    savedTokens,
    savedRatio,
    strippedFillerCount,
    shortCircuit,
    audit,
  }
}

/**
 * Decode compact `#BT` / `[SMFT-T1]` silicon reasoning or messages into natural Chinese prose.
 */
export function decodeBabelTeleToZh(text: string): string {
  if (text.trim().length === 0) return text
  return text
    .replace(/\[SMFT-T1\]/gu, '[语义检查点 SMFT-T1]')
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

/** Invalidate cached workspace BT-Headers immediately upon any file write/edit. */
export function invalidateBtHeaderCache(): void {
  btHeaderCache.clear()
}

/**
 * Plane-B Code Sanitizer & Purity Gate for `write` and `edit` filesystem tools.
 */
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

/** Audit an edit fragment (`new_string`) for Plane-B native code purity. */
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

/**
 * Extract up to 12 top-level architectural symbols per file without letting nested
 * helper methods (`__init__`, `_unlink`) starve subsequent top-level classes!
 */
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
 * Scan workspace source files into an always-fresh `mtime`-fingerprinted `[BT-Headers v2.0]`
 * architectural index (`@relPath(L=n):[symbols]`), so mutations immediately reflect on the next step.
 */
export function scanWorkspaceBtHeaders(cwd: string, maxFiles = 28): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.injectBtHeaders) return ''
  if (!existsSync(cwd)) return ''

  const discovered: Array<{ fullPath: string; rel: string; size: number; mtimeMs: number; ext: string }> = []
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
      if (!SCAN_SOURCE_EXTENSIONS.has(ext)) continue
      discovered.push({
        fullPath,
        rel: relative(cwd, fullPath).replaceAll('\\', '/'),
        size: st.size,
        mtimeMs: Math.trunc(st.mtimeMs),
        ext,
      })
    }
  }

  if (discovered.length === 0) return ''
  const fingerprint = discovered.map(f => `${f.rel}:${String(f.size)}:${String(f.mtimeMs)}`).join('|')
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

  const snapshot = entries.length === 0
    ? ''
    : `[BT-Headers v2.0 Workspace Skeleton]\n${entries.join(' ; ')}`
  btHeaderCache.set(cwd, { fingerprint, snapshot })
  return snapshot
}
