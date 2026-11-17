import { auditBabelTele, enforceAnchorLock, type AuditResult } from "./auditor.js";
import {
  chatCompletion,
  probeOllama,
  type LlmClientConfig,
} from "./llmClient.js";
import {
  COMPILER_PROFILES,
  getDecoderSystemPrompt,
  type CompilerProfileId,
} from "./prompts.js";
import {
  compileOfflineRule,
  decodeOfflineRule,
  type DehydrationResult,
} from "./ruleEngine.js";
import {
  compareTokenMetrics,
  countDualTokens,
  warmupTokenizers,
  type DualTokenizerReport,
} from "./tokenizer.js";

export type EngineMode = "auto" | "offline-rule" | "ollama" | "openai-api";
export type ResolvedEngine = "offline-rule" | "ollama" | "openai-api";

export interface CompileOptions {
  profile?: CompilerProfileId;
  engine?: EngineMode;
  offline?: boolean;
  llmConfig?: LlmClientConfig;
  /** Default true: appends `![Lock: ...]` if upstream LLM dropped a hard number/identifier */
  enforceLock?: boolean;
  /** Default true: falls back gracefully to offline-rule if upstream LLM is unreachable */
  allowFallback?: boolean;
  /** Default true: triggers circuit breaker if BPE subword tokens did not decrease (ΔL_BPE >= 0) */
  enableCircuitBreaker?: boolean;
}

export interface CompileResult {
  /** Optimal verified output after Stage-3 BPE accounting, anchor lock, and circuit breaker */
  output: string;
  /** Unfiltered Stage-2 candidate prior to circuit breaker selection */
  rawCandidate: string;
  /** Stage-1 deterministic rule-compiled baseline (<2ms) */
  offlineCandidate: string;
  profile: CompilerProfileId;
  engineRequested: EngineMode;
  engineUsed: ResolvedEngine;
  modelUsed?: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  circuitBreakerTriggered: boolean;
  circuitBreakerReason?: string;
  anchorLockApplied: boolean;
  dehydration: DehydrationResult;
  tokenMetrics: DualTokenizerReport;
  rawCandidateMetrics: DualTokenizerReport;
  audit: AuditResult;
  latencyMs: number;
}

export interface DecodeResult {
  decodedText: string;
  targetLang: "zh" | "en";
  engineUsed: ResolvedEngine;
  modelUsed?: string;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  audit: AuditResult;
  latencyMs: number;
}

