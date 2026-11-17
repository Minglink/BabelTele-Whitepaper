import { randomUUID } from 'node:crypto';
import { getShowcaseBlueprint } from '../core/demoBlueprints';
import { callChatCompletion, paceSimulatedTokens } from '../core/llmDriver';
import { decodeBabelTeleToZh } from '../core/sidecarDecoder';
import { countTokens } from '../core/tokenizer';
import type { BusMode, ControlPlaneMessage, LlmConfig, TargetLanguage } from '../types';

export interface PmSpecInput {
  prompt: string;
  language: TargetLanguage;
  busMode: BusMode;
  llm: LlmConfig;
  simulateStreamingDelay: boolean;
}

export interface PmSpecOutput {
  prdSpec: string;
  btPrdEquivalent: string;
  verbosePrdEquivalent: string;
  message: ControlPlaneMessage;
}

export async function runPmSpecAgent(input: PmSpecInput): Promise<PmSpecOutput> {
  const { prompt, language, busMode, llm, simulateStreamingDelay } = input;
  const blueprint = getShowcaseBlueprint(language);

  let btPrd = blueprint.btPrd;
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt && trimmedPrompt !== blueprint.defaultPromptZh) {
    const shortTopic = trimmedPrompt.replace(/[\[\]|]/g, ' ').slice(0, 26);
    btPrd = `#PRD[dom:${shortTopic} | lang:${language} | goals:核心领域模型+并发/安全守卫+核心编排+自动化自测 | inv:!Guard(type_safe) & !Guard(zero_leak) | slo:编译与单测100%通过]`;
  }
  const verbosePrd = blueprint.verbosePrd;

  if (llm.engine === 'demo-sim') {
    const chosen = busMode === 'babeltele' ? btPrd : verbosePrd;
    const tokens = countTokens(chosen);
    const baselineTokens = countTokens(verbosePrd);
    const latencyMs = await paceSimulatedTokens(tokens, simulateStreamingDelay);
    const decoded = decodeBabelTeleToZh(chosen);

    return {
      prdSpec: chosen,
      btPrdEquivalent: btPrd,
      verbosePrdEquivalent: verbosePrd,
      message: {
        id: `msg-pm-${randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        agent: 'PM-Spec',
        busMode,
        stage: 'prd',
        rawContent: chosen,
        humanZh: decoded.decodedZh,
        tokens,
        baselineVerboseTokens: baselineTokens,
        latencyMs,
      },
    };
  }

  // Real LLM Execution (Ollama or OpenAI-compatible API)
  const systemPrompt =
    busMode === 'babeltele'
      ? [
          'You are PM-Spec in a Dual-Plane BabelTele Multi-Agent Swarm.',
          'Convert the user project brief into a SINGLE-LINE ultra-dense BT-Skeleton #PRD block (< 100 tokens).',
          'STRICT FORMAT: #PRD[dom:<domain> | lang:<language> | goals:<k1+k2+k3> | inv:!Guard(<inv1>) & !Guard(<inv2>) | slo:<acceptance>]',
          'Output ONLY the #PRD[...] line. Zero greetings, zero markdown fences, zero explanations.',
        ].join('\n')
      : [
          'You are a Product Manager Agent in a multi-agent software team.',
          'Write a detailed, polite, multi-section natural language Product Requirements Document (PRD) in English/Chinese (~220-320 words) for the Architect and Coder agents.',
        ].join('\n');

  const userPrompt = `Target Language: ${language}\nUser Project Brief: ${prompt}`;
  const res = await callChatCompletion(llm, systemPrompt, userPrompt);
  const content = res.content.trim();
  const tokens = countTokens(content);
  const decoded = decodeBabelTeleToZh(content);

  return {
    prdSpec: content,
    btPrdEquivalent: busMode === 'babeltele' ? content : btPrd,
    verbosePrdEquivalent: busMode === 'verbose-nl' ? content : verbosePrd,
    message: {
      id: `msg-pm-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      agent: 'PM-Spec',
      busMode,
      stage: 'prd',
      rawContent: content,
      humanZh: decoded.decodedZh,
      tokens,
      baselineVerboseTokens: busMode === 'babeltele' ? Math.max(tokens * 3, countTokens(verbosePrd)) : tokens,
      latencyMs: res.latencyMs,
    },
  };
}
