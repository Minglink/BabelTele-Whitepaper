/**
 * Client-side BabelTele (BT-Spec v1.0 · V6 Bilingual ZH/EN -> Pure #BT -> Exact User-Language) Engine.
 */

export type BabelTeleCompileMode = 'bt-l2' | 'bt-l3'
export type UserSurfaceLanguage = 'zh-CN' | 'en-US'

export interface HardAnchorAudit {
  readonly passed: boolean
  readonly totalAnchors: number
  readonly matchedAnchors: readonly string[]
  readonly repairedAnchors: readonly string[]
  readonly negationPreserved: boolean
}

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

export interface BabelTeleStarterTemplate {
  readonly id: string
  readonly badge: string
  readonly title: string
  readonly prompt: string
}

export const BABELTELE_STARTER_TEMPLATES: ReadonlyArray<BabelTeleStarterTemplate> = [
  {
    id: 'zh-quicksort',
    badge: '汉语输入 · 纯 #BT 思考 · 中文交付',
    title: '手写快排与单测（严禁内置 sort）',
    prompt:
      '你好呀老哥，我真是快崩溃了搞了一整天！麻烦帮我在当前工作区创建一个完整的 Python 快速排序模块 `quicksort_demo.py`，包含类型注解和单元测试，如果输入数组为空或者包含重复数字也要正常处理，千万不要使用内置的 `sort()` 或 `sorted()`，调用命令行运行验证全部通过，万分感谢！',
  },
  {
    id: 'en-limiter',
    badge: 'English In · Pure #BT CoT · EN Out',
    title: 'Thread-Safe Token Bucket + Unit Tests',
    prompt:
      'Hi there! Could you please help me create a complete thread-safe token bucket rate limiter in Python named `limiter.py` in the current workspace (with full type annotations, using only the standard library, and strictly no third-party dependencies), and then create a unit test file `test_limiter.py` (with at least 12 unit test cases covering edge cases and error handling), and finally run `python -m unittest -v` in the terminal to verify all tests pass? Thanks a lot!',
  },
  {
    id: 'multi-subagent',
    badge: 'L0→L1→L2 · 契约先行多级代理',
    title: '多级子智能体并行开发与零拷贝验证',
    prompt:
      '你好呀！麻烦你启动多级子智能体并行协同：在当前工作区下并行派出两个子智能体分别独立编写线程安全缓存模块 `cache_core.py` 与限流网关模块 `rate_guard.py`（均仅使用标准库，包含类型注解），并编写综合单元测试 `test_suite.py` 执行命令行 `python -m unittest -v` 验证全部通过，最后汇总成简明的工程报告，非常感谢！',
  },
]

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

const OMNILINGUAL_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  // Chinese -> BabelTele
  [/并行(?:派出|启动|调用|创建)/gu, 'parallel_spawn '],
  [/多级(?:子)?(?:智能体|代理)|层级(?:子)?(?:智能体|代理)/gu, 'hier_subagents '],
  [/子智能体|子代理/gu, 'subagent '],
  [/主智能体|主控智能体|协调器/gu, 'coordinator '],
  [/架构(?:审查|审计|评估|分析)/gu, 'arch_audit'],
  [/安全(?:审查|审计|漏洞(?:扫描|检查)?)/gu, 'sec_audit'],
  [/性能(?:剖析|优化|瓶颈分析|分析)/gu, 'perf_audit'],
  [/(?:最后|最终)?汇总(?:成|为)(?:一份)?(?:简明的|清晰的|完整的)?/gu, '=> synth '],
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

  // English -> BabelTele
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

export function isTrivialConversationalInput(text: string): boolean {
  const t = text.trim()
  if (t.length === 0 || t.length > 36 || t.startsWith('/') || !/[\p{L}\p{N}]/u.test(t)) return false
  return TRIVIAL_CHAT_PATTERN.test(t)
}

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
    || (trimmed.includes('=>') && (trimmed.includes('?') || trimmed.includes('!禁止:') || trimmed.includes('!ban:')))
}

export function neutralizeToBabelTele(
  raw: string,
  mode: BabelTeleCompileMode = 'bt-l2',
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

  const candidate = `#Task[@out=${userLanguage}] ${working.length > 0 ? working : trimmed}`
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

export function stripLeakedBtFromHumanText(text: string): string {
  if (!text.includes('#BT')) return text
  return text
    .replace(/^\s*#BT\b[^\n]*(?:\n|$)/gmu, '')
    .trimStart()
}

export function decodeBabelTeleToZh(text: string): string {
  if (text.trim().length === 0) return text
  return text
    .replace(/\[SMFT-T1\]/gu, '[语义检查点 SMFT-T1]')
    .replace(/\[BT-TestPass:\s*([^\]]+)\]/gu, '[测试通过摘要：$1]')
    .replace(/\[BT-LogFold:\s*([^\]]+)\]/gu, '[日志折叠：$1]')
    .replace(/^#BT\b\s*/gmu, '[巴别语思维链] ')
    .replace(/^#Task(?:\[[^\]]*\])?\s*/gmu, '[工程任务] ')
    .replace(/^#SubTask(?:\[[^\]]*\])?\s*/gmu, '[子任务委派] ')
    .replace(/^#SubReport\b\s*/gmu, '[子任务回执] ')
    .replace(/#Contract\[([^\]]*)\]/gu, '[接口契约：$1]')
    .replace(/^#Intent\b\s*:?\s*/gmu, '• 核心意图：')
    .replace(/^#Plan\b\s*:?\s*/gmu, '• 执行计划：')
    .replace(/^#Stack\b\s*:?\s*/gmu, '• 技术栈与约束：')
    .replace(/^#Files\b\s*:?\s*/gmu, '• 涉及文件状态：')
    .replace(/^#DiagFix\b\s*:?\s*/gmu, '• 故障定位与修复：')
    .replace(/^#Pending\b\s*:?\s*/gmu, '• 待办事项：')
    .replace(/^#Next\b\s*:?\s*/gmu, '• 下一步动作：')
    .replace(/@in\(zh\)/gu, '输入(汉语)')
    .replace(/@in\(en\)/gu, '输入(英语)')
    .replace(/@out\(zh-CN\)|@reply\(zh-CN\)|@out=zh-CN/gu, '交付(中文)')
    .replace(/@out\(en-US\)|@reply\(en-US\)|@out=en-US/gu, '交付(English)')
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