export interface RelayLegMetrics {
  payloadSent: string;
  answer: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface RelayResult {
  compilation: CompileResult;
  btRelay: RelayLegMetrics;
  rawBaseline?: RelayLegMetrics;
  savings: {
    inputBpeSavedO200k: number;
    inputBpeReductionPct: number;
    promptTokensSaved?: number;
    totalTokensSaved?: number;
  };
  totalLatencyMs: number;
}

function hasExplicitApiConfig(cfg?: LlmClientConfig): boolean {
  const key = cfg?.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = cfg?.baseUrl ?? process.env.OPENAI_BASE_URL;
  if (key && key.trim().length > 0) return true;
  // Local OpenAI-compatible servers (Ollama / LM Studio / mock test servers) may not require an API key
  if (baseUrl && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(baseUrl.trim())) {
    return true;
  }
  return false;
}

/**
 * Unified 3-Stage Hybrid BabelTele Neutralizing Compiler:
 * - Stage 1: <2ms Conversational/Emotional Dehydration + Deterministic Rule Candidate
 * - Stage 2: Neural BT-Spec v1.0 Compilation (OpenAI/DeepSeek/Qwen API or Local Ollama) or Offline Rule
 * - Stage 3: Real Subword BPE Token Accountant (`o200k_base` & `cl100k_base`) + Tier-1 Hard-Anchor Lock + Circuit Breaker
 */
export async function compileToBabelTele(
  input: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  // Ensure BPE rank tables are initialized before measuring pipeline execution latency
  warmupTokenizers();
  const t0 = performance.now();
  const profile: CompilerProfileId =
    options.profile && COMPILER_PROFILES[options.profile] ? options.profile : "neutral-formal";
  const engineRequested: EngineMode = options.offline
    ? "offline-rule"
    : (options.engine ?? "auto");
  const enforceLock = options.enforceLock !== false;
  const allowFallback = options.allowFallback !== false;
  const enableCircuitBreaker = options.enableCircuitBreaker !== false;

  const trimmedInput = input.trim();

  // Stage 1: Deterministic dehydration & offline rule candidate (<2ms)
  const stage1 = compileOfflineRule(trimmedInput, profile);
  const offlineCandidate = stage1.btOutput;

  if (!trimmedInput) {
    const emptyMetrics = compareTokenMetrics("", "");
    const emptyAudit = auditBabelTele("", "");
    return {
      output: "",
      rawCandidate: "",
      offlineCandidate: "",
      profile,
      engineRequested,
      engineUsed: "offline-rule",
      fallbackTriggered: false,
      circuitBreakerTriggered: false,
      anchorLockApplied: false,
      dehydration: stage1.dehydration,
      tokenMetrics: emptyMetrics,
      rawCandidateMetrics: emptyMetrics,
      audit: emptyAudit,
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  // Stage 2: Resolve & execute compiler engine
  let engineUsed: ResolvedEngine = "offline-rule";
  let modelUsed: string | undefined;
  let rawCandidate = offlineCandidate;
  let fallbackTriggered = false;
  let fallbackReason: string | undefined;

  const profileSpec = COMPILER_PROFILES[profile];

  if (engineRequested !== "offline-rule") {
    if (engineRequested === "ollama") {
      const probe = await probeOllama(options.llmConfig?.baseUrl);
      const chosenModel = options.llmConfig?.model || probe.recommendedModel;
      if (probe.available && chosenModel) {
        try {
          const resp = await chatCompletion(
            [
              { role: "system", content: profileSpec.systemPrompt },
              { role: "user", content: stage1.dehydration.cleanedText || trimmedInput },
            ],
            {
              ...options.llmConfig,
              baseUrl: options.llmConfig?.baseUrl || probe.openaiBaseUrl,
              model: chosenModel,
              temperature: options.llmConfig?.temperature ?? 0.1,
            },
            { stripCodeFences: true },
          );
          if (resp.content) {
            rawCandidate = resp.content;
            engineUsed = "ollama";
            modelUsed = resp.model;
          }
        } catch (err) {
          if (!allowFallback) throw err;
          fallbackTriggered = true;
          fallbackReason = err instanceof Error ? err.message : String(err);
        }
      } else {
        const msg = probe.available
          ? "Ollama is running but no chat model is installed"
          : `Local Ollama unreachable (${probe.error || "connection refused"})`;
        if (!allowFallback) throw new Error(msg);
        fallbackTriggered = true;
        fallbackReason = msg;
      }
    } else if (engineRequested === "openai-api" || (engineRequested === "auto" && hasExplicitApiConfig(options.llmConfig))) {
      try {
        const resp = await chatCompletion(
          [
            { role: "system", content: profileSpec.systemPrompt },
            { role: "user", content: stage1.dehydration.cleanedText || trimmedInput },
          ],
          {
            ...options.llmConfig,
            temperature: options.llmConfig?.temperature ?? 0.1,
          },
          { stripCodeFences: true },
        );
        if (resp.content) {
          rawCandidate = resp.content;
          engineUsed = "openai-api";
          modelUsed = resp.model;
        }
      } catch (err) {
        if (!allowFallback) throw err;
        fallbackTriggered = true;
        fallbackReason = err instanceof Error ? err.message : String(err);
      }
    } else if (engineRequested === "auto") {
      // Auto mode without cloud API key: check if local Ollama is alive; otherwise instant offline-rule
      const probe = await probeOllama(options.llmConfig?.baseUrl, 600);
      if (probe.available && probe.recommendedModel) {
        try {
          const resp = await chatCompletion(
            [
              { role: "system", content: profileSpec.systemPrompt },
              { role: "user", content: stage1.dehydration.cleanedText || trimmedInput },
            ],
            {
              baseUrl: probe.openaiBaseUrl,
              model: options.llmConfig?.model || probe.recommendedModel,
              temperature: 0.1,
            },
            { stripCodeFences: true },
          );
          if (resp.content) {
            rawCandidate = resp.content;
            engineUsed = "ollama";
            modelUsed = resp.model;
          }
        } catch {
          engineUsed = "offline-rule";
        }
      }
    }
  }

  // Stage 3: Tier-1 Deterministic Hard-Anchor Audit + Anchor Lock + Real BPE Circuit Breaker
  const rawCandidateMetrics = compareTokenMetrics(trimmedInput, rawCandidate);
  let workingOutput = rawCandidate;
  let anchorLockApplied = false;

  const initialAudit = auditBabelTele(trimmedInput, workingOutput);
  if (!initialAudit.passed && enforceLock) {
    workingOutput = enforceAnchorLock(workingOutput, initialAudit);
    anchorLockApplied = true;
  }

  let workingMetrics = compareTokenMetrics(trimmedInput, workingOutput);
  let circuitBreakerTriggered = false;
  let circuitBreakerReason: string | undefined;

  if (enableCircuitBreaker && workingMetrics.o200k_base.deltaTokens >= 0) {
    // Candidate failed ΔL_BPE < 0! Compare against Stage-1 offlineCandidate and dehydrated source
    const offlineMetrics = compareTokenMetrics(trimmedInput, offlineCandidate);
    const dehydratedClean = stage1.dehydration.cleanedText || trimmedInput;
    const dehydratedAudit = auditBabelTele(trimmedInput, dehydratedClean);
    const dehydratedSafe = dehydratedAudit.passed
      ? dehydratedClean
      : enforceAnchorLock(dehydratedClean, dehydratedAudit);
    const dehydratedMetrics = compareTokenMetrics(trimmedInput, dehydratedSafe);

    if (offlineMetrics.o200k_base.compiledTokens < workingMetrics.o200k_base.compiledTokens && offlineMetrics.o200k_base.deltaTokens < 0) {
      workingOutput = offlineCandidate;
      workingMetrics = offlineMetrics;
      circuitBreakerTriggered = true;
      circuitBreakerReason =
        "Stage-2 candidate violated ΔL_BPE < 0; circuit breaker selected tighter Stage-1 BT payload.";
    } else if (dehydratedMetrics.o200k_base.compiledTokens < workingMetrics.o200k_base.compiledTokens) {
      workingOutput = dehydratedSafe;
      workingMetrics = dehydratedMetrics;
      circuitBreakerTriggered = true;
      circuitBreakerReason =
        "Short/dense input is already at BPE entropy floor (ΔL_BPE >= 0); circuit breaker prevented token inflation.";
    } else if (workingMetrics.o200k_base.compiledTokens > workingMetrics.o200k_base.sourceTokens) {
      workingOutput = trimmedInput;
      workingMetrics = compareTokenMetrics(trimmedInput, trimmedInput);
      circuitBreakerTriggered = true;
      circuitBreakerReason =
        "Input cannot be compressed further in BPE subword space; retained verbatim source.";
    }
  }

  const finalAudit = auditBabelTele(trimmedInput, workingOutput);
  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  return {
    output: workingOutput,
    rawCandidate,
    offlineCandidate,
    profile,
    engineRequested,
    engineUsed,
    modelUsed,
    fallbackTriggered,
    fallbackReason,
    circuitBreakerTriggered,
    circuitBreakerReason,
    anchorLockApplied,
    dehydration: stage1.dehydration,
    tokenMetrics: workingMetrics,
    rawCandidateMetrics,
    audit: finalAudit,
    latencyMs,
  };
}

/**
 * Losslessly restores BabelTele back into fluent Chinese (`zh`) or English (`en`) via `BT-Decoder`,
 * with automatic offline structural expansion fallback when no LLM is configured.
 */
export async function decodeFromBabelTele(
  btInput: string,
  targetLang: "zh" | "en" = "zh",
  llmConfig?: LlmClientConfig & { offline?: boolean; engine?: EngineMode },
): Promise<DecodeResult> {
  const t0 = performance.now();
  const trimmed = btInput.trim();
  if (!trimmed) {
    return {
      decodedText: "",
      targetLang,
      engineUsed: "offline-rule",
      fallbackTriggered: false,
      audit: auditBabelTele("", ""),
      latencyMs: 0,
    };
  }

  const systemPrompt = getDecoderSystemPrompt(targetLang);
  const engineReq = llmConfig?.offline ? "offline-rule" : (llmConfig?.engine ?? "auto");
  // Strip leading BT macro module tag (e.g. `#OrderSpec `) when auditing decoded natural language
  const btBodyForAudit = trimmed.replace(/^(?:@[A-Za-z]+)?#[A-Za-z0-9_-]+\s+/, "");

  if (engineReq !== "offline-rule") {
    if (engineReq === "ollama") {
      const probe = await probeOllama(llmConfig?.baseUrl);
      const model = llmConfig?.model || probe.recommendedModel;
      if (probe.available && model) {
        try {
          const resp = await chatCompletion(
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: trimmed },
            ],
            {
              ...llmConfig,
              baseUrl: llmConfig?.baseUrl || probe.openaiBaseUrl,
              model,
              temperature: 0.2,
            },
          );
          return {
            decodedText: resp.content,
            targetLang,
            engineUsed: "ollama",
            modelUsed: resp.model,
            fallbackTriggered: false,
            audit: auditBabelTele(btBodyForAudit, resp.content),
            latencyMs: Math.round((performance.now() - t0) * 100) / 100,
          };
        } catch (err) {
          const decoded = decodeOfflineRule(trimmed, targetLang);
          return {
            decodedText: decoded,
            targetLang,
            engineUsed: "offline-rule",
            fallbackTriggered: true,
            fallbackReason: err instanceof Error ? err.message : String(err),
            audit: auditBabelTele(btBodyForAudit, decoded),
            latencyMs: Math.round((performance.now() - t0) * 100) / 100,
          };
        }
      }
    } else if (engineReq === "openai-api" || hasExplicitApiConfig(llmConfig)) {
      try {
        const resp = await chatCompletion(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: trimmed },
          ],
          {
            ...llmConfig,
            temperature: 0.2,
          },
        );
        return {
          decodedText: resp.content,
          targetLang,
          engineUsed: "openai-api",
          modelUsed: resp.model,
          fallbackTriggered: false,
          audit: auditBabelTele(btBodyForAudit, resp.content),
          latencyMs: Math.round((performance.now() - t0) * 100) / 100,
        };
      } catch (err) {
        const decoded = decodeOfflineRule(trimmed, targetLang);
        return {
          decodedText: decoded,
          targetLang,
          engineUsed: "offline-rule",
          fallbackTriggered: true,
          fallbackReason: err instanceof Error ? err.message : String(err),
          audit: auditBabelTele(btBodyForAudit, decoded),
          latencyMs: Math.round((performance.now() - t0) * 100) / 100,
        };
      }
    }
  }

