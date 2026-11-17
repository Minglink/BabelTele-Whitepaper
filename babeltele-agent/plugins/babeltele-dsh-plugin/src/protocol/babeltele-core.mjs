/**
 * Core BT-Spec v1.0 Protocol Engine:
 * 1. Real `o200k_base` & `cl100k_base` BPE Token Accountant (`js-tiktoken`)
 * 2. 3-Stage Hybrid BabelTele Neutralizer + Tier-1 Hard-Anchor Auditor (<2ms)
 * 3. Instant Sidecar Chinese Lens (`#BT` -> Human Chinese)
 * 4. Dual-Plane `ArtifactSanitizer` (0% BabelTele symbol pollution in native code)
 * 5. Cross-File `BT-Header` Topological Signature Extractor
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { getEncoding } from 'js-tiktoken'

let o200k = null
let cl100k = null

function getO200k() {
  if (!o200k) o200k = getEncoding('o200k_base')
  return o200k
}

function getCl100k() {
  if (!cl100k) cl100k = getEncoding('cl100k_base')
  return cl100k
}

export function countTokens(text, encodingName = 'o200k_base') {
  if (!text) return 0
  const enc = encodingName === 'cl100k_base' ? getCl100k() : getO200k()
  return enc.encode(String(text)).length
}

export function compareTokenBudget(source, btText) {
  const srcO200 = countTokens(source, 'o200k_base')
  const btO200 = countTokens(btText, 'o200k_base')
  const srcCl100 = countTokens(source, 'cl100k_base')
  const btCl100 = countTokens(btText, 'cl100k_base')
  const saved = srcO200 - btO200
  const savingsPct = srcO200 > 0 ? Number(((saved / srcO200) * 100).toFixed(1)) : 0
  return {
    sourceTokens: srcO200,
    btTokens: btO200,
    savedTokens: saved,
    savingsPct,
    cl100kSource: srcCl100,
    cl100kBt: btCl100,
    netBpeGain: btO200 < srcO200,
  }
}

const NOISE_PATTERNS = [
  [/^(?:(?:你好|您好|嗨|哈喽|请问一下|请问|麻烦你(?:一下)?|麻烦帮我(?:一下)?|能不能麻烦你|能不能帮我(?:一下)?|拜托了?|求求了?)[啊呀呢吧嘛啦，,、！!。\s]*)+/u, ''],
  [/(我真是服了|我都快崩溃了|真是烦死了|这破系统|这破代码|太让人头大了|老板又在催命一样逼着改|万分感谢|非常感谢|谢谢啦?|辛苦了)[，,、！!。\s]*/gu, ''],
  [/^(?:hi|hello|hey there|could you please kindly|would you mind helping me to|please help me)\s*[,!]?\s*/i, ''],
  [/(麻烦你帮我想个|麻烦帮我|请你帮我写一个|我想让你帮我做一个|能不能帮我实现一个|能不能帮我)/gu, '实现:'],
  [/如果出现|一旦发生|当满足|只要满足|每当/gu, '?'],
  [/那么就必须|那么就要|就立即|则必须|则立即|就会导致|从而导致/gu, ' => '],
  [/并且要求|而且要求|同时要求|并且必须|而且必须|同时必须|并且/gu, ' & '],
  [/绝对禁止|严格禁止|严禁|千万不要|绝对不能/gu, ' !禁止:'],
  [/除非|但排除|除了/gu, ' !exc:'],
  [/大于等于|不少于|至少/gu, '>='],
  [/小于等于|不超过|最多|以内/gu, '<='],
]

