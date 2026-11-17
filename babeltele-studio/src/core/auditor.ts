export type AnchorCategory =
  | "placeholder"
  | "url"
  | "ip_port"
  | "version"
  | "path"
  | "identifier"
  | "http_method"
  | "number";

export interface ExtractedAnchor {
  value: string;
  category: AnchorCategory;
}

export interface AuditResult {
  passed: boolean;
  totalAnchors: number;
  matchedAnchors: string[];
  missingAnchors: string[];
  negationPreserved: boolean;
  sourceHasNegation: boolean;
  sourceNegations: string[];
  anchorDetails: Array<ExtractedAnchor & { matched: boolean }>;
  auditDurationMs: number;
}

/**
 * Polite conversational idioms in Chinese that contain "不" as a rhetorical/polite particle
 * rather than a semantic logical negation (e.g., "能不能帮我看看", "不好意思").
 */
const POLITE_NON_NEGATION_PATTERNS: RegExp[] = [
  /能不能/g,
  /可不可以/g,
  /行不行/g,
  /好不好/g,
  /方不方便/g,
  /是不是/g,
  /对不对/g,
  /不好意思/g,
  /不客气/g,
  /不要紧/g,
  /不妨/g,
  /不得不说/g,
  /不知(?:道)?(?:能不能|可否)/g,
];

const SOURCE_NEGATION_REGEXES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /严禁|绝对禁止|禁止/g, label: "禁止/严禁" },
  { pattern: /不得|不可|切勿|绝不|不准|不允许/g, label: "不得/切勿" },
  { pattern: /除非|除了|但排除|排除掉|豁免/g, label: "除非/排除" },
  { pattern: /不要|不能|不会|不许|无需|不必/g, label: "不要/不能" },
  { pattern: /未(?:经|配置|设置|指定|提供|授权|登录|通过|找到)|缺失|不存在|为空/g, label: "缺失/未" },
  { pattern: /(?<![a-zA-Z])(?:not|never|except|unless|without|forbid|forbidden|prohibit|prohibited)(?![a-zA-Z])/gi, label: "EN_NEG" },
  { pattern: /(?<![\u4e00-\u9fa5])不(?=[\u4e00-\u9fa5a-zA-Z0-9])/g, label: "不" },
];

/**
 * Checks whether compiled BabelTele preserves logical negation or exception boundaries.
 * Accepts canonical BT-Spec v1.0 symbolic operators (!, ¬, !=, ∉, ⇎, NULL) or lexical negation/rejection.
 */
const BT_NEGATION_CHECK_REGEX =
  /(?:!|¬|∉|⇎|\bNULL\b|不|禁|非|无|未|勿|除|免|拒|错|\b(?:not|never|no|without|except|unless|forbid|forbidden|prohibit|prohibited|deny|denied|reject|rejected|drop|block|err|error|invalid|missing|none)\b)/i;

/**
 * Common uppercase words in natural prose that shouldn't be misclassified as HTTP methods unless uppercase in context.
 */
const HTTP_METHODS_REGEX = /\b(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g;

function stripTrailingPunct(raw: string): string {
  return raw.replace(/[.,;:!?，。；：！？)\]}>"'`]+$/, "");
}

/**
 * Masks matched spans with spaces of equal length so subsequent regexes do not double-extract substrings
 * (e.g., preventing `1.2.3` inside `v1.2.3` or `200` inside `o200k_base` from being re-extracted).
 */
function maskSpan(chars: string[], start: number, length: number): void {
  for (let i = start; i < start + length && i < chars.length; i++) {
    chars[i] = " ";
  }
}

/**
 * Mechanically extracts all Tier-1 hard anchors from source text:
 * - Placeholders (`BIBREF`, `TABREF`, `FIGREF`, `EQREF`)
 * - URLs (`https://...`, `http://...`)
 * - IPv4 addresses & `localhost:PORT` / `:PORT`
 * - Version strings (`v1.2.3`, `v1.0`)
 * - File & API paths (`/healthz`, `/api/v1/orders`, `C:\...`)
 * - Code identifiers (`camelCase`, `PascalCase`, `snake_case`, dotted config keys `JWT.alg`)
 * - HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`)
 * - Exact numbers, decimals, percentages, scientific notation, power expressions (`2^159`, `3e-4`, `99.5%`, `401`)
 */
