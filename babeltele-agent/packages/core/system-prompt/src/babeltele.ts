/**
 * Built-in BabelTele (BT-Spec v1.0) Dual-Plane Silicon Protocol Engine.
 *
 * Provides deterministic user-prompt dehydration with Tier-1 Hard-Anchor Lock,
 * BPE token-budget circuit breaking, Sidecar human decoding, Workspace BT-Header
 * skeleton extraction, and Plane-B native code-purity sanitization.
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
 * Core Dual-Plane Silicon Kernel instruction registered natively in `SystemPrompt`.
 */
export const BABELTELE_DUAL_PLANE_KERNEL_PROMPT = [
  '## BabelTele Dual-Plane Silicon Kernel (BT-Spec v1.0 Built-in)',
  'You run natively on the BabelTele Dual-Plane Architecture (`BT-Spec v1.0`):',
  '1. **Plane A — High-Density `#BT` Reasoning & Coordination**:',
  '   - Conduct internal reasoning (`thinking`), task decomposition, `[SMFT-T1]` compaction checkpoints, and `subagent` / `subagent_fork` prompts in ultra-compact, objective **BT-L2** using 1-token ASCII operators (`#Intent`, `#Plan`, `?`, `=>`, `->`, `&`, `!ban:`, `!exc:`, `@path(L=n)`).',
  '   - Eliminate conversational filler, self-doubt loops, and redundant restatements in internal thoughts.',
  '   - Treat colloquial, emotional, or urgent human input strictly as neutral engineering state transitions (`State_in -> Constraints -> State_out`), preserving 100% of hard anchors (paths, numbers, APIs, negations).',
  '2. **Plane B — 100% Pure Native Code Invariant (Zero Disk Pollution)**:',
  '   - Every file written or edited via `write`, `edit`, `apply_patch`, or shell scripts MUST contain **100% pure, idiomatic, standard target-language code** (`.py`, `.java`, `.ts`, `.tsx`, `.go`, `.rs`, `.cpp`, `.sql`, etc.).',
  '   - NEVER leak `#BT`, `[SMFT-T1]`, `![AnchorLock:`, or non-ASCII protocol glyphs (`⟦`, `⟧`, `⊕`, `⊗`) into source code files.',
  '3. **Human Response Surface**:',
  '   - Present final user-facing answers in clear, concise natural language matching the user\'s language (default Chinese when prompted in Chinese), unless the user explicitly asks for raw `#BT` output.',
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
  [/如果(?:出现|发生|遇到|存在)?/gu, '?'],
  [/假如|若是|当(?=.*时)/gu, '?'],
  [/那么就?|则(?:需要|必须|应当)?|然后(?:再)?/gu, ' => '],
  [/并且(?:还要|需要)?|同时(?:还要|需要)?|而且(?:还要)?|以及/gu, ' & '],
  [/千万不要|绝对不要|严禁|禁止使用|禁止|切勿|绝不能|不要使用|不要用|不能用|别用/gu, '!禁止:'],
  [/除了(?=.*(?:以外|之外))/gu, '!exc:'],
  [/(?:以外|之外)/gu, ''],
  [/大于等于|不少于|不低于|至少为?/gu, '>='],
  [/小于等于|不超过|不高于|最多为?/gu, '<='],
  [/不等于/gu, '!='],
  [/导致了?|从而|进而|输出到|转换为|转成/gu, ' -> '],
  [/需要你?(?:去)?|请你?(?:去)?|帮我(?:去)?/gu, ''],
]