const PATH_URL_RE = /(?:https?:\/\/[^\s,，。)\]]+|\b\d{1,3}(?:\.\d{1,3}){2,3}\b|(?:\/[A-Za-z0-9_.-]+)+|[A-Za-z0-9_.-]+\.(?:py|java|ts|tsx|js|mjs|cjs|go|rs|sql|json|yaml|yml|md|html|css|sh|ps1))/g
const NUMBER_RE = /(?<![A-Za-z0-9_.])\d+(?:\.\d+)?(?:%|ms|s|MB|GB|KB|K|M|tok)?(?![A-Za-z0-9_.])/g
const IDENT_RE = /\b(?:[a-z]+[A-Z][A-Za-z0-9_]*|[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+|[a-z]+_[a-z0-9_]+|BIBREF\w*|TABREF\w*|P99|P95|JWT|MySQL|Redis|PostgreSQL|SQLite|HTTP|REST|SSE|LRU)\b/g
const NEGATION_RE = /(?<!能)(?:严禁|禁止|不得|不许|绝不|除非|排除|\bnot\b|\bnever\b|\bexcept\b|\bunless\b|\bwithout\b)/giu

export function extractHardAnchors(text) {
  const cleaned = String(text ?? '')
    .replace(/能不能/g, '')
    .replace(/好不好/g, '')
    .replace(/行不行/g, '')

  const paths = [...new Set(cleaned.match(PATH_URL_RE) ?? [])]
  let masked = cleaned
  for (const p of paths) masked = masked.split(p).join(' ')

  const numbers = [...new Set(masked.match(NUMBER_RE) ?? [])]
  const identifiers = [...new Set(cleaned.match(IDENT_RE) ?? [])]
  const negations = [...new Set(cleaned.match(NEGATION_RE) ?? [])]
  return { numbers, paths, identifiers, negations }
}

export function auditAnchors(source, btText) {
  const anchors = extractHardAnchors(source)
  const matched = []
  const missing = []
  const lowerBt = String(btText ?? '').toLowerCase()

  for (const tok of [...anchors.paths, ...anchors.identifiers]) {
    if (lowerBt.includes(tok.toLowerCase())) matched.push(tok)
    else missing.push(tok)
  }

  for (const num of anchors.numbers) {
    const m = /^\d+(?:\.\d+)?/.exec(num)
    const core = m ? m[0] : num
    const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![0-9.])${escaped}(?![0-9])`)
    if (re.test(btText)) matched.push(num)
    else missing.push(num)
  }

  let negationPreserved = true
  if (anchors.negations.length > 0) {
    const hasNeg = /(!|¬|!=|\bnot\b|\bnever\b|禁止|严禁|不|除)/iu.test(btText)
    if (hasNeg) matched.push(`否定边界(${anchors.negations[0]})`)
    else {
      negationPreserved = false
      missing.push(`否定边界(${anchors.negations[0]})`)
    }
  }

  return {
    passed: missing.length === 0 && negationPreserved,
    totalAnchors: matched.length + missing.length,
    matched,
    missing,
    negationPreserved,
  }
}

export function compileOfflineNeutral(text) {
  let s = String(text ?? '').trim()
  let stripped = 0
  for (const [pat, repl] of NOISE_PATTERNS) {
    const next = s.replace(pat, (...args) => {
      stripped += 1
      return repl
    })
    s = next
  }
  s = s.replace(/(?:[，,；;。！]|!(?!禁止|exc|\[))+/gu, '; ')
  s = s.replace(/\s+/g, ' ').replace(/^[;\s]+|[;\s]+$/g, '')
  if (s && !s.startsWith('#') && !s.startsWith('/')) {
    s = `#Task ${s}`
  }
  return { btText: s, strippedCount: stripped }
}

export const NEUTRALIZER_SYSTEM_PROMPT = [
  'Role: BT-Spec v1.0 Formal Neutralizer.',
  'Convert the user request into an ultra-compact, emotionally neutral BabelTele (BT-L2) engineering specification for an autonomous coding agent.',
  'Rules:',
  '1. Strip ALL greetings, venting, emotional phrasing, and filler.',
  '2. Use 1-token ASCII operators (#Task, @Entity(K=V), ->, ?cond=>act, &, |, !禁止:/!exc:). Never use decorative multi-byte emojis.',
  '3. Preserve 100% of exact numbers, units, file paths, IP addresses, API routes, identifiers, and negations verbatim.',
  '4. Output ONLY the single compact BabelTele specification, nothing else.',
].join('\n')

