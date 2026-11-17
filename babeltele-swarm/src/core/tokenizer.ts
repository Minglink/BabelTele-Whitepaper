import { getEncoding, type Tiktoken } from 'js-tiktoken';

let sharedEncoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!sharedEncoder) {
    sharedEncoder = getEncoding('o200k_base');
  }
  return sharedEncoder;
}

/**
 * Counts exact tokens using OpenAI's o200k_base BPE tokenizer (via pure-JS js-tiktoken).
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}

/**
 * Computes percentage reduction from baselineTokens -> compactTokens.
 */
export function computeSavedPercent(compactTokens: number, baselineTokens: number): number {
  if (baselineTokens <= 0) return 0;
  const saved = ((baselineTokens - compactTokens) / baselineTokens) * 100;
  return Math.round(saved * 10) / 10;
}