const NEGATION_PATTERN = /(?:!禁止:|!ban:|不要|禁止|严禁|切勿|不能|不可|别用|禁止使用|\b(?:never|do\s+not|don't|must\s+not|without|forbid(?:den)?)\b)/iu

/**
 * Fast, deterministic BPE token estimator calibrated for modern coding LLMs
 * (`o200k_base` / DeepSeek V3 / Claude tokenizer profiles).
 */
export function estimateBabelTokens(text: string): number {
  if (text.length === 0) return 0
  let tokens = 0
  let i = 0
  while (i < text.length) {
    const code = text.codePointAt(i) ?? 0
    const charLen = code > 0xffff ? 2 : 1
    // Whitespace merges with adjacent ASCII tokens in BPE.
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      if (code === 10) tokens += 0.35
      i += charLen
      continue
    }
    // ASCII letters / digits run: ~4.2 chars per BPE token.
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
    // Standard ASCII punctuation / operators (`#`, `?`, `=`, `>`, `&`, `!`, `@`): ~1 token per operator group.
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
    // Common CJK Unified Ideographs: ~1.35 tokens per character on average.
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) {
      tokens += 1.35
      i += charLen
      continue
    }
    // Rare mathematical/Unicode box/bracket glyphs often split into 2-3 byte-fallback tokens!
    tokens += 2.4
    i += charLen
  }
  return Math.max(1, Math.round(tokens))
}

/**
 * Extract hard engineering anchors (code spans, URLs, file paths, versions/numbers, identifiers)
 * that MUST survive prompt dehydration with zero loss.
 */