export async function neutralizePrompt(text, llmCompileFn = null) {
  const t0 = performance.now()
  const raw = String(text ?? '').trim()
  if (!raw || raw.startsWith('/')) {
    return {
      original: raw,
      babeltele: raw,
      engine: 'passthrough',
      circuitBreakerTriggered: false,
      audit: { passed: true, totalAnchors: 0, matched: [], missing: [], negationPreserved: true },
      budget: compareTokenBudget(raw, raw),
      elapsedMs: 0,
    }
  }

  const { btText: ruleBt, strippedCount } = compileOfflineNeutral(raw)
  let candidate = ruleBt
  let engine = 'offline-rule'

  if (typeof llmCompileFn === 'function' && raw.length > 24) {
    try {
      const llmOut = (await llmCompileFn(NEUTRALIZER_SYSTEM_PROMPT, raw))?.trim()
      if (llmOut) {
        candidate = llmOut
        engine = 'dsh-llm-hybrid'
      }
    } catch {
      candidate = ruleBt
      engine = 'offline-rule(fallback)'
    }
  }

  let audit = auditAnchors(raw, candidate)
  if (!audit.passed && audit.missing.length > 0) {
    candidate = `${candidate} ![AnchorLock: ${audit.missing.join(', ')}]`
    audit = auditAnchors(raw, candidate)
  }

  let budget = compareTokenBudget(raw, candidate)
  let circuitBreakerTriggered = false
  let finalBt = candidate

  if (!budget.netBpeGain && raw.length < 60 && strippedCount === 0) {
    finalBt = raw
    budget = compareTokenBudget(raw, finalBt)
    circuitBreakerTriggered = true
  }

  return {
    original: raw,
    babeltele: finalBt,
    engine,
    strippedCount,
    circuitBreakerTriggered,
    audit,
    budget,
    elapsedMs: Number((performance.now() - t0).toFixed(2)),
  }
}

export function decodeBtToChinese(btText) {
  const s = String(btText ?? '').trim()
  if (!s) return ''
  const pairs = [
    ['#BT', '【硅基思考】'],
    ['#Task', '【工程任务】'],
    ['#Plan', '【实施规划】'],
    ['#Diag', '【根因定位】'],
    ['#Fix', '【修复动作】'],
    ['#Verify', '【测试验收】'],
    ['#SubReport', '【子智能体回执】'],
    ['[SMFT-T1]', '【SMFT 默克尔检查点】'],
    ['?missing', '若缺失则'],
    ['?err', '若报错则'],
    ['?ok', '校验通过则'],
    ['!禁止:', '【严禁】'],
    ['!exc:', '【豁免排除】'],
    ['=>', ' ➔ 推导执行：'],
    ['->', ' → 随后 '],
    [' & ', ' 且 '],
  ]
  let out = s
  for (const [k, v] of pairs) {
    out = out.split(k).join(v)
  }
  return out
}

const CODE_EXTENSIONS = new Set([
  '.py', '.java', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.go', '.rs', '.c', '.cpp', '.h', '.cs', '.sql', '.html', '.css', '.vue',
])

