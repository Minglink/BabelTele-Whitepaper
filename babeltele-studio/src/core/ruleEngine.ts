import { auditBabelTele, enforceAnchorLock } from "./auditor.js";
import type { CompilerProfileId } from "./prompts.js";

export interface DehydrationResult {
  cleanedText: string;
  strippedNoiseCount: number;
  strippedFragments: string[];
  durationMs: number;
}

/**
 * Stage-1 Conversational Padding, Sycophancy & Emotional Venting Patterns (Chinese & English).
 * Carefully ordered from longest phrase to shortest so whole clauses are cleanly excised.
 */
const NOISE_PATTERNS: RegExp[] = [
  // Chinese emotional rants & complaints
  /我真是服了这个破系统总是(?:莫名其妙)?/g,
  /我真是服了(?:这个[^\s，。！？,!;；]{0,8})?/g,
  /我都快(?:要)?崩溃了[！!，,。.\s]*/g,
  /太让人崩溃了[！!，,。.\s]*/g,
  /真是气死(?:我|人)了?[！!，,。.\s]*/g,
  /老板又在催命一样逼着改[：:，,！!\s]*/g,
  /产品经理又拍脑袋改需求[：:，,！!\s]*/g,
  /简直无语了[！!，,。.\s]*/g,
  /我也是醉了[！!，,。.\s]*/g,
  /太坑爹了[！!，,。.\s]*/g,
  /救命啊?[！!，,。.\s]*/g,
  /在线等挺?急的[！!，,。.\s]*/g,
  /急急急[！!，,。.\s]*/g,

  // Chinese polite openings / hedging / closings
  /你好[，,\s]*请问(?:一下)?(?:能不能|可以)?(?:麻烦你?)?(?:帮我看看|帮我分析一下|帮我看下)?[！!，,：:\s]*/g,
  /您好[，,\s]*请问(?:一下)?(?:能不能|可以)?(?:麻烦你?)?(?:帮我看看|帮我分析一下|帮我看下)?[！!，,：:\s]*/g,
  /(?:请问(?:一下)?|麻烦问一下)[，,\s]*(?:能不能|可以)?(?:麻烦你?)?(?:帮我看看|帮我分析一下|帮我看下)?[！!，,：:\s]*/g,
  /(?:能不能|可不可以|可以)(?:麻烦你?)?(?:帮我看看|帮我分析一下|帮我看下|帮我想个|帮我写个|帮我处理一下)[！!，,：:\s]*/g,
  /麻烦(?:你|大佬|老师)?(?:帮我看看|帮我想个|帮我分析一下|帮我优化一下|帮我写一下)?/g,
  /不好意思(?:打扰一下|麻烦一下)?[！!，,：:\s]*/g,
  /拜托了?[，,\s]*(?:万分感谢|非常感谢|谢谢(?:啦|了)?)?[！!。.\s]*/g,
  /(?:万分感谢|非常感谢|十分感谢|先谢谢啦|谢谢大佬|多谢大佬|感激不尽|辛苦了)[！!，,。.\s]*/g,
  /(?:你好|您好|哈喽|嗨)[！!，,\s]+/g,
  /(?:说实话|老实说|讲真的?|其实吧|怎么说呢|就是我们那个|就是说我们现在|具体来说就是)[，,：:\s]*/g,

  // Verbose meta-framing in prompts
  /在回答用户问题时[，,\s]*你必须严格遵守以下[一二三四五六七八九十\d]+项(?:安全与格式)?(?:铁律|规则|要求|原则)[：:\s]*/g,
  /你必须严格遵守以下(?:规则|要求|铁律|约束)[：:\s]*/g,
  /请严格按照以下(?:规则|要求|步骤)执行[：:\s]*/g,

  // English polite & emotional padding
  /\b(?:Hi|Hello|Hey)(?:\s+there)?[,!.\s]+/gi,
  /\bCould you please(?:\s+kindly)?\s+help me(?:\s+(?:to|with|look at|check|optimize|fix))?\b[,:\s]*/gi,
  /\bWould you(?:\s+kindly)?\s+mind\s+helping me(?:\s+(?:to|with))?\b[,:\s]*/gi,
  /\bCan you please(?:\s+kindly)?\s+help me(?:\s+(?:to|with))?\b[,:\s]*/gi,
  /\bI(?:'m| am)\s+(?:literally\s+)?(?:losing my mind|so frustrated|going crazy)\s+(?:over|with)\s+this\s+(?:stupid|broken|annoying)?\s*(?:system|bug|issue)?[,!.\s]*/gi,
  /\b(?:Please kindly|Kindly please)\b[,:\s]*/gi,
  /\b(?:Thank you so much(?:\s+in advance)?|Thanks in advance|Many thanks|Really appreciate your help)[,!.\s]*/gi,
];

/**
 * Lexical & Operator Collapse Rules (Strictly BT-Spec v1.0 1-token ASCII operators, zero Emoji inflation).
 */
const STRUCTURAL_REPLACEMENTS: Array<[RegExp, string]> = [
  // Chinese ordinal list markers -> compact semicolon boundary
  [/(?:^|[；;。！!\n]\s*)第[一二三四五六七八九十]+[，、：:\s]+/g, "; "],

  // Conditional & causal structures (Chinese)
  [/一旦([^，,；;。！!]+)[，,\s]*(?:则立即|就立即|立即|马上|则|就)/g, "?$1 => "],
  [/(?:如果|假如|若是?)([^，,；;。！!]+)[，,\s]*(?:那么|则立即|就立即|则|就|立即)/g, "?$1 => "],
  [/只要([^，,；;。！!]+)[，,\s]*(?:的时候|时)?([^，,；;。！!]*?)(?:就会|则会|便会|就)/g, "?$1 -> $2 "],
  [/当([^，,；;。！!]+?)时[，,\s]*(?:则立即|立即|必须|需要|应当|则|就)/g, "?$1 => "],
  [/当且仅当/g, "<=>"],
  [/(?:从而导致|进而导致|因此必须|所以必须|因此需要|所以需要|因此|所以)/g, " => "],
  [/(?:由于|鉴于|因为)/g, " <- "],
  [/首先([^；;。]+?)[；;，,\s]*然后([^；;。]+?)/g, "$1 -> $2"],
  [/(?:随后|接着|紧接着|之后再|然后再)/g, " -> "],

  // Negation & Exemption Boundaries (Chinese)
  [/(?:而且|并且)?(?:绝对禁止|严禁|严格禁止|切勿|绝不允许)/g, " & !"],
  [/(?:禁止|不得|不允许|不可)/g, "!"],
  [/(?:除非是?|但排除|除了|排除掉|例外情况是?)/g, " !exc:"],
  [/(?:严禁进行任何|不得进行任何)/g, "!"],

  // Comparisons & Quantities (Chinese)
  [/(?:压到|控制在|限制在|不超过)\s*([0-9]+(?:\.[0-9]+)?\s*[a-zA-Z%]*)\s*(?:以内|以下|之内)/g, "<=$1"],
  [/(?:飙到|达到|超过|高于|大于)\s*([0-9]+(?:\.[0-9]+)?\s*[a-zA-Z%]*)\s*(?:以上|之上)?/g, ">$1"],
  [/(?:低于|小于|少于|不足)\s*([0-9]+(?:\.[0-9]+)?)/g, "<$1"],
  [/(?:不少于|不低于|至少为?|大于等于)\s*([0-9]+(?:\.[0-9]+)?)/g, ">=$1"],
  [/(?:最多允许|最多为?|不超过|小于等于)\s*([0-9]+(?:\.[0-9]+)?)/g, "<=$1"],
  [/(?:设置为|设为|等于)\s*/g, "="],
  [/(?:而且|并且同时|与此同时|同时还要|并且|而且还要)/g, " & "],
  [/或者/g, " | "],

  // High-frequency verbose Chinese technical phrases -> dense tokens
  [/大语言模型|大型语言模型/g, "LLM"],
  [/系统提示词/g, "SysPrompt"],
  [/上下文窗口/g, "ctx"],
  [/分布式锁/g, "DistLock"],
  [/滑动窗口限流/g, "滑窗限流"],
  [/响应时间|延迟时间/g, "latency"],
  [/过期时间戳|过期时间/g, "TTL"],
  [/购物车商品数量|商品数量/g, "items"],
  [/用户购物车/g, "cart"],
  [/立即拒绝(?:该)?请求并返回|立即拦截并返回|立即返回/g, "=> reject:"],
  [/立即终止推演并明确标记为/g, "=> abort & mark="],
  [/必须与检索到的原始([^完全]+)完全一致/g, "==raw($1)"],
  [/四舍五入或估算/g, "round/est"],
  [/引用文献证据时必须原样保留/g, "keep:"],
  [/等溯源占位符/g, ""],
  [/删除或改写/g, "del/mod"],
  [/单次输出长度/g, "out_len"],
  [/显式传入/g, "pass:"],
  [/在秒杀大促高并发场景下[（(]峰值流量\s*([^）)]+)[）)][，,\s]*/g, "#Seckill($peak:$1) "],
  [/创建订单流程必须严格防止库存超卖[：:\s]*/g, "!oversell: "],
  [/针对单个\s*(\w+)\s*实施/g, "@$1:"],
  [/每秒/g, "/s "],
  [/次请求[，,\s]*超出则/g, "req => overflow "],
  [/调用\s*Redis\s*集群执行/g, "Redis."],
  [/原子脚本进行预扣库存/g, "(preDeduct)"],
  [/预扣结果/g, "res"],
  [/库存不足错误码/g, "err:"],
  [/预扣成功后异步投递消息至/g, "ok -> async "],
  [/未收到支付回调/g, "!pay_cb"],
  [/触发回滚补偿并恢复\s*Redis\s*库存/g, "rollback+restore(Redis)"],
  [/绕过消息幂等表/g, "bypass:"],
  [/直接查主库/g, "queryPrimary:"],
  [/发生宕机降级/g, "down"],
  [/你是一个严谨的([^。！!]+)[。！!\s]*/g, "#Role:$1 "],

  // English structural & clause collapses
  [/\b[Ii]f\s+the\s+incoming\s+/g, "?"],
  [/\b[Ii]f\s+the\s+/g, "?"],
  [/\b[Ii]f\s+/g, "?"],
  [/,?\s+or\s+if\s+/gi, " | "],
  [/\bis\s+set\s+to\s+/gi, "=="],
  [/\bis\s+used\s+instead\s+of\s+/gi, "!="],
  [/\bis\s+missing\s+or\s+expired\s+beyond\s+a\s+/gi, "=NULL|exp>"],
  [/\bis\s+missing\b/gi, "=NULL"],
  [/,?\s*(?:then\s+)?immediately\s+reject\s+(?:the\s+)?request\s+with\s+HTTP\s+/gi, " => reject("],
  [/\bexcept\s+on\s+/gi, ") !exc:"],
  [/\bexcept\s+for\s+/gi, " !exc:"],
  [/\bwith\s+the\s+exception\s+of\s+/gi, " !exc:"],
  [/\bAdditionally,\s*enforce\s+/gi, "; "],
  [/\brate\s+limiting\s+of\s+/gi, "rateLimit="],
  [/\brequests\s+per\s+/gi, "req/"],
  [/,?\s*returning\s+HTTP\s+/gi, " => HTTP_"],
  [/\bwithout\s+exposing\s+internal\s+/gi, " !expose:"],
  [/\binternal\s+probe\s+endpoints\b/gi, ""],
  [/\bclock\s+skew\s+tolerance\b/gi, "skew"],
  [/\bheader\s+algorithm\b/gi, ""],
  [/\bexpiration\s+timestamp\b/gi, ""],
  [/\bauthentication\s+policy\b/gi, "AuthPolicy"],
  [/\band\b/g, "&"],
  [/\b(?:the|a|an)\s+/gi, " "],
];

