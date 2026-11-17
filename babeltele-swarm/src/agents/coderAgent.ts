import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BlueprintFileEntry } from '../core/demoBlueprints';
import { SMFTMemoryPool } from '../core/headerExtractor';
import { callChatCompletion, paceSimulatedTokens } from '../core/llmDriver';
import { auditArtifact, inferLanguageFromPath, splitCoderDualPlaneResponse } from '../core/sanitizer';
import { decodeBabelTeleToZh } from '../core/sidecarDecoder';
import { countTokens } from '../core/tokenizer';
import type {
  ArchitectFileContract,
  ArchitectManifest,
  BusMode,
  ControlPlaneMessage,
  GeneratedArtifact,
  LlmConfig,
  TargetLanguage,
} from '../types';

export interface CoderStepInput {
  workspaceDir: string;
  prdSpec: string;
  manifest: ArchitectManifest;
  fileContract: ArchitectFileContract;
  blueprintFile?: BlueprintFileEntry;
  smftPool: SMFTMemoryPool;
  language: TargetLanguage;
  busMode: BusMode;
  llm: LlmConfig;
  injectFault: boolean;
  simulateStreamingDelay: boolean;
}

export interface CoderStepOutput {
  draftMessage: ControlPlaneMessage;
  artifact: GeneratedArtifact;
  memoryContextTokensUsed: number;
  rawMemoryContextWouldBe: number;
  btDraftTokensEquivalent: number;
  verboseDraftTokensEquivalent: number;
}

