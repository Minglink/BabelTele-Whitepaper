export interface LlmClientConfig {
  /**
   * OpenAI-compatible base URL:
   * - OpenAI:    https://api.openai.com/v1
   * - DeepSeek:  https://api.deepseek.com/v1
   * - Qwen:      https://dashscope.aliyuncs.com/compatible-mode/v1
   * - Ollama:    http://127.0.0.1:11434/v1
   * - LM Studio: http://127.0.0.1:1234/v1
   */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  rawContent: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number;
  parameterSize?: string;
  quantizationLevel?: string;
  family?: string;
}

export interface OllamaProbeResult {
  available: boolean;
  ollamaHost: string;
  openaiBaseUrl: string;
  models: OllamaModelInfo[];
  recommendedModel: string | null;
  latencyMs: number;
  error?: string;
}

/**
 * Normalizes any user-provided OpenAI-compatible base URL into a valid `/chat/completions` endpoint.
 */
export function resolveChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  // Standard versioned paths (/v1, /v1beta/openai, /compatible-mode/v1, /api/paas/v4)
  if (/\/(?:v\d+(?:beta)?(?:\/openai)?|compatible-mode\/v\d+)$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

/**
 * Resolves Ollama's native HTTP root (e.g., `http://127.0.0.1:11434`) even if `/v1` was passed.
 */
export function resolveOllamaRoot(baseUrl?: string): string {
  if (!baseUrl || !baseUrl.trim()) {
    return "http://127.0.0.1:11434";
  }
  return baseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1(?:\/chat\/completions)?$/i, "");
}

/**
 * Strips `<think>...</think>` blocks emitted by reasoning models (e.g. DeepSeek-R1, Qwen3)
 * and strips accidental markdown code fences around single-block compiler outputs.
 */
export function sanitizeCompilerOutput(rawContent: string, stripCodeFences = false): string {
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (stripCodeFences) {
    const fenceMatch = cleaned.match(/^```(?:[a-zA-Z0-9_-]*)\r?\n([\s\S]*?)\r?\n```$/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
  }
  return cleaned;
}

const PREFERRED_OLLAMA_PREFIXES = [
  "qwen2.5:3b",
  "qwen2.5:7b",
  "qwen3:4b",
  "qwen3:8b",
  "qwen2.5",
  "qwen3",
  "llama3.2",
  "llama3.1",
  "gemma3",
  "gemma2",
  "mistral",
  "phi4",
  "deepseek",
];

function pickRecommendedOllamaModel(models: OllamaModelInfo[]): string | null {
  const chatCapable = models.filter(
    (m) => !/embed|nomic-embed|bge-|minilm/i.test(m.name),
  );
  if (chatCapable.length === 0) return null;

  for (const prefix of PREFERRED_OLLAMA_PREFIXES) {
    const hit = chatCapable.find((m) => m.name.toLowerCase().startsWith(prefix));
    if (hit) return hit.name;
  }
  return chatCapable[0].name;
}

/**
 * Auto-detects whether local Ollama is running at `http://127.0.0.1:11434/api/tags` (1.5s timeout)
 * and lists installed local small models. Never throws on network refusal/timeout.
 */
export async function probeOllama(
  baseUrl?: string,
  timeoutMs = 1500,
): Promise<OllamaProbeResult> {
  const t0 = performance.now();
  const ollamaHost = resolveOllamaRoot(baseUrl);
  const openaiBaseUrl = `${ollamaHost}/v1`;
  const tagsUrl = `${ollamaHost}/api/tags`;

  try {
    const response = await fetch(tagsUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

    if (!response.ok) {
      return {
        available: false,
        ollamaHost,
        openaiBaseUrl,
        models: [],
        recommendedModel: null,
        latencyMs,
        error: `HTTP ${response.status} from ${tagsUrl}`,
      };
    }

    const payload = (await response.json()) as {
      models?: Array<{
        name?: string;
        size?: number;
        details?: {
          parameter_size?: string;
          quantization_level?: string;
          family?: string;
        };
      }>;
    };

    const models: OllamaModelInfo[] = (payload.models ?? [])
      .filter((m): m is NonNullable<typeof m> & { name: string } => typeof m?.name === "string")
      .map((m) => ({
        name: m.name,
        sizeBytes: typeof m.size === "number" ? m.size : 0,
        parameterSize: m.details?.parameter_size,
        quantizationLevel: m.details?.quantization_level,
        family: m.details?.family,
      }));

    return {
      available: true,
      ollamaHost,
      openaiBaseUrl,
      models,
      recommendedModel: pickRecommendedOllamaModel(models),
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      ollamaHost,
      openaiBaseUrl,
      models: [],
      recommendedModel: null,
      latencyMs,
      error: message,
    };
  }
}

/**
 * Universal OpenAI-Compatible `/v1/chat/completions` client.
 * Works seamlessly with OpenAI, DeepSeek, Qwen DashScope, Gemini OpenAI-compat, Ollama, and LM Studio.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  config: LlmClientConfig,
  options: { stripCodeFences?: boolean } = {},
): Promise<ChatCompletionResponse> {
  const baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const model = config.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const temperature = config.temperature ?? 0.1;
  const timeoutMs = config.timeoutMs ?? 45000;

  const endpoint = resolveChatCompletionsUrl(baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    stream: false,
  };
  if (typeof config.maxTokens === "number" && config.maxTokens > 0) {
    body.max_tokens = config.maxTokens;
  }

  const t0 = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `LLM API HTTP ${response.status} (${endpoint}): ${errBody.slice(0, 300) || response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const rawContent = json.choices?.[0]?.message?.content ?? "";
  const content = sanitizeCompilerOutput(rawContent, options.stripCodeFences ?? false);

  const usage = json.usage
    ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
        totalTokens:
          json.usage.total_tokens ??
          (json.usage.prompt_tokens ?? 0) + (json.usage.completion_tokens ?? 0),
      }
    : undefined;

  return {
    content,
    rawContent,
    model: json.model || model,
    usage,
    latencyMs,
  };
}
