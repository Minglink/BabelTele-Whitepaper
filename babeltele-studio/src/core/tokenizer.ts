import { getEncoding, type Tiktoken } from "js-tiktoken";

export type BpeEncodingName = "o200k_base" | "cl100k_base";

export interface SingleEncodingMetrics {
  encoding: BpeEncodingName;
  sourceTokens: number;
  compiledTokens: number;
  /** ΔL_BPE = compiledTokens - sourceTokens (strictly < 0 required by BT-Spec v1.0) */
  deltaTokens: number;
  /** sourceTokens - compiledTokens */
  savedTokens: number;
  /** Percentage of tokens eliminated: (1 - compiled / source) * 100 */
  compressionRatioPct: number;
  /** Percentage of original token length retained: (compiled / source) * 100 */
  retentionPct: number;
  /** True when sourceTokens > 0 and ΔL_BPE >= 0 (no net subword BPE reduction) */
  naiveSymbolIllusion: boolean;
}

export interface DualTokenizerReport {
  sourceChars: number;
  compiledChars: number;
  charReductionPct: number;
  o200k_base: SingleEncodingMetrics;
  cl100k_base: SingleEncodingMetrics;
  /** True when primary modern tokenizer (o200k_base) achieves ΔL_BPE < 0 */
  netBenefitAchieved: boolean;
  /** True when ΔL_BPE >= 0 in either o200k_base or cl100k_base */
  naiveSymbolIllusion: boolean;
  /** True when visual characters decreased yet BPE subword tokens increased or stayed flat */
  visualIllusionTrap: boolean;
}

export interface DualTokenSnapshot {
  chars: number;
  o200k_base: number;
  cl100k_base: number;
}

let cachedO200k: Tiktoken | null = null;
let cachedCl100k: Tiktoken | null = null;

function getCachedEncoder(encoding: BpeEncodingName): Tiktoken {
  if (encoding === "o200k_base") {
    if (!cachedO200k) {
      cachedO200k = getEncoding("o200k_base");
    }
    return cachedO200k;
  }
  if (!cachedCl100k) {
    cachedCl100k = getEncoding("cl100k_base");
  }
  return cachedCl100k;
}

export function warmupTokenizers(): void {
  getCachedEncoder("o200k_base");
  getCachedEncoder("cl100k_base");
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Computes exact BPE subword token count using js-tiktoken.
 */
export function countTokens(text: string, encoding: BpeEncodingName = "o200k_base"): number {
  if (!text) return 0;
  const encoder = getCachedEncoder(encoding);
  return encoder.encode(text, "all").length;
}

/**
 * Computes live character and dual-BPE token counts for a single string.
 */
export function countDualTokens(text: string): DualTokenSnapshot {
  if (!text) {
    return { chars: 0, o200k_base: 0, cl100k_base: 0 };
  }
  return {
    chars: Array.from(text).length,
    o200k_base: countTokens(text, "o200k_base"),
    cl100k_base: countTokens(text, "cl100k_base"),
  };
}

export function computeEncodingMetrics(
  sourceText: string,
  compiledText: string,
  encoding: BpeEncodingName,
): SingleEncodingMetrics {
  const sourceTokens = countTokens(sourceText, encoding);
  const compiledTokens = countTokens(compiledText, encoding);
  const deltaTokens = compiledTokens - sourceTokens;
  const savedTokens = sourceTokens - compiledTokens;
  const compressionRatioPct =
    sourceTokens > 0 ? round2((1 - compiledTokens / sourceTokens) * 100) : 0;
  const retentionPct =
    sourceTokens > 0 ? round2((compiledTokens / sourceTokens) * 100) : compiledTokens > 0 ? 100 : 0;
  const naiveSymbolIllusion = sourceTokens > 0 && deltaTokens >= 0;

  return {
    encoding,
    sourceTokens,
    compiledTokens,
    deltaTokens,
    savedTokens,
    compressionRatioPct,
    retentionPct,
    naiveSymbolIllusion,
  };
}

/**
 * Full BT-Spec v1.0 BPE Token Accountant across o200k_base and cl100k_base.
 * Detects the "Naive Symbol Illusion" (ΔL_BPE >= 0 despite shorter visual character length).
 */
export function compareTokenMetrics(
  sourceText: string,
  compiledText: string,
): DualTokenizerReport {
  const sourceChars = Array.from(sourceText).length;
  const compiledChars = Array.from(compiledText).length;
  const charReductionPct =
    sourceChars > 0 ? round2((1 - compiledChars / sourceChars) * 100) : 0;

  const o200k = computeEncodingMetrics(sourceText, compiledText, "o200k_base");
  const cl100k = computeEncodingMetrics(sourceText, compiledText, "cl100k_base");

  const netBenefitAchieved = o200k.deltaTokens < 0;
  const naiveSymbolIllusion = o200k.naiveSymbolIllusion || cl100k.naiveSymbolIllusion;
  const visualIllusionTrap =
    compiledChars < sourceChars && (o200k.deltaTokens >= 0 || cl100k.deltaTokens >= 0);

  return {
    sourceChars,
    compiledChars,
    charReductionPct,
    o200k_base: o200k,
    cl100k_base: cl100k,
    netBenefitAchieved,
    naiveSymbolIllusion,
    visualIllusionTrap,
  };
}

/**
 * Compares two candidate lexical/symbolic forms under Axiom I (Omnilingual Minimization).
 */
export function probeSymbolEfficiency(candidateA: string, candidateB: string): {
  candidateA: DualTokenSnapshot & { text: string };
  candidateB: DualTokenSnapshot & { text: string };
  recommended: string;
} {
  const snapA = countDualTokens(candidateA);
  const snapB = countDualTokens(candidateB);
  const scoreA = snapA.o200k_base + snapA.cl100k_base;
  const scoreB = snapB.o200k_base + snapB.cl100k_base;
  return {
    candidateA: { text: candidateA, ...snapA },
    candidateB: { text: candidateB, ...snapB },
    recommended: scoreB < scoreA ? candidateB : candidateA,
  };
}
