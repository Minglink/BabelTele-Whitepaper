import type { LlmConfig } from '../types';

export interface OllamaDetectionResult {
  available: boolean;
  baseUrl: string;
  models: string[];
  message: string;
}

/**
 * Auto-discovers a running local Ollama instance on 127.0.0.1:11434.
 */
export async function detectLocalOllama(
  rawHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
): Promise<OllamaDetectionResult> {
  const cleanHost = rawHost.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const tagsUrl = `${cleanHost}/api/tags`;

  try {
    const res = await fetch(tagsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      return {
        available: false,
        baseUrl: `${cleanHost}/v1`,
        models: [],
        message: `Ollama responded with HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? [])
      .map((m) => m.name ?? '')
      .filter(Boolean);
    return {
      available: true,
      baseUrl: `${cleanHost}/v1`,
      models,
      message:
        models.length > 0
          ? `已发现本机 Ollama（${models.length} 个模型可用）`
          : '本机 Ollama 在线（尚未拉取模型）',
    };
  } catch {
    return {
      available: false,
      baseUrl: `${cleanHost}/v1`,
      models: [],
      message: '未检测到运行中的本机 Ollama (127.0.0.1:11434)，可使用内置实战演练沙盒或云端 API',
    };
  }
}

export interface ChatCompletionResponse {
  content: string;
  latencyMs: number;
}

/**
 * Universal OpenAI-compatible /v1/chat/completions client (supports DeepSeek, Qwen, OpenAI, Gemini, Ollama).
 */
export async function callChatCompletion(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<ChatCompletionResponse> {
  const started = performance.now();

  const defaultBaseUrl =
    config.engine === 'ollama'
      ? process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1'
      : process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1';

  const baseUrl = (config.baseUrl || defaultBaseUrl).replace(/\/$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const model =
    config.model ||
    (config.engine === 'ollama'
      ? process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'
      : process.env.OPENAI_MODEL || 'deepseek-chat');

  const apiKey =
    config.apiKey ||
    process.env.OPENAI_API_KEY ||
    (config.engine === 'ollama' ? 'ollama' : '');

  if (config.engine === 'openai-compat' && !apiKey) {
    throw new Error(
      'Missing API Key for OpenAI-compatible engine. Provide apiKey in UI/CLI, set OPENAI_API_KEY, or select "demo-sim" / "ollama".'
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: config.temperature ?? 0.15,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`LLM HTTP ${res.status} from ${endpoint}: ${errBody.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error(`Empty completion content returned from model "${model}"`);
  }

  return {
    content,
    latencyMs: Math.round(performance.now() - started),
  };
}

/**
 * Simulates realistic LLM token generation throughput (~180 tok/s) when streaming
 * the built-in Showcase Blueprints in the War-Room Web UI, or 0ms in automated tests.
 */
export async function paceSimulatedTokens(
  tokenCount: number,
  simulateStreamingDelay: boolean
): Promise<number> {
  // Equivalent wall-clock generation time at ~165 tokens/sec + 35ms network RTT
  const modeledLatencyMs = Math.round(35 + (tokenCount / 165) * 1000);
  if (!simulateStreamingDelay) {
    return modeledLatencyMs;
  }
  // Cap actual UI sleep per step so the live demo feels snappy yet visibly faster in BabelTele mode
  const actualWaitMs = Math.min(520, Math.max(40, Math.round(tokenCount * 1.15)));
  await new Promise((resolve) => setTimeout(resolve, actualWaitMs));
  return modeledLatencyMs;
}