  const decodedText = decodeOfflineRule(trimmed, targetLang);
  return {
    decodedText,
    targetLang,
    engineUsed: "offline-rule",
    fallbackTriggered: false,
    audit: auditBabelTele(btBodyForAudit, decodedText),
    latencyMs: Math.round((performance.now() - t0) * 100) / 100,
  };
}

/**
 * Compiles verbose/emotional user Chinese/English into neutral-formal BabelTele, dispatches it
 * to the target downstream LLM, and optionally benchmarks against sending raw verbose text.
 */
export async function relayCompare(
  userInput: string,
  compileOpts: CompileOptions = {},
  targetModelConfig: LlmClientConfig & {
    compareRaw?: boolean;
    replyLang?: "zh" | "en";
    systemPrompt?: string;
  } = {},
): Promise<RelayResult> {
  const t0 = performance.now();
  const compilation = await compileToBabelTele(userInput, {
    profile: "neutral-formal",
    ...compileOpts,
  });

  // Resolve target model config (explicit OpenAI API or auto-detected local Ollama)
  let resolvedConfig: LlmClientConfig = { ...targetModelConfig };
  if (!hasExplicitApiConfig(resolvedConfig)) {
    const probe = await probeOllama(resolvedConfig.baseUrl);
    if (probe.available && probe.recommendedModel) {
      resolvedConfig = {
        ...resolvedConfig,
        baseUrl: resolvedConfig.baseUrl || probe.openaiBaseUrl,
        model: resolvedConfig.model || probe.recommendedModel,
      };
    } else {
      throw new Error(
        "Relay requires a reachable target LLM: configure an OpenAI/DeepSeek/Qwen API Key or start local Ollama (`http://127.0.0.1:11434`).",
      );
    }
  }

  const replyLang = targetModelConfig.replyLang ?? "zh";
  const relaySystemPrompt =
    targetModelConfig.systemPrompt ??
    (replyLang === "en"
      ? "Input is encoded in BT-Spec v1.0 (BabelTele) formal notation. Parse all entities, exact numbers, conditions, and boundaries directly, and provide a concise, rigorous technical solution in English without filler."
      : "输入采用 BT-Spec v1.0（巴别语）高密度形式化规约编码。请零样本直接解析全部实体、精确数值、触发条件与禁止边界，直接用简洁、严谨的中文给出工程可执行方案，无需寒暄铺垫。");

  const btResp = await chatCompletion(
    [
      { role: "system", content: relaySystemPrompt },
      { role: "user", content: compilation.output },
    ],
    {
      ...resolvedConfig,
      temperature: resolvedConfig.temperature ?? 0.3,
    },
  );

  const btBpeEst = countDualTokens(compilation.output).o200k_base;
  const btAnsBpeEst = countDualTokens(btResp.content).o200k_base;
  const btRelay: RelayLegMetrics = {
    payloadSent: compilation.output,
    answer: btResp.content,
    model: btResp.model,
    promptTokens: btResp.usage?.promptTokens ?? btBpeEst,
    completionTokens: btResp.usage?.completionTokens ?? btAnsBpeEst,
    totalTokens: btResp.usage?.totalTokens ?? btBpeEst + btAnsBpeEst,
    latencyMs: btResp.latencyMs,
  };

  let rawBaseline: RelayLegMetrics | undefined;
  if (targetModelConfig.compareRaw) {
    const rawResp = await chatCompletion(
      [{ role: "user", content: userInput }],
      {
        ...resolvedConfig,
        temperature: resolvedConfig.temperature ?? 0.3,
      },
    );
    const rawPromptEst = countDualTokens(userInput).o200k_base;
    const rawAnsEst = countDualTokens(rawResp.content).o200k_base;
    rawBaseline = {
      payloadSent: userInput,
      answer: rawResp.content,
      model: rawResp.model,
      promptTokens: rawResp.usage?.promptTokens ?? rawPromptEst,
      completionTokens: rawResp.usage?.completionTokens ?? rawAnsEst,
      totalTokens: rawResp.usage?.totalTokens ?? rawPromptEst + rawAnsEst,
      latencyMs: rawResp.latencyMs,
    };
  }

  const totalLatencyMs = Math.round((performance.now() - t0) * 100) / 100;

  return {
    compilation,
    btRelay,
    rawBaseline,
    savings: {
      inputBpeSavedO200k: compilation.tokenMetrics.o200k_base.savedTokens,
      inputBpeReductionPct: compilation.tokenMetrics.o200k_base.compressionRatioPct,
      promptTokensSaved: rawBaseline
        ? rawBaseline.promptTokens - btRelay.promptTokens
        : undefined,
      totalTokensSaved: rawBaseline
        ? rawBaseline.totalTokens - btRelay.totalTokens
        : undefined,
    },
    totalLatencyMs,
  };
}
