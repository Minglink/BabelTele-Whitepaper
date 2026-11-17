import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getShowcaseBlueprint } from '../core/demoBlueprints';
import { SMFTMemoryPool } from '../core/headerExtractor';
import { callChatCompletion, paceSimulatedTokens } from '../core/llmDriver';
import { auditArtifact, inferLanguageFromPath, splitCoderDualPlaneResponse } from '../core/sanitizer';
import { decodeBabelTeleToZh } from '../core/sidecarDecoder';
import { countTokens } from '../core/tokenizer';
import { verifyProjectWorkspace } from '../core/verifier';
import type {
  ArchitectManifest,
  BusMode,
  ControlPlaneMessage,
  GeneratedArtifact,
  LlmConfig,
  ProjectVerificationReport,
  TargetLanguage,
} from '../types';

export interface VerifierFixerInput {
  workspaceDir: string;
  prdSpec: string;
  manifest: ArchitectManifest;
  artifacts: GeneratedArtifact[];
  smftPool: SMFTMemoryPool;
  language: TargetLanguage;
  busMode: BusMode;
  llm: LlmConfig;
  maxSelfHealLoops?: number;
  simulateStreamingDelay: boolean;
  onControlMessage?: (msg: ControlPlaneMessage) => void;
  onVerificationReport?: (report: ProjectVerificationReport) => void;
  onArtifactUpdated?: (artifact: GeneratedArtifact) => void;
}

export interface VerifierFixerOutput {
  verificationHistory: ProjectVerificationReport[];
  finalVerification: ProjectVerificationReport;
  messages: ControlPlaneMessage[];
  selfHealingLoops: number;
  btVerifyTokensEquivalent: number;
  verboseVerifyTokensEquivalent: number;
}