export async function runCoderAgentForFile(input: CoderStepInput): Promise<CoderStepOutput> {
  const {
    workspaceDir,
    prdSpec,
    manifest,
    fileContract,
    blueprintFile,
    smftPool,
    language,
    busMode,
    llm,
    injectFault,
    simulateStreamingDelay,
  } = input;

  // Measure cross-file memory context tokens BEFORE adding current file
  const hasPriorFiles = smftPool.size() > 0;
  const btMemoryBlock = hasPriorFiles ? smftPool.formatBtPoolContext(fileContract.filePath) : '';
  const rawVerboseMemoryBlock = hasPriorFiles ? smftPool.formatVerboseRawContext(fileContract.filePath) : '';

  const btMemTokens = hasPriorFiles ? countTokens(btMemoryBlock) : 0;
  const rawMemTokens = hasPriorFiles ? countTokens(rawVerboseMemoryBlock) : 0;
  const memoryContextTokensUsed = busMode === 'babeltele' ? btMemTokens : rawMemTokens;

  let draftText: string;
  let btDraftEquiv: string;
  let verboseDraftEquiv: string;
  let pureSourceCode: string;
  let stepLatencyMs: number;

  if (llm.engine === 'demo-sim' && blueprintFile) {
    btDraftEquiv = blueprintFile.btDraft;
    verboseDraftEquiv = blueprintFile.verboseDraft;
    draftText = busMode === 'babeltele' ? btDraftEquiv : verboseDraftEquiv;
    pureSourceCode =
      injectFault && blueprintFile.faultyPollutedCode
        ? blueprintFile.faultyPollutedCode
        : blueprintFile.pureCode;

    // Simulated generation time reflects draft + cross-file context read overhead
    const effectiveBusTokens = countTokens(draftText) + Math.round(memoryContextTokensUsed * 0.35);
    stepLatencyMs = await paceSimulatedTokens(effectiveBusTokens, simulateStreamingDelay);
  } else {
    // Real LLM Dual-Plane Generation
    const crossFileSection =
      busMode === 'babeltele'
        ? `Cross-File SMFT Symbol Headers (use these EXACT names/signatures):\n${btMemoryBlock || '(none yet)'}`
        : `Existing Project Files for Reference:\n${rawVerboseMemoryBlock || '(none yet)'}`;

    const systemPrompt =
      busMode === 'babeltele'
        ? [
            'You are Coder Agent in a STRICT Dual-Plane BabelTele Swarm.',
            'PLANE 1 (Control Draft): First output <BT_DRAFT>#DRAFT[@file ⊢ strategy ⊥ pure:lang]</BT_DRAFT> strictly under 35 tokens.',
            `PLANE 2 (Native Code Artifact): Next output <ARTIFACT>...100% pure, standard, compilable ${language} source code...</ARTIFACT>.`,
            'CRITICAL ZERO-POLLUTION LAW: Inside <ARTIFACT>, NEVER emit ANY BabelTele symbols (no ⇒, ⊢, ⊥, ⟦, ⟧, →, #PRD, #DRAFT, #HDR, §SMFT, or markdown ``` fences). Use ONLY standard library APIs.',
          ].join('\n')
        : [
            `You are a Senior ${language} Developer Agent.`,
            'First write a paragraph (<BT_DRAFT>...</BT_DRAFT>) explaining your design reasoning in natural language (~70-110 words).',
            `Then output <ARTIFACT>...100% pure, standard, compilable ${language} source code...</ARTIFACT> with no markdown fences inside <ARTIFACT>.`,
          ].join('\n');

    const userPrompt = [
      `Project PRD:\n${prdSpec}`,
      `Target File Path: ${fileContract.filePath}`,
      `Role: ${fileContract.role}`,
      `Module/Package: ${fileContract.moduleOrPackage}`,
      `Required Exported Symbols: ${fileContract.expectedSymbols.join(', ')}`,
      `Full Manifest Overview:\n${manifest.btArchSpec}`,
      crossFileSection,
    ].join('\n\n');

    const res = await callChatCompletion(llm, systemPrompt, userPrompt);
    const split = splitCoderDualPlaneResponse(res.content);
    draftText =
      split.btDraft ||
      (busMode === 'babeltele'
        ? `#DRAFT[@${fileContract.filePath} ⊢ impl(${fileContract.expectedSymbols.join(',')}) ⊥ pure:${language}]`
        : `Implementing ${fileContract.filePath} (${fileContract.role}) exporting ${fileContract.expectedSymbols.join(', ')}.`);
    btDraftEquiv =
      busMode === 'babeltele'
        ? draftText
        : `#DRAFT[@${fileContract.filePath} ⊢ impl(${fileContract.expectedSymbols.slice(0, 3).join(',')}) ⊥ pure:${language}]`;
    verboseDraftEquiv =
      busMode === 'verbose-nl'
        ? draftText
        : blueprintFile?.verboseDraft ??
          `Carefully implementing ${fileContract.filePath} to satisfy all architectural contracts (${fileContract.expectedSymbols.join(', ')}) while maintaining full type safety and thread safety across dependent modules.`;
    pureSourceCode = split.pureCode;
    stepLatencyMs = res.latencyMs;
  }

  // Write Plane-2 Artifact to workspaces/<runId>/<filePath>
  const normRelPath = fileContract.filePath.replace(/\\/g, '/');
  const absPath = path.join(workspaceDir, normRelPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, pureSourceCode, 'utf8');

  // Audit written file via ArtifactSanitizer & register BT-Header into SMFT Memory Pool
  const diskContent = fs.readFileSync(absPath, 'utf8');
  const fileLang = inferLanguageFromPath(normRelPath);
  const sanitizerReport = auditArtifact(normRelPath, diskContent, fileLang);
  const btHeaderDigest = smftPool.upsertFile(normRelPath, diskContent, fileLang);

  const draftTokens = countTokens(draftText);
  const btDraftTokensEquivalent = countTokens(btDraftEquiv);
  const verboseDraftTokensEquivalent = countTokens(verboseDraftEquiv);
  const decodedDraft = decodeBabelTeleToZh(draftText);

  const draftMessage: ControlPlaneMessage = {
    id: `msg-coder-${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    agent: 'Coder',
    busMode,
    stage: 'draft',
    targetFile: normRelPath,
    rawContent: draftText,
    humanZh: decodedDraft.decodedZh,
    tokens: draftTokens,
    baselineVerboseTokens: verboseDraftTokensEquivalent,
    latencyMs: stepLatencyMs,
  };

  const artifact: GeneratedArtifact = {
    filePath: normRelPath,
    absolutePath: absPath,
    language: fileLang,
    content: diskContent,
    lines: diskContent.split(/\r?\n/).length,
    bytes: Buffer.byteLength(diskContent, 'utf8'),
    rawTokens: btHeaderDigest.rawTokens,
    sanitizer: sanitizerReport,
    btHeaderDigest,
    healedIterations: 0,
  };

  return {
    draftMessage,
    artifact,
    memoryContextTokensUsed,
    rawMemoryContextWouldBe: rawMemTokens,
    btDraftTokensEquivalent,
    verboseDraftTokensEquivalent,
  };
}