export function extractHardAnchors(sourceText: string): ExtractedAnchor[] {
  if (!sourceText) return [];

  const seen = new Set<string>();
  const anchors: ExtractedAnchor[] = [];
  const pushAnchor = (value: string, category: AnchorCategory) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    anchors.push({ value: trimmed, category });
  };

  const workingChars = sourceText.split("");
  const currentWorking = () => workingChars.join("");

  // Remove markdown ordered-list prefixes at line start (e.g., "1. ", "2、", "3) ") so bullet indices
  // are not confused with domain numeric hard anchors.
  const listBulletRegex = /(?:^|\r?\n)\s*(\d{1,2}[.、)])(?=\s+\S)/g;
  let m: RegExpExecArray | null;
  while ((m = listBulletRegex.exec(sourceText)) !== null) {
    const bulletOffset = m.index + m[0].length - m[1].length;
    maskSpan(workingChars, bulletOffset, m[1].length);
  }

  // 1. Placeholders: BIBREF, TABREF, FIGREF, EQREF
  const placeholderRegex = /\b(?:BIBREF|TABREF|FIGREF|EQREF)(?:_[A-Za-z0-9]+|\d+)?\b/g;
  let textSnap = currentWorking();
  while ((m = placeholderRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "placeholder");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // 2. URLs
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/g;
  textSnap = currentWorking();
  while ((m = urlRegex.exec(textSnap)) !== null) {
    const cleanUrl = stripTrailingPunct(m[0]);
    pushAnchor(cleanUrl, "url");
    maskSpan(workingChars, m.index, cleanUrl.length);
  }

  // 3. IPv4 (+ optional :port / CIDR) and host:port
  const ipPortRegex =
    /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/\d{1,2})?\b|\blocalhost:\d{2,5}\b/g;
  textSnap = currentWorking();
  while ((m = ipPortRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "ip_port");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // 4. Version strings (e.g. v1.0, v1.2.3, v24.19.0-rc.1)
  const versionRegex = /\bv\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?\b/g;
  textSnap = currentWorking();
  while ((m = versionRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "version");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // 5. API routes & file paths (e.g. /healthz, /api/v1/orders, src/core/auditor.ts)
  const pathRegex =
    /(?:^|(?<=[\s"'`(:=]))(\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-{}*:]+)*|[a-zA-Z]:\\[a-zA-Z0-9_.\-\\]+)/g;
  textSnap = currentWorking();
  while ((m = pathRegex.exec(textSnap)) !== null) {
    const candidate = stripTrailingPunct(m[1]);
    // Avoid matching simple slash alternatives like "/or" unless realistic endpoint/path (>=3 chars)
    if (candidate.length >= 3 && !/^\/\d+$/.test(candidate)) {
      const startIdx = m.index + m[0].indexOf(candidate);
      pushAnchor(candidate, "path");
      maskSpan(workingChars, startIdx, candidate.length);
    }
  }

  // 6. HTTP methods (exact uppercase)
  textSnap = currentWorking();
  while ((m = HTTP_METHODS_REGEX.exec(textSnap)) !== null) {
    pushAnchor(m[0], "http_method");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // 7. Code identifiers: dotted properties (JWT.alg, redis.lock), snake_case, camelCase, PascalCase
  const dottedIdRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+\b/g;
  textSnap = currentWorking();
  while ((m = dottedIdRegex.exec(textSnap)) !== null) {
    // Exclude ordinary file abbreviations like e.g. or i.e.
    if (!/^(?:e\.g|i\.e|et\.al|vs\.|cf\.)$/i.test(m[0])) {
      pushAnchor(m[0], "identifier");
      maskSpan(workingChars, m.index, m[0].length);
    }
  }

  const codeIdRegex =
    /\b(?:[a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]*)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+)\b/g;
  textSnap = currentWorking();
  while ((m = codeIdRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "identifier");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // Mask well-known alphanumeric protocol/chemical tokens whose embedded digit is part of a word
  // (e.g., OAuth2, SHA256, RS256, HS256, Base64, UTF-8, CO2, H2O, Q1-Q4, HTTP/2, HTTP/3, GPT-4o, L1-L5)
  // while extracting them as identifiers ONLY if they are concrete cryptographic/algorithm/chemical identifiers.
  const embeddedDigitTokenRegex = /\b(?:RS256|HS256|ES256|SHA256|SHA512|MD5|OAuth2|IPv4|IPv6|CO2|H2O)\b/g;
  textSnap = currentWorking();
  while ((m = embeddedDigitTokenRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "identifier");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // Also mask general identifier tokens containing letters+digits like Q3, v2, GPT4, Qwen2 so bare "3" isn't falsely torn out if Q3 stays Q3
  const alphaNumWordRegex = /\b[A-Za-z]+\d+[A-Za-z0-9]*\b/g;
  textSnap = currentWorking();
  while ((m = alphaNumWordRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "identifier");
    maskSpan(workingChars, m.index, m[0].length);
  }

  // 8. Exact numbers: scientific notation (3e-4), powers (2^159), percentages (99.5%, 30%),
  // comma-formatted numbers (10,000), decimals (3.14), and integers (401, 500, 3721)
  const numberRegex =
    /(?<![A-Za-z0-9_])(?:\d+\^\d+|\d+(?:\.\d+)?[eE][+-]?\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|\d+(?:\.\d+)?%)(?![0-9])|(?<![A-Za-z0-9_.])\d+(?:\.\d+)?(?![0-9.])/g;
  textSnap = currentWorking();
  while ((m = numberRegex.exec(textSnap)) !== null) {
    pushAnchor(m[0], "number");
    maskSpan(workingChars, m.index, m[0].length);
  }

  return anchors;
}

/**
 * Extracts semantic negation and exception triggers from source text,
 * ignoring polite Chinese conversational particles like "能不能" or "不好意思".
 */
export function extractSourceNegations(sourceText: string): string[] {
  if (!sourceText) return [];
  let cleaned = sourceText;
  for (const polite of POLITE_NON_NEGATION_PATTERNS) {
    cleaned = cleaned.replace(polite, " ");
  }

  const found = new Set<string>();
  for (const { pattern } of SOURCE_NEGATION_REGEXES) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(cleaned)) !== null) {
      found.add(m[0]);
    }
  }
  return Array.from(found);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks bit-exact preservation of a single hard anchor inside compiled BabelTele text.
 * For numeric anchors, enforces digit boundaries so `80` does not falsely match `800`.
 */
export function isAnchorPreserved(anchor: ExtractedAnchor, btText: string): boolean {
  if (!btText) return false;
  const val = anchor.value;

  if (anchor.category === "number") {
    // Allow exact match with digit boundaries (e.g., `<=20oct` matches `20`, but `200` does NOT match `20`)
    const escaped = escapeRegExp(val);
    const boundaryRegex = new RegExp(`(?<![0-9])${escaped}(?![0-9])`);
    if (boundaryRegex.test(btText)) {
      return true;
    }
    // If source number had thousands commas (e.g., "10,000"), also accept exact ungrouped digits ("10000")
    // and standard exact K/M shorthand only when exact integer multiple (e.g., 10,000 -> 10000)
    if (val.includes(",")) {
      const noComma = val.replace(/,/g, "");
      const noCommaRegex = new RegExp(`(?<![0-9])${escapeRegExp(noComma)}(?![0-9])`);
      if (noCommaRegex.test(btText)) {
        return true;
      }
    }
    return false;
  }

  if (anchor.category === "identifier" || anchor.category === "http_method" || anchor.category === "placeholder") {
    // Exact case-sensitive identifier check; also check case-insensitive only if exact fails?
    // BT-Spec v1.0 requires bit-exact identifier preservation.
    return btText.includes(val);
  }

  return btText.includes(val);
}

/**
 * Tier-1 Deterministic Hard-Anchor Auditor (<2ms).
 * Verifies bit-exact preservation of numbers, versions, URLs/IPs/paths, code identifiers,
 * BIBREF/TABREF placeholders, and critical logical negation/exception markers.
 */
export function auditBabelTele(sourceText: string, btText: string): AuditResult {
  const t0 = performance.now();
  const extracted = extractHardAnchors(sourceText);
  const matchedAnchors: string[] = [];
  const missingAnchors: string[] = [];
  const anchorDetails: Array<ExtractedAnchor & { matched: boolean }> = [];

  for (const anchor of extracted) {
    const matched = isAnchorPreserved(anchor, btText);
    anchorDetails.push({ ...anchor, matched });
    if (matched) {
      matchedAnchors.push(anchor.value);
    } else {
      missingAnchors.push(anchor.value);
    }
  }

  const sourceNegations = extractSourceNegations(sourceText);
  const sourceHasNegation = sourceNegations.length > 0;
  const negationPreserved = !sourceHasNegation || BT_NEGATION_CHECK_REGEX.test(btText);

  const passed = missingAnchors.length === 0 && negationPreserved;
  const auditDurationMs = Math.round((performance.now() - t0) * 100) / 100;

  return {
    passed,
    totalAnchors: extracted.length,
    matchedAnchors,
    missingAnchors,
    negationPreserved,
    sourceHasNegation,
    sourceNegations,
    anchorDetails,
    auditDurationMs,
  };
}

/**
 * Deterministic Safety Net: if an upstream LLM dropped any hard anchor or negation marker,
 * appends a compact `![Lock: ...]` clause so downstream consumers never suffer silent numeric drift.
 */
export function enforceAnchorLock(btText: string, auditResult: AuditResult): string {
  if (auditResult.passed) {
    return btText;
  }
  const lockItems = [...auditResult.missingAnchors];
  if (!auditResult.negationPreserved && auditResult.sourceNegations.length > 0) {
    lockItems.push(`!neg(${auditResult.sourceNegations[0]})`);
  }
  if (lockItems.length === 0) {
    return btText;
  }
  const trimmed = btText.trim();
  const sep = trimmed.length > 0 ? " " : "";
  return `${trimmed}${sep}![Lock: ${lockItems.join(", ")}]`;
}
