import { randomUUID } from 'node:crypto';
import { blueprintToManifest, getShowcaseBlueprint } from '../core/demoBlueprints';
import { callChatCompletion, paceSimulatedTokens } from '../core/llmDriver';
import { decodeBabelTeleToZh } from '../core/sidecarDecoder';
import { countTokens } from '../core/tokenizer';
import type {
  ArchitectFileContract,
  ArchitectManifest,
  BusMode,
  ControlPlaneMessage,
  LlmConfig,
  TargetLanguage,
} from '../types';

export interface ArchitectInput {
  prompt: string;
  prdSpec: string;
  language: TargetLanguage;
  busMode: BusMode;
  llm: LlmConfig;
  simulateStreamingDelay: boolean;
}

export interface ArchitectOutput {
  manifest: ArchitectManifest;
  message: ControlPlaneMessage;
}

function parseLlmArchJsonOrFallback(
  rawText: string,
  language: TargetLanguage,
  prompt: string
): ArchitectManifest {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        projectName?: string;
        btArch?: string;
        verboseArch?: string;
        summaryZh?: string;
        files?: Array<{
          filePath?: string;
          role?: string;
          moduleOrPackage?: string;
          expectedSymbols?: string[];
          dependencies?: string[];
        }>;
      };
      if (Array.isArray(parsed.files) && parsed.files.length >= 2) {
        const files: ArchitectFileContract[] = parsed.files.slice(0, 6).map((f, idx) => {
          const filePath = (f.filePath || `file_${idx + 1}.${language === 'python' ? 'py' : language === 'java' ? 'java' : 'ts'}`).replace(/^\/+/, '');
          const syms = Array.isArray(f.expectedSymbols) ? f.expectedSymbols.filter(Boolean) : [];
          const deps = Array.isArray(f.dependencies) ? f.dependencies.filter(Boolean) : [];
          const btContract = `@FILE:${filePath} ⊢ Sym:${syms.join(',') || 'core'} Dep:${deps.join('+') || 'none'}`;
          return {
            filePath,
            role: f.role || '核心模块',
            moduleOrPackage: f.moduleOrPackage || 'root',
            expectedSymbols: syms,
            btContract,
            dependencies: deps,
          };
        });
        const btArchSpec =
          parsed.btArch ||
          `#ARCH[proj:${parsed.projectName || 'custom-project'} | lang:${language}\n  ${files.map((f) => f.btContract).join('\n  ')}\n]`;
        const verboseArchSpec =
          parsed.verboseArch ||
          files.map((f, idx) => `${idx + 1}. ${f.filePath} (${f.role}): exports ${f.expectedSymbols.join(', ')}`).join('\n');
        return {
          projectName: parsed.projectName || 'custom-swarm-project',
          language,
          btArchSpec,
          verboseArchSpec,
          humanSummaryZh: parsed.summaryZh || `共锁定 ${files.length} 个 ${language} 源码文件契约。`,
          files,
        };
      }
    } catch {
      // Fallback to showcase manifest structure below if malformed JSON
    }
  }
  return blueprintToManifest(getShowcaseBlueprint(language), prompt);
}

export async function runArchitectAgent(input: ArchitectInput): Promise<ArchitectOutput> {
  const { prompt, prdSpec, language, busMode, llm, simulateStreamingDelay } = input;
  const blueprint = getShowcaseBlueprint(language);

  if (llm.engine === 'demo-sim') {
    const manifest = blueprintToManifest(blueprint, prompt);
    const chosen = busMode === 'babeltele' ? manifest.btArchSpec : manifest.verboseArchSpec;
    const tokens = countTokens(chosen);
    const baselineTokens = countTokens(manifest.verboseArchSpec);
    const latencyMs = await paceSimulatedTokens(tokens, simulateStreamingDelay);
    const decoded = decodeBabelTeleToZh(chosen);

    return {
      manifest,
      message: {
        id: `msg-arch-${randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        agent: 'Architect',
        busMode,
        stage: 'arch',
        rawContent: chosen,
        humanZh: decoded.decodedZh,
        tokens,
        baselineVerboseTokens: baselineTokens,
        latencyMs,
      },
    };
  }

  // Real LLM Execution
  const langConvention =
    language === 'java'
      ? 'Use package com.babeltele.app and paths like src/com/babeltele/app/<ClassName>.java, ending with a MainTest.java containing public static void main(String[] args). Zero external Maven jars (JDK standard library only).'
      : language === 'typescript'
        ? 'Use paths like src/<module>.ts, ending with src/main.test.ts that executes self-tests. Zero external npm packages (Node built-in modules only).'
        : 'Use flat module paths like models.py, core.py, test_app.py (using Python standard library + unittest).';

  const systemPrompt = [
    'You are the Chief Software Architect in a Dual-Plane Multi-Agent Swarm.',
    `Design a clean 3-to-4 file ${language} project that compiles and runs out-of-the-box using ONLY the standard library.`,
    langConvention,
    'Return ONLY valid JSON matching this exact schema (no markdown fences around JSON if possible):',
    '{',
    '  "projectName": "kebab-case-name",',
    '  "summaryZh": "一句话中文架构说明",',
    '  "btArch": "#ARCH[proj:... | @FILE:... ⊢ Cls:... Fn:...]",',
    '  "verboseArch": "Detailed multi-paragraph architectural explanation..." ,',
    '  "files": [',
    '    { "filePath": "...", "role": "中文职责", "moduleOrPackage": "...", "expectedSymbols": ["ClassOrFnName"], "dependencies": [] }',
    '  ]',
    '}',
  ].join('\n');

  const userPrompt = `PRD Input:\n${prdSpec}\n\nOriginal User Request:\n${prompt}`;
  const res = await callChatCompletion(llm, systemPrompt, userPrompt);
  const manifest = parseLlmArchJsonOrFallback(res.content, language, prompt);
  const chosen = busMode === 'babeltele' ? manifest.btArchSpec : manifest.verboseArchSpec;
  const tokens = countTokens(chosen);
  const decoded = decodeBabelTeleToZh(chosen);

  return {
    manifest,
    message: {
      id: `msg-arch-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      agent: 'Architect',
      busMode,
      stage: 'arch',
      rawContent: chosen,
      humanZh: decoded.decodedZh,
      tokens,
      baselineVerboseTokens: countTokens(manifest.verboseArchSpec),
      latencyMs: res.latencyMs,
    },
  };
}