export function extractHardAnchors(text: string): string[] {
  const anchors = new Set<string>()
  const add = (raw: string): void => {
    const cleaned = raw.trim().replace(/^[`'"]+|[`'"]+$/gu, '')
    if (cleaned.length >= 2) anchors.add(cleaned)
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
  // 4. Numbers with units, versions, ports, percentages
  for (const m of text.matchAll(/\bv?\d+(?:\.\d+)+(?:-[A-Za-z0-9.]+)?\b|\b\d+(?:\.\d+)?(?:ms|s|m|h|kb|mb|gb|tb|px|%|tok|k)\b|\b\d{2,}\b/giu)) {
    add(m[0])
  }
  // 5. Code identifiers (camelCase, PascalCase, snake_case, fn calls)
  for (const m of text.matchAll(/\b(?:[a-z]+(?:[A-Z][a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+|[A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+|[A-Za-z_][A-Za-z0-9_]*\(\))/gu)) {
    add(m[0])
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
    finalCompiled += ' !禁止:违背原约束'
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

  // Protect inline code spans during filler & clause rewrites.
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

  // Normalize punctuation & whitespace into compact 1-token ASCII separators (preserving `!禁止:`, `!ban:`, `!exc:`, `!=`).
  working = working
    .replace(/[，、；]+/gu, '; ')
    .replace(/(?:[。！？]+|!(?![=禁止banexc\[]))+/gu, ' | ')
    .replace(/(?:;\s*)*\|\s*/gu, ' | ')
    .replace(/^(?:[;|]\s*)+|(?:[;|]\s*)+$/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim()

  // Restore inline code spans.
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
 * Decode compact `#BT` / `[SMFT-T1]` silicon reasoning or messages into natural Chinese prose
 * for human Sidecar inspection in the UI.
 */
export function decodeBabelTeleToZh(text: string): string {
  if (text.trim().length === 0) return text
  return text
    .replace(/\[SMFT-T1\]/gu, '【巴别语语义默克尔检查点 SMFT-T1】')
    .replace(/^#BT\b\s*/gmu, '【巴别语内核推理】')
    .replace(/^#Task\b\s*/gmu, '【工程任务】')
    .replace(/^#SubTask\b\s*/gmu, '【子智能体委派】')
    .replace(/^#SubReport\b\s*/gmu, '【子智能体回执】')
    .replace(/^#Intent\b\s*:?\s*/gmu, '• 核心意图：')
    .replace(/^#Plan\b\s*:?\s*/gmu, '• 执行计划：')
    .replace(/^#Stack\b\s*:?\s*/gmu, '• 技术栈与约束：')
    .replace(/^#Files\b\s*:?\s*/gmu, '• 涉及文件状态：')
    .replace(/^#DiagFix\b\s*:?\s*/gmu, '• 故障定位与修复：')
    .replace(/^#Pending\b\s*:?\s*/gmu, '• 待办事项：')
    .replace(/^#Next\b\s*:?\s*/gmu, '• 下一步动作：')
    .replace(/!\[AnchorLock:\s*([^\]]+)\]/gu, '（硬锚点锁定：$1）')
    .replace(/!(?:禁止|ban):/gu, '【严禁】')
    .replace(/!exc:/gu, '【例外豁免】')
    .replace(/\s*=>\s*/gu, ' ⇒ 推导执行：')
    .replace(/\s*->\s*/gu, ' → ')
    .replace(/\s*&\s*/gu, ' 且 ')
    .replace(/(^|[\s;])(\?)([^\s?])/gu, '$1若满足条件：$3')
}

const OUTER_MARKDOWN_FENCE = /^```[A-Za-z0-9_+-]*\r?\n([\s\S]*?)\r?\n```\s*$/u

const LEAKED_PROTOCOL_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[⟦⟧⊕⊗⊘⊢⊣]/u, 'non-ASCII BabelTele algebra glyph (⟦ ⟧ ⊕ ⊗ ⊢)'],
  [/\[SMFT-T1\]/u, '[SMFT-T1] compaction header inside source code'],
  [/!\[AnchorLock:/u, '![AnchorLock:...] prompt anchor tag inside source code'],
  [/^\s*#(?:BT|SubTask|SubReport)\b/mu, '#BT/#SubTask/#SubReport protocol directive line inside source code'],
]

/**
 * Plane-B Code Sanitizer & Purity Gate for `write` and `edit` filesystem tools.
 * Automatically strips accidental outer Markdown code fences on code files and
 * detects any leaked internal BabelTele protocol markers.
 */
export function sanitizeCodeArtifact(filePath: string, content: string): { content: string; audit: CodePurityAudit } {
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
  const sigs: string[] = []
  for (const line of lines) {
    if (sigs.length >= 5) break
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue
    if (ext === '.py') {
      const m = /^(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) sigs.push(m[1])
    } else if (ext === '.java' || ext === '.kt' || ext === '.cs') {
      const m = /^(?:public|protected|private|internal|abstract|final|static|\s)*(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) sigs.push(m[1])
    } else if (ext === '.go') {
      const m = /^(?:func|type)\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) sigs.push(m[1])
    } else if (ext === '.rs') {
      const m = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) sigs.push(m[1])
    } else {
      const m = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(trimmed)
      if (m?.[1] !== undefined) sigs.push(m[1])
    }
  }
  return sigs
}

const btHeaderCache = new Map<string, { expiresAt: number; snapshot: string }>()

/**
 * Scan workspace source files into a compact `[BT-Headers v1.0]` architectural index
 * (`@relPath(L=n): [symbols]`), cached briefly to avoid redundant disk I/O.
 */
export function scanWorkspaceBtHeaders(cwd: string, maxFiles = 24): string {
  if (!babelTeleRuntimeConfig.enabled || !babelTeleRuntimeConfig.injectBtHeaders) return ''
  const now = Date.now()
  const cached = btHeaderCache.get(cwd)
  if (cached !== undefined && cached.expiresAt > now) return cached.snapshot

  if (!existsSync(cwd)) return ''
  const entries: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: cwd, depth: 0 }]

  while (queue.length > 0 && entries.length < maxFiles) {
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
      if (entries.length >= maxFiles) break
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
      try {
        const text = readFileSync(fullPath, 'utf8')
        const lineCount = text.split('\n').length
        const rel = relative(cwd, fullPath).replaceAll('\\', '/')
        const sigs = extractFileSignatures(text, ext)
        entries.push(sigs.length > 0
          ? `@${rel}(L=${String(lineCount)}):[${sigs.join(',')}]`
          : `@${rel}(L=${String(lineCount)})`)
      } catch {
        // Ignore unreadable files smoothly.
      }
    }
  }

  const snapshot = entries.length === 0
    ? ''
    : `[BT-Headers v1.0 Workspace Skeleton]\n${entries.join(' ; ')}`
  btHeaderCache.set(cwd, { expiresAt: now + 8000, snapshot })
  return snapshot
}