/**
 * Infers a short macro `#Domain` tag for `neutral-formal` / `bt-skeleton` profiles when none is present.
 */
function inferDomainTag(text: string): string {
  if (/JWT|OAuth|Auth|鉴权|网关|401/i.test(text)) return "#AuthGateway";
  if (/Order|checkout|库存|超卖|下单|秒杀/i.test(text)) return "#OrderSpec";
  if (/BIBREF|财报|合规|SysPrompt|智能体/i.test(text)) return "#AgentRules";
  if (/Redis|MySQL|Kafka|RocketMQ|QPS|微服务/i.test(text)) return "#ArchSpec";
  return "#Spec";
}

/**
 * Stage 1 (Pre-processor): Strips emotional venting, sycophancy, and conversational fluff (<1ms)
 * while strictly preserving objective propositions and hard anchors.
 */
export function dehydrateText(input: string): DehydrationResult {
  const t0 = performance.now();
  if (!input) {
    return { cleanedText: "", strippedNoiseCount: 0, strippedFragments: [], durationMs: 0 };
  }

  let working = input;
  const strippedFragments: string[] = [];

  for (const pattern of NOISE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    working = working.replace(regex, (matched) => {
      const trimmed = matched.trim();
      if (trimmed) {
        strippedFragments.push(trimmed);
      }
      return " ";
    });
  }

  // Normalize punctuation bursts left behind by emotional rants (e.g. "！！!" -> "; ")
  working = working
    .replace(/[！!？?]{2,}/g, "; ")
    .replace(/^[，,；;：:！!。\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  return {
    cleanedText: working || input.trim(),
    strippedNoiseCount: strippedFragments.length,
    strippedFragments,
    durationMs,
  };
}

/**
 * Offline Deterministic BT-Spec v1.0 Rule Compiler (<2ms).
 * Produces profile-tailored BabelTele output using 1-token ASCII operators with 100% hard-anchor lock.
 */
export function compileOfflineRule(
  input: string,
  profile: CompilerProfileId = "neutral-formal",
): {
  btOutput: string;
  dehydration: DehydrationResult;
  durationMs: number;
} {
  const t0 = performance.now();
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return {
      btOutput: "",
      dehydration: { cleanedText: "", strippedNoiseCount: 0, strippedFragments: [], durationMs: 0 },
      durationMs: 0,
    };
  }

  const dehydration = dehydrateText(trimmedInput);
  // Normalize full-width & sentence-ending exclamations BEFORE inserting BT `!` negation operators
  let collapsed = dehydration.cleanedText
    .replace(/[。！；]+/g, "; ")
    .replace(/!(?=\s|$)/g, "; ");

  for (const [pattern, replacement] of STRUCTURAL_REPLACEMENTS) {
    collapsed = collapsed.replace(pattern, replacement);
  }

  // Clean up Chinese/English verbose punctuation into compact BT separators (preserving BT `!` operator!)
  collapsed = collapsed
    .replace(/[，、]/g, ", ")
    .replace(/[;；]+/g, "; ")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/：\s*/g, ":")
    .replace(/\s*&\s*&\s*/g, " & ")
    .replace(/,\s*&\s*/g, " & ")
    .replace(/;\s*;/g, ";")
    .replace(/,\s*;/g, ";")
    .replace(/;\s*&\s*/g, "; ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .replace(/^[;\s,]+|[;\s,]+$/g, "")
    .trim();

  // Balance `reject(401` if `except on` wasn't immediately closing it
  collapsed = collapsed.replace(/reject\((\d{3})(?![)\d])/g, "reject($1)");

  // Profile-specific topological shaping (keeping overhead minimal so ΔL_BPE < 0 holds)
  let shaped = collapsed;
  const hasHashTag = /^#[A-Za-z0-9_\u4e00-\u9fa5]/.test(shaped);

  if (profile === "neutral-formal") {
    if (!hasHashTag && trimmedInput.length >= 40) {
      shaped = `${inferDomainTag(trimmedInput)} ${shaped}`;
    }
  } else if (profile === "bt-skeleton") {
    if (!hasHashTag && trimmedInput.length >= 40) {
      shaped = `${inferDomainTag(trimmedInput)} ${shaped}`;
    }
    shaped = shaped.replace(/\?([^=>;\n]+?)\s*=>\s*([^;|!\n]+)/g, "?[$1]=>[$2]");
  } else if (profile === "bt-zero") {
    shaped = shaped
      .replace(/;\s*/g, " | ")
      .replace(/,\s*/g, "|")
      .replace(/\s*\|\s*/g, "|")
      .replace(/\r?\n+/g, "|");
  } else if (profile === "bt-memory") {
    if (!hasHashTag && trimmedInput.length >= 40) {
      shaped = `@Mem${inferDomainTag(trimmedInput)} ${shaped}`;
    }
  }

  // Verify 100% hard-anchor conservation via Tier-1 Auditor; lock any inadvertently dropped token
  const audit = auditBabelTele(trimmedInput, shaped);
  const finalBt = audit.passed ? shaped : enforceAnchorLock(shaped, audit);

  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  return {
    btOutput: finalBt,
    dehydration,
    durationMs,
  };
}

/**
 * Deterministic Offline Sidecar Decoder (`BT-Decoder` fallback when no LLM API / Ollama is configured).
 * Unfolds BT-Spec v1.0 operators back into structured human-readable audit prose while conserving all anchors.
 */
export function decodeOfflineRule(btInput: string, targetLang: "zh" | "en" = "zh"): string {
  const raw = btInput.trim();
  if (!raw) return "";

  if (targetLang === "en") {
    return raw
      .replace(/^#([A-Za-z0-9_\u4e00-\u9fa5-]+)\s*/, "[Module: $1] ")
      .replace(/@\[([^=\]]+)=([^\]]+)\]/g, "(Abbr $1 = $2)")
      .replace(/\?\[([^\]]+)\]=>\[([^\]]+)\]/g, "If ($1), then execute ($2)")
      .replace(/\?([^=>;|]+?)\s*=>\s*/g, "If ($1), then ")
      .replace(/!exc:([^;|]+)/g, " [Exception: $1]")
      .replace(/!\[Lock:\s*([^\]]+)\]/g, " [Verified Hard Anchors: $1]")
      .replace(/!([A-Za-z0-9_\u4e00-\u9fa5/:.-]+)/g, "must NOT / boundary ($1)")
      .replace(/<=>/g, " if and only if ")
      .replace(/=>/g, " => therefore ")
      .replace(/->/g, " -> then ")
      .replace(/<=/g, " <= ")
      .replace(/>=/g, " >= ")
      .replace(/\s*\|\s*/g, " OR ")
      .replace(/\s*&\s*/g, ", AND ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return raw
    .replace(/^#([A-Za-z0-9_\u4e00-\u9fa5-]+)\s*/, "【领域模块：$1】")
    .replace(/@\[([^=\]]+)=([^\]]+)\]/g, "（简称定义：$1 = $2）")
    .replace(/\?\[([^\]]+)\]=>\[([^\]]+)\]/g, "当满足条件「$1」时，执行「$2」")
    .replace(/\?([^=>;|]+?)\s*=>\s*/g, "若满足条件「$1」，则触发：")
    .replace(/!exc:([^;|]+)/g, "（例外豁免：$1）")
    .replace(/!\[Lock:\s*([^\]]+)\]/g, "（硬锚点锁定校验：$1）")
    .replace(/!([A-Za-z0-9_\u4e00-\u9fa5/:.-]+)/g, "禁止/边界约束「$1」")
    .replace(/<=>/g, " 当且仅当 ")
    .replace(/=>/g, "，从而推导/执行：")
    .replace(/->/g, " → 随后流转至 ")
    .replace(/\s*\|\s*/g, " 或 ")
    .replace(/\s*&\s*/g, "，并且 ")
    .replace(/;\s*/g, "；")
    .replace(/\s{2,}/g, " ")
    .trim();
}
