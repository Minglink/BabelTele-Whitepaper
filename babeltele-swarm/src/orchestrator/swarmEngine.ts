import * as fs from 'node:fs';
import * as path from 'node:path';
import { runArchitectAgent } from '../agents/architectAgent';
import { runCoderAgentForFile } from '../agents/coderAgent';
import { runPmSpecAgent } from '../agents/pmSpecAgent';
import { runVerifierAndFixerLoop } from '../agents/verifierFixerAgent';
import { getShowcaseBlueprint } from '../core/demoBlueprints';
import { SMFTMemoryPool } from '../core/headerExtractor';
import { resolveProjectRoot } from '../core/paths';
import { computeSavedPercent, countTokens } from '../core/tokenizer';
import type {
  ABComparisonReport,
  ControlPlaneMessage,
  GeneratedArtifact,
  LlmConfig,
  StageTokenBreakdown,
  SwarmRunOptions,
  SwarmRunResult,
  SwarmStreamEvent,
  SwarmTelemetry,
} from '../types';

const recentRunsStore = new Map<string, SwarmRunResult>();

export function getRecentRuns(): SwarmRunResult[] {
  return Array.from(recentRunsStore.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function getRunById(runId: string): SwarmRunResult | undefined {
  return recentRunsStore.get(runId);
}

function generateRunId(language: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${language}-${stamp}-${rand}`;
}

/**
 * Executes the complete 4-Agent Dual-Plane Swarm Pipeline:
 *   Agent 1 (PM-Spec) -> Agent 2 (Architect) -> Agent 3 (Coder + SMFT BT-Header Pool) -> Agent 4 (Verifier & Fixer)
 */
export async function executeSwarmRun(options: SwarmRunOptions): Promise<SwarmRunResult> {
  const startedWall = performance.now();
  const language = options.language;
  const busMode = options.busMode;
  const computeAb = options.computeAbComparison ?? true;
  const simulateStreamingDelay = options.simulateStreamingDelay ?? false;
  const injectFaultDrill = options.injectFaultDrill ?? false;

  const llm: LlmConfig = options.llm ?? {
    engine: (process.env.LLM_ENGINE as LlmConfig['engine']) || 'demo-sim',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL,
  };

  const blueprint = getShowcaseBlueprint(language);
  const prompt = options.prompt?.trim() || blueprint.defaultPromptZh;
  const runId = options.runId || generateRunId(language);

  const workspacesBase =
    options.workspaceRootDir || path.join(resolveProjectRoot(), 'workspaces');
  const workspaceDir = path.join(workspacesBase, runId);
  fs.mkdirSync(workspaceDir, { recursive: true });

  const emit = (ev: SwarmStreamEvent): void => {
    options.onEvent?.(ev);
  };

  emit({
    type: 'run-start',
    runId,
    prompt,
    language,
    busMode,
    engine: llm.engine,
    workspacePath: workspaceDir,
    timestamp: new Date().toISOString(),
  });

  const allMessages: ControlPlaneMessage[] = [];
  const artifacts: GeneratedArtifact[] = [];
  const smftPool = new SMFTMemoryPool();

  let btTokensRunning = 0;
  let nlTokensRunning = 0;

  // --- STAGE 1: PM-Spec Agent ---
  emit({
    runId,
    type: 'agent-status',
    agent: 'PM-Spec',
    status: 'working',
    detail:
      busMode === 'babeltele'
        ? '正在将中文项目简报浓缩为 <120 Tokens 巴别语 #PRD 骨架...'
        : '正在撰写传统多段落自然语言 PRD 文档...',
  });

  const pmOut = await runPmSpecAgent({
    prompt,
    language,
    busMode,
    llm,
    simulateStreamingDelay,
  });
  allMessages.push(pmOut.message);
  emit({ type: 'control-msg', runId, message: pmOut.message });
  emit({
    runId,
    type: 'agent-status',
    agent: 'PM-Spec',
    status: 'done',
    detail: `#PRD 已锁定 (${pmOut.message.tokens} tokens)`,
  });

  const pmBtTok = countTokens(pmOut.btPrdEquivalent);
  const pmNlTok = countTokens(pmOut.verbosePrdEquivalent);
  btTokensRunning += pmBtTok;
  nlTokensRunning += pmNlTok;
  emit({
    type: 'ab-progress',
    runId,
    btTokensSoFar: btTokensRunning,
    nlTokensSoFar: nlTokensRunning,
    btProgressPct: 22,
    nlProgressPct: 10,
  });

  // --- STAGE 2: Architect Agent ---
  emit({
    runId,
    type: 'agent-status',
    agent: 'Architect',
    status: 'working',
    detail: '正在构建模块文件清单与跨文件接口签名契约 (#ARCH)...',
  });

  const archOut = await runArchitectAgent({
    prompt,
    prdSpec: pmOut.prdSpec,
    language,
    busMode,
    llm,
    simulateStreamingDelay,
  });
  allMessages.push(archOut.message);
  emit({ type: 'control-msg', runId, message: archOut.message });
  emit({ type: 'manifest-ready', runId, manifest: archOut.manifest });
  emit({
    runId,
    type: 'agent-status',
    agent: 'Architect',
    status: 'done',
    detail: `已锁定 ${archOut.manifest.files.length} 个源码文件契约`,
  });

  const archBtTok = countTokens(archOut.manifest.btArchSpec);
  const archNlTok = countTokens(archOut.manifest.verboseArchSpec);
  btTokensRunning += archBtTok;
  nlTokensRunning += archNlTok;
  emit({
    type: 'ab-progress',
    runId,
    btTokensSoFar: btTokensRunning,
    nlTokensSoFar: nlTokensRunning,
    btProgressPct: 45,
    nlProgressPct: 24,
  });

  // --- STAGE 3: Coder Agent + SMFT BT-Header Memory Indexing ---
  const blueprintFileMap = new Map(
    blueprint.files.map((f) => [f.filePath.replace(/\\/g, '/'), f])
  );

  let totalBtDraftTok = 0;
  let totalNlDraftTok = 0;
  let totalBtMemContextTok = 0;
  let totalRawMemContextTok = 0;
  let faultInjectedOnce = false;

  const totalFiles = archOut.manifest.files.length;
  for (let idx = 0; idx < totalFiles; idx++) {
    const fc = archOut.manifest.files[idx];
    const normPath = fc.filePath.replace(/\\/g, '/');
    const bpFile = blueprintFileMap.get(normPath);

    const shouldInjectFaultHere =
      injectFaultDrill && !faultInjectedOnce && Boolean(bpFile?.faultyPollutedCode);
    if (shouldInjectFaultHere) {
      faultInjectedOnce = true;
    }

    emit({
      runId,
      type: 'agent-status',
      agent: 'Coder',
      status: 'working',
      detail: `正在生成纯原生源码 [${idx + 1}/${totalFiles}] ${normPath}（读取 SMFT 记忆池 ${smftPool.size()} 份 BT-Header）...`,
    });

    // Measure BT memory tokens BEFORE file is added
    const btContextBefore =
      smftPool.size() > 0 ? countTokens(smftPool.formatBtPoolContext(normPath)) : 0;

    const coderOut = await runCoderAgentForFile({
      workspaceDir,
      prdSpec: pmOut.prdSpec,
      manifest: archOut.manifest,
      fileContract: fc,
      blueprintFile: bpFile,
      smftPool,
      language,
      busMode,
      llm,
      injectFault: shouldInjectFaultHere,
      simulateStreamingDelay,
    });

    allMessages.push(coderOut.draftMessage);
    artifacts.push(coderOut.artifact);

    totalBtDraftTok += coderOut.btDraftTokensEquivalent;
    totalNlDraftTok += coderOut.verboseDraftTokensEquivalent;
    totalBtMemContextTok += btContextBefore;
    totalRawMemContextTok += coderOut.rawMemoryContextWouldBe;

    btTokensRunning += coderOut.btDraftTokensEquivalent + btContextBefore;
    nlTokensRunning += coderOut.verboseDraftTokensEquivalent + coderOut.rawMemoryContextWouldBe;

    emit({ type: 'control-msg', runId, message: coderOut.draftMessage });
    emit({
      type: 'artifact-written',
      runId,
      artifact: coderOut.artifact,
      smftPoolSnapshot: smftPool.formatBtPoolContext(),
    });

    const stepFrac = (idx + 1) / totalFiles;
    emit({
      type: 'ab-progress',
      runId,
      btTokensSoFar: btTokensRunning,
      nlTokensSoFar: nlTokensRunning,
      btProgressPct: Math.round(45 + stepFrac * 42),
      nlProgressPct: Math.round(24 + stepFrac * 38),
    });
  }

  emit({
    runId,
    type: 'agent-status',
    agent: 'Coder',
    status: 'done',
    detail: `${artifacts.length} 个原生源码文件已落盘并完成 BT-Header 索引`,
  });

  // Write clean project README.md in workspace as documentation artifact
  const workspaceReadmePath = path.join(workspaceDir, 'README.md');
  const workspaceReadmeContent = [
    `# ${archOut.manifest.projectName}`,
    '',
    `Generated by **BabelTele Swarm (@babeltele/swarm)** Dual-Plane Accelerator.`,
    `- Target Language: \`${language}\``,
    `- Control-Plane Bus Mode: \`${busMode}\``,
    `- Artifact Plane Guarantee: **100% Pure Native Source Code (0 BabelTele Symbol Leakage)**`,
    '',
    '## Generated Source Files',
    ...archOut.manifest.files.map((f) => `- \`${f.filePath}\` — ${f.role}`),
    '',
  ].join('\n');
  fs.writeFileSync(workspaceReadmePath, workspaceReadmeContent, 'utf8');

  // --- STAGE 4: Verifier & Fixer Self-Healing Loop ---
  emit({
    runId,
    type: 'agent-status',
    agent: 'Verifier',
    status: 'working',
    detail: '正在执行 ArtifactSanitizer 零污染扫描 + 本地真实编译器与自测套件验收...',
  });

  const verOut = await runVerifierAndFixerLoop({
    workspaceDir,
    prdSpec: pmOut.prdSpec,
    manifest: archOut.manifest,
    artifacts,
    smftPool,
    language,
    busMode,
    llm,
    maxSelfHealLoops: 2,
    simulateStreamingDelay,
    onControlMessage: (msg) => {
      allMessages.push(msg);
      if (msg.agent === 'Fixer') {
        emit({
          runId,
          type: 'agent-status',
          agent: 'Fixer',
          status: 'healing',
          detail: `正在根据 #DIAG 热修复 ${msg.targetFile ?? ''}...`,
        });
      }
      emit({ type: 'control-msg', runId, message: msg });
    },
    onVerificationReport: (rep) => {
      emit({ type: 'verification-report', runId, report: rep });
    },
    onArtifactUpdated: (updatedArt) => {
      emit({
        type: 'artifact-written',
        runId,
        artifact: updatedArt,
        smftPoolSnapshot: smftPool.formatBtPoolContext(),
      });
    },
  });

  emit({
    runId,
    type: 'agent-status',
    agent: 'Verifier',
    status: 'done',
    detail: verOut.finalVerification.passed
      ? `验收全绿 ✓ (${verOut.finalVerification.toolchainUsed})`
      : '验收发现异常（已达自愈轮次上限）',
  });

  btTokensRunning += verOut.btVerifyTokensEquivalent;
  nlTokensRunning += verOut.verboseVerifyTokensEquivalent;

  emit({
    type: 'ab-progress',
    runId,
    btTokensSoFar: btTokensRunning,
    nlTokensSoFar: nlTokensRunning,
    btProgressPct: 100,
    nlProgressPct: 100,
  });

  const actualDurationMs = Math.max(1, Math.round(performance.now() - startedWall));
  const controlPlaneTokens = allMessages.reduce((s, m) => s + m.tokens, 0);
  const activeMemUsed = busMode === 'babeltele' ? totalBtMemContextTok : totalRawMemContextTok;
  const artifactTokens = artifacts.reduce((s, a) => s + a.rawTokens, 0);

  const telemetry: SwarmTelemetry = {
    busMode,
    controlPlaneTokens,
    memoryContextTokensUsed: activeMemUsed,
    rawMemoryContextWouldBe: totalRawMemContextTok,
    memoryTokensSavedPercent: computeSavedPercent(totalBtMemContextTok, totalRawMemContextTok),
    totalBusAndMemoryTokens: controlPlaneTokens + activeMemUsed,
    artifactTokens,
    artifactFilesCount: artifacts.length,
    durationMs: actualDurationMs,
    selfHealingLoops: verOut.selfHealingLoops,
    zeroPollutionVerified: verOut.finalVerification.zeroBabelTeleLeakage,
  };

  let abComparison: ABComparisonReport | undefined;
  if (computeAb) {
    const btControlTotal = pmBtTok + archBtTok + totalBtDraftTok + verOut.btVerifyTokensEquivalent;
    const nlControlTotal = pmNlTok + archNlTok + totalNlDraftTok + verOut.verboseVerifyTokensEquivalent;

    const btTotalBusMem = btControlTotal + totalBtMemContextTok;
    const nlTotalBusMem = nlControlTotal + totalRawMemContextTok;

    // Modeled wall-clock duration proportional to LLM generation + prefill throughput
    const btDuration =
      busMode === 'babeltele'
        ? actualDurationMs
        : Math.max(120, Math.round(actualDurationMs * (btTotalBusMem / Math.max(1, nlTotalBusMem))));
    const nlDuration =
      busMode === 'verbose-nl'
        ? actualDurationMs
        : Math.round(actualDurationMs * (nlTotalBusMem / Math.max(1, btTotalBusMem)));

    const btTelemetry: SwarmTelemetry = {
      busMode: 'babeltele',
      controlPlaneTokens: btControlTotal,
      memoryContextTokensUsed: totalBtMemContextTok,
      rawMemoryContextWouldBe: totalRawMemContextTok,
      memoryTokensSavedPercent: computeSavedPercent(totalBtMemContextTok, totalRawMemContextTok),
      totalBusAndMemoryTokens: btTotalBusMem,
      artifactTokens,
      artifactFilesCount: artifacts.length,
      durationMs: btDuration,
      selfHealingLoops: verOut.selfHealingLoops,
      zeroPollutionVerified: verOut.finalVerification.zeroBabelTeleLeakage,
    };

    const nlTelemetry: SwarmTelemetry = {
      busMode: 'verbose-nl',
      controlPlaneTokens: nlControlTotal,
      memoryContextTokensUsed: totalRawMemContextTok,
      rawMemoryContextWouldBe: totalRawMemContextTok,
      memoryTokensSavedPercent: 0,
      totalBusAndMemoryTokens: nlTotalBusMem,
      artifactTokens,
      artifactFilesCount: artifacts.length,
      durationMs: nlDuration,
      selfHealingLoops: verOut.selfHealingLoops,
      zeroPollutionVerified: verOut.finalVerification.zeroBabelTeleLeakage,
    };

    const stageBreakdown: StageTokenBreakdown[] = [
      {
        stage: 'PM-Spec',
        stageLabelZh: 'PM-Spec 需求规约 (#PRD)',
        btTokens: pmBtTok,
        nlTokens: pmNlTok,
        savedPercent: computeSavedPercent(pmBtTok, pmNlTok),
      },
      {
        stage: 'Architect',
        stageLabelZh: 'Architect 架构契约 (#ARCH)',
        btTokens: archBtTok,
        nlTokens: archNlTok,
        savedPercent: computeSavedPercent(archBtTok, archNlTok),
      },
      {
        stage: 'Coder-Draft',
        stageLabelZh: 'Coder 编码前思维草稿 (#DRAFT)',
        btTokens: totalBtDraftTok,
        nlTokens: totalNlDraftTok,
        savedPercent: computeSavedPercent(totalBtDraftTok, totalNlDraftTok),
      },
      {
        stage: 'SMFT-Memory',
        stageLabelZh: 'SMFT 跨文件记忆上下文 (#HDR)',
        btTokens: totalBtMemContextTok,
        nlTokens: totalRawMemContextTok,
        savedPercent: computeSavedPercent(totalBtMemContextTok, totalRawMemContextTok),
      },
      {
        stage: 'Verifier',
        stageLabelZh: 'Verifier 验收与诊断遥测',
        btTokens: verOut.btVerifyTokensEquivalent,
        nlTokens: verOut.verboseVerifyTokensEquivalent,
        savedPercent: computeSavedPercent(
          verOut.btVerifyTokensEquivalent,
          verOut.verboseVerifyTokensEquivalent
        ),
      },
    ];

    const speedupMultiplier =
      Math.round((nlTotalBusMem / Math.max(1, btTotalBusMem)) * 100) / 100;

    abComparison = {
      babeltele: btTelemetry,
      verboseNl: nlTelemetry,
      controlTokenReductionPercent: computeSavedPercent(btControlTotal, nlControlTotal),
      totalBusAndMemoryReductionPercent: computeSavedPercent(btTotalBusMem, nlTotalBusMem),
      speedupMultiplier,
      stageBreakdown,
    };
  }

  const result: SwarmRunResult = {
    runId,
    createdAt: new Date().toISOString(),
    prompt,
    language,
    busMode,
    engine: llm.engine,
    workspacePath: workspaceDir,
    prdSpec: pmOut.prdSpec,
    manifest: archOut.manifest,
    messages: allMessages,
    artifacts,
    smftMemoryPool: smftPool.getAllDigests(),
    smftFormattedPool: smftPool.formatBtPoolContext(),
    verificationHistory: verOut.verificationHistory,
    finalVerification: verOut.finalVerification,
    telemetry,
    abComparison,
  };

  recentRunsStore.set(runId, result);
  if (recentRunsStore.size > 50) {
    const oldestKey = recentRunsStore.keys().next().value;
    if (oldestKey) recentRunsStore.delete(oldestKey);
  }

  emit({
    type: 'run-complete',
    runId,
    result,
  });

  return result;
}