export async function runVerifierAndFixerLoop(
  input: VerifierFixerInput
): Promise<VerifierFixerOutput> {
  const {
    workspaceDir,
    prdSpec,
    manifest,
    artifacts,
    smftPool,
    language,
    busMode,
    llm,
    maxSelfHealLoops = 2,
    simulateStreamingDelay,
    onControlMessage,
    onVerificationReport,
    onArtifactUpdated,
  } = input;

  const blueprint = getShowcaseBlueprint(language);
  const blueprintMap = new Map(blueprint.files.map((f) => [f.filePath.replace(/\\/g, '/'), f]));
  const artifactMap = new Map(artifacts.map((a) => [a.filePath, a]));

  const history: ProjectVerificationReport[] = [];
  const emittedMessages: ControlPlaneMessage[] = [];
  let selfHealingLoops = 0;
  let btVerifyTokensEquivalent = 0;
  let verboseVerifyTokensEquivalent = 0;

  for (let iter = 1; iter <= maxSelfHealLoops + 1; iter++) {
    const verifyStart = performance.now();
    const report = verifyProjectWorkspace(workspaceDir, language, manifest, iter);
    const verifyElapsed = Math.round(performance.now() - verifyStart);

    history.push(report);
    onVerificationReport?.(report);

    const rawVerifyMsg = busMode === 'babeltele' ? report.btDiag : report.verboseDiag;
    const msgTokens = countTokens(rawVerifyMsg);
    const btTok = countTokens(report.btDiag);
    const nlTok = countTokens(report.verboseDiag);
    btVerifyTokensEquivalent += btTok;
    verboseVerifyTokensEquivalent += nlTok;

    const simWait = await paceSimulatedTokens(msgTokens, simulateStreamingDelay);
    const decoded = decodeBabelTeleToZh(rawVerifyMsg);

    const verifyControlMsg: ControlPlaneMessage = {
      id: `msg-ver-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      agent: 'Verifier',
      busMode,
      stage: report.passed ? 'verify' : 'diag',
      rawContent: rawVerifyMsg,
      humanZh: report.passed ? `${decoded.decodedZh}\n• ${report.humanSummaryZh}` : decoded.decodedZh,
      tokens: msgTokens,
      baselineVerboseTokens: nlTok,
      latencyMs: verifyElapsed + (llm.engine === 'demo-sim' ? Math.round(simWait * 0.4) : 0),
    };
    emittedMessages.push(verifyControlMsg);
    onControlMessage?.(verifyControlMsg);

    if (report.passed || iter > maxSelfHealLoops) {
      break;
    }

    // Trigger Fixer Self-Healing Loop!
    selfHealingLoops += 1;

    // Identify broken files (or fallback to file mentioned in btDiag)
    const brokenFiles = report.fileResults
      .filter((fr) => !fr.sanitizerClean || !fr.contractMatched || !fr.syntaxValid)
      .map((fr) => fr.filePath);

    if (brokenFiles.length === 0 && manifest.files.length > 0) {
      brokenFiles.push(manifest.files[0].filePath.replace(/\\/g, '/'));
    }

    for (const brokenRelPath of brokenFiles) {
      const absBroken = path.join(workspaceDir, brokenRelPath);
      const currentCode = fs.existsSync(absBroken) ? fs.readFileSync(absBroken, 'utf8') : '';
      const bpEntry = blueprintMap.get(brokenRelPath);
      const contract = manifest.files.find((f) => f.filePath.replace(/\\/g, '/') === brokenRelPath);

      let healedCode: string;
      let fixLatencyMs: number;
      const btFixMsg = `#FIX[@${brokenRelPath} ⇐ #DIAG(iter:${iter}) ⊢ strip_bt_pollution+sync_contract ⊥ pure:${language}]`;
      const verboseFixMsg = `Fixer Agent Loop #${selfHealingLoops}: I have analyzed the Verifier diagnosis for ${brokenRelPath}. I removed all leaked control-plane symbols, restored balanced braces and method signatures matching the Architect contract, and regenerated 100% pure standard ${language} source code.`;

      if (llm.engine === 'demo-sim' && bpEntry) {
        healedCode = bpEntry.pureCode;
        const chosenFixText = busMode === 'babeltele' ? btFixMsg : verboseFixMsg;
        fixLatencyMs = await paceSimulatedTokens(countTokens(chosenFixText), simulateStreamingDelay);
      } else {
        const smftHeaders = smftPool.formatBtPoolContext(brokenRelPath);
        const fixSys = [
          `You are Fixer Agent in a Dual-Plane ${language} Swarm.`,
          'Hot-patch the broken source file so it compiles cleanly and passes all contracts.',
          'Output ONLY <ARTIFACT>...100% pure standard compilable code...</ARTIFACT> with ZERO BabelTele symbols (no ⇒, ⊢, ⊥, ⟦, ⟧, #DRAFT, #HDR, or ``` fences).',
        ].join('\n');
        const fixUser = [
          `PRD: ${prdSpec}`,
          `Diagnosis: ${report.btDiag}`,
          `Compiler Stderr:\n${report.compilerStderr || '(none)'}`,
          `Required Symbols: ${contract?.expectedSymbols.join(', ') ?? 'all'}`,
          `Cross-File SMFT Headers:\n${smftHeaders}`,
          `Current Broken File (${brokenRelPath}):\n${currentCode}`,
        ].join('\n\n');

        const res = await callChatCompletion(llm, fixSys, fixUser);
        healedCode = splitCoderDualPlaneResponse(res.content).pureCode;
        fixLatencyMs = res.latencyMs;
      }

      fs.mkdirSync(path.dirname(absBroken), { recursive: true });
      fs.writeFileSync(absBroken, healedCode, 'utf8');

      const fileLang = inferLanguageFromPath(brokenRelPath);
      const updatedSanitizer = auditArtifact(brokenRelPath, healedCode, fileLang);
      const updatedDigest = smftPool.upsertFile(brokenRelPath, healedCode, fileLang);

      const existingArt = artifactMap.get(brokenRelPath);
      const updatedArtifact: GeneratedArtifact = {
        filePath: brokenRelPath,
        absolutePath: absBroken,
        language: fileLang,
        content: healedCode,
        lines: healedCode.split(/\r?\n/).length,
        bytes: Buffer.byteLength(healedCode, 'utf8'),
        rawTokens: updatedDigest.rawTokens,
        sanitizer: updatedSanitizer,
        btHeaderDigest: updatedDigest,
        healedIterations: (existingArt?.healedIterations ?? 0) + 1,
      };
      artifactMap.set(brokenRelPath, updatedArtifact);

      // Mutate in-place in artifacts array so caller array reflects healed code
      const arrIdx = artifacts.findIndex((a) => a.filePath === brokenRelPath);
      if (arrIdx !== -1) {
        artifacts[arrIdx] = updatedArtifact;
      } else {
        artifacts.push(updatedArtifact);
      }
      onArtifactUpdated?.(updatedArtifact);

      const rawFixText = busMode === 'babeltele' ? btFixMsg : verboseFixMsg;
      const fixTok = countTokens(rawFixText);
      btVerifyTokensEquivalent += countTokens(btFixMsg);
      verboseVerifyTokensEquivalent += countTokens(verboseFixMsg);

      const fixControlMsg: ControlPlaneMessage = {
        id: `msg-fix-${randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        agent: 'Fixer',
        busMode,
        stage: 'fix',
        targetFile: brokenRelPath,
        rawContent: rawFixText,
        humanZh: decodeBabelTeleToZh(rawFixText).decodedZh,
        tokens: fixTok,
        baselineVerboseTokens: countTokens(verboseFixMsg),
        latencyMs: fixLatencyMs,
      };
      emittedMessages.push(fixControlMsg);
      onControlMessage?.(fixControlMsg);
    }
  }

  return {
    verificationHistory: history,
    finalVerification: history[history.length - 1],
    messages: emittedMessages,
    selfHealingLoops,
    btVerifyTokensEquivalent,
    verboseVerifyTokensEquivalent,
  };
}
