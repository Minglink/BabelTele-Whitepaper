import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnv } from "./env.js";
import { auditBabelTele } from "./core/auditor.js";
import {
  compileToBabelTele,
  decodeFromBabelTele,
  relayCompare,
  type EngineMode,
} from "./core/compiler.js";
import { probeOllama } from "./core/llmClient.js";
import {
  COMPILER_PROFILES,
  PRESET_EXAMPLES,
  type CompilerProfileId,
} from "./core/prompts.js";
import { compareTokenMetrics, countDualTokens } from "./core/tokenizer.js";

loadDotEnv();

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CURRENT_DIR, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request payload exceeds 2MB limit"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error("Malformed JSON request body"));
      }
    });

    req.on("error", (err) => reject(err));
  });
}

async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "@babeltele/studio",
      specVersion: "BT-Spec v1.0",
      version: "1.0.0",
      nodeVersion: process.version,
      uptimeSec: Math.round(process.uptime()),
      defaults: {
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.deepseek.com/v1",
        model: process.env.OPENAI_MODEL || "deepseek-chat",
        hasApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      },
      profiles: Object.values(COMPILER_PROFILES).map((p) => ({
        id: p.id,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        tier: p.tier,
        probeCode: p.probeCode,
        descriptionZh: p.descriptionZh,
        descriptionEn: p.descriptionEn,
      })),
      presets: PRESET_EXAMPLES,
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/ollama/detect") {
    const customUrl = searchParams.get("baseUrl") || undefined;
    const probe = await probeOllama(customUrl);
    sendJson(res, 200, probe);
    return;
  }

  if (req.method === "POST" && pathname === "/api/tokenize") {
    const body = await readJsonBody<{ text?: string }>(req);
    const text = typeof body.text === "string" ? body.text : "";
    sendJson(res, 200, countDualTokens(text));
    return;
  }

  if (req.method === "POST" && pathname === "/api/audit") {
    const body = await readJsonBody<{ sourceText?: string; btText?: string }>(req);
    const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
    const btText = typeof body.btText === "string" ? body.btText : "";
    const audit = auditBabelTele(sourceText, btText);
    const tokenMetrics = compareTokenMetrics(sourceText, btText);
    sendJson(res, 200, { audit, tokenMetrics });
    return;
  }

  if (req.method === "POST" && pathname === "/api/compile") {
    const body = await readJsonBody<{
      text?: string;
      profile?: CompilerProfileId;
      engine?: EngineMode;
      offline?: boolean;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      enforceLock?: boolean;
      allowFallback?: boolean;
      enableCircuitBreaker?: boolean;
    }>(req);

    if (typeof body.text !== "string") {
      sendJson(res, 400, { error: "Field `text` (string) is required." });
      return;
    }

    const result = await compileToBabelTele(body.text, {
      profile: body.profile,
      engine: body.engine,
      offline: body.offline,
      enforceLock: body.enforceLock,
      allowFallback: body.allowFallback,
      enableCircuitBreaker: body.enableCircuitBreaker,
      llmConfig: {
        baseUrl: body.baseUrl,
        apiKey: body.apiKey,
        model: body.model,
      },
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/decode") {
    const body = await readJsonBody<{
      btText?: string;
      targetLang?: "zh" | "en";
      engine?: EngineMode;
      offline?: boolean;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
    }>(req);

    if (typeof body.btText !== "string") {
      sendJson(res, 400, { error: "Field `btText` (string) is required." });
      return;
    }

    const lang = body.targetLang === "en" ? "en" : "zh";
    const result = await decodeFromBabelTele(body.btText, lang, {
      engine: body.engine,
      offline: body.offline,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/relay") {
    const body = await readJsonBody<{
      text?: string;
      profile?: CompilerProfileId;
      compileEngine?: EngineMode;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      replyLang?: "zh" | "en";
      compareRaw?: boolean;
    }>(req);

    if (typeof body.text !== "string" || !body.text.trim()) {
      sendJson(res, 400, { error: "Field `text` (non-empty string) is required." });
      return;
    }

    try {
      const result = await relayCompare(
        body.text,
        {
          profile: body.profile ?? "neutral-formal",
          engine: body.compileEngine ?? "offline-rule",
          llmConfig: {
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            model: body.model,
          },
        },
        {
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
          model: body.model,
          replyLang: body.replyLang ?? "zh",
          compareRaw: Boolean(body.compareRaw),
        },
      );
      sendJson(res, 200, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sendJson(res, 422, { error: msg });
    }
    return;
  }

  sendJson(res, 404, { error: `Unknown API route: ${req.method} ${pathname}` });
}

async function serveStaticFile(res: ServerResponse, pathname: string): Promise<void> {
  const relPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.resolve(PUBLIC_DIR, relPath);

  // Strict directory boundary guard
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden path" });
    return;
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fs.readFile(resolvedPath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "Static resource not found" });
  }
}

export function createStudioServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (urlObj.pathname.startsWith("/api/")) {
        await handleApiRequest(req, res, urlObj.pathname, urlObj.searchParams);
        return;
      }
      await serveStaticFile(res, urlObj.pathname);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (!res.headersSent) {
        sendJson(res, 500, { error: message });
      } else {
        res.end();
      }
    }
  });
}

export async function startStudioServer(
  port = Number(process.env.PORT || 3721),
  host = "127.0.0.1",
): Promise<{ server: http.Server; port: number; url: string }> {
  const server = createStudioServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  const url = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actualPort}`;
  return { server, port: actualPort, url };
}

// Run server directly when invoked as main entrypoint (`npm start` or `node dist/server.js`)
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && invokedPath === selfPath) {
  const desiredPort = Number(process.env.PORT || 3721);
  startStudioServer(desiredPort, "0.0.0.0")
    .then(({ url, port }) => {
      console.log(`\n🗼 BabelTele Studio (BT-Spec v1.0) listening on ${url} (PORT=${port})`);
      console.log(`   • Health & Profiles : ${url}/api/health`);
      console.log(`   • Ollama Auto-Probe : ${url}/api/ollama/detect`);
      console.log(`   • Interactive Web UI: ${url}\n`);
    })
    .catch((err) => {
      console.error("Failed to start BabelTele Studio server:", err);
      process.exit(1);
    });
}