const FORBIDDEN_CODE_LEAKS = [
  { re: /^\s*#BT\b/m, label: '#BT reasoning prefix inside source code' },
  { re: /⟦|⟧|⇒|⇔|∉/u, label: 'BabelTele mathematical/bracket glyph inside source code' },
  { re: /\[SMFT-T[123]\]/, label: 'SMFT memory tag inside source code' },
  { re: /!\[AnchorLock:/, label: 'AnchorLock tag inside source code' },
]

export function auditCodePurity(filePath, content) {
  const ext = extname(String(filePath ?? '')).toLowerCase()
  if (!CODE_EXTENSIONS.has(ext)) {
    return { checked: false, pure: true, issues: [] }
  }
  const text = String(content ?? '')
  const issues = []
  for (const { re, label } of FORBIDDEN_CODE_LEAKS) {
    if (re.test(text)) issues.push(label)
  }
  return {
    checked: true,
    pure: issues.length === 0,
    issues,
  }
}

export function extractBtHeader(relPath, content) {
  const ext = extname(relPath).toLowerCase()
  const text = String(content ?? '')
  const lines = text.split('\n').length
  const sigs = []

  if (ext === '.py') {
    const re = /^(\s*)(class\s+\w+[^:]*:|(?:async\s+)?def\s+\w+\s*\([^)]*\)\s*(?:->\s*[^:]+)?:)/gm
    let m
    while ((m = re.exec(text)) !== null && sigs.length < 16) {
      const prefix = m[1].length > 0 ? '.' : ''
      sigs.push(`${prefix}${m[2].replace(/\s+/g, ' ').replace(/:$/, '')}`)
    }
  } else if (['.ts', '.tsx', '.js', '.mjs', '.java', '.go', '.rs'].includes(ext)) {
    const re = /^\s*(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(?:class|interface|type|function|fn|struct|enum)\s+[A-Za-z0-9_<>]+/gm
    let m
    while ((m = re.exec(text)) !== null && sigs.length < 16) {
      sigs.push(m[0].trim().replace(/\s+/g, ' '))
    }
  }

  if (sigs.length === 0) return null
  return `@${relPath.replace(/\\/g, '/')}(L=${lines}): [${sigs.join(' | ')}]`
}

const IGNORE_SCAN_DIRS = new Set(['.git', 'node_modules', '.dsh-home', 'dist', 'build', '__pycache__', '.venv', 'venv'])

export function scanWorkspaceHeaders(rootDir, maxFiles = 24) {
  if (!rootDir || !existsSync(rootDir)) return { digest: '', count: 0, savedTokens: 0 }
  const headers = []
  let rawTok = 0
  let hdrTok = 0

  function walk(dir, depth) {
    if (depth > 3 || headers.length >= maxFiles) return
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (headers.length >= maxFiles) break
      if (IGNORE_SCAN_DIRS.has(ent.name) || ent.name.startsWith('.')) continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full, depth + 1)
      } else if (ent.isFile() && CODE_EXTENSIONS.has(extname(ent.name).toLowerCase())) {
        try {
          const st = statSync(full)
          if (st.size > 0 && st.size <= 80_000) {
            const txt = readFileSync(full, 'utf8')
            const rel = relative(rootDir, full).replace(/\\/g, '/')
            const hdr = extractBtHeader(rel, txt)
            if (hdr) {
              headers.push(hdr)
              rawTok += countTokens(txt)
              hdrTok += countTokens(hdr)
            }
          }
        } catch {
          // ignore unreadable file
        }
      }
    }
  }

  walk(rootDir, 0)
  return {
    digest: headers.join('\n'),
    count: headers.length,
    savedTokens: Math.max(0, rawTok - hdrTok),
  }
}

export const STARTER_TEMPLATES = [
  {
    id: 'rate_limiter',
    title: '🧪 口水话脱水 + Python 限流器与单测闭环',
    badge: 'Neutralizer + 单测验证',
    prompt:
      '你好啊麻烦帮我一下！我真是服了这破系统总是被恶意刷接口，老板又在催命一样逼着改！能不能帮我在当前工作区写一个生产级 Python 令牌桶与滑动窗口限流模块 rate_limiter.py，如果出现单 IP 每秒请求大于等于 20 次那么就必须立即拦截返回 False，并且要求支持白名单豁免（严禁误拦 127.0.0.1 和 /health 健康检查路径），然后再写一个完整的单元测试文件 test_rate_limiter.py 并用终端运行 python -m unittest 验证全部通过！万分感谢辛苦了！',
  },
  {
    id: 'java_dual_plane',
    title: '🛡️ 双平面零污染验证 (Java / TypeScript)',
    badge: '100% 纯正源码卫士',
    prompt:
      '请在当前工作区创建一个标准 Java 17 订单风控校验器 OrderValidator.java（含单笔金额上限 50000.00 校验、必填字段非空检查与 VIP 免审白名单逻辑，要求 100% 标准 Java 语法与清晰 Javadoc 注释），同时编写配套的交互式校验演示页 order_demo.html，验证思考层用 #BT 极速推进而落盘工程代码零污染。',
  },
  {
    id: 'subagent_smft',
    title: '🐝 子智能体协同巡检 + SMFT 记忆压缩',
    badge: 'Subagent + BT-Header',
    prompt:
      '请先扫描当前工作区的代码结构与边界条件，委派 subagent 子智能体对现有代码进行异常处理、安全边界与测试覆盖率专项审计，汇总整改清单并用简洁中文向我汇报。',
  },
]
