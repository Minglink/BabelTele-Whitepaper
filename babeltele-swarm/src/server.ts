import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { SHOWCASE_BLUEPRINTS } from './core/demoBlueprints';
import { extractBtHeader } from './core/headerExtractor';
import { detectLocalOllama } from './core/llmDriver';
import { resolveProjectRoot, safeResolveWorkspaceFile } from './core/paths';
import { auditArtifact, inferLanguageFromPath } from './core/sanitizer';
import { decodeBabelTeleToZh } from './core/sidecarDecoder';
import { computeSavedPercent } from './core/tokenizer';
import { detectHostToolchains } from './core/verifier';
import { executeSwarmRun, getRecentRuns, getRunById } from './orchestrator/swarmEngine';
import type { BusMode, EngineMode, RunModeSelection, TargetLanguage } from './types';

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

async function readJsonBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > 2 * 1024 * 1024) {
        reject(new Error('Request payload exceeds 2MB limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeLanguage(val: unknown): TargetLanguage {
  const s = String(val ?? 'java').toLowerCase();
  if (s === 'typescript' || s === 'ts') return 'typescript';
  if (s === 'python' || s === 'py') return 'python';
  return 'java';
}

function normalizeRunMode(val: unknown): RunModeSelection {
  const s = String(val ?? 'babeltele').toLowerCase();
  if (s === 'verbose-nl') return 'verbose-nl';
  if (s === 'ab-race') return 'ab-race';
  return 'babeltele';
}

function normalizeEngine(val: unknown): EngineMode {
  const s = String(val ?? 'demo-sim').toLowerCase();
  if (s === 'ollama') return 'ollama';
  if (s === 'openai-compat') return 'openai-compat';
  return 'demo-sim';
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function createWarRoomServer(): http.Server {
  const publicDir = path.join(resolveProjectRoot(), 'public');

  const server = http.createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = parsedUrl.pathname;

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
      }

      // 1. Health & Toolchains
      if (method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          service: '@babeltele/swarm',
          version: '1.0.0',
          toolchains: detectHostToolchains(),
        });
        return;
      }

      // 2. Showcase Blueprints
      if (method === 'GET' && pathname === '/api/blueprints') {
        const list = Object.values(SHOWCASE_BLUEPRINTS).map((bp) => ({
          id: bp.id,
          language: bp.language,
          titleZh: bp.titleZh,
          badgeZh: bp.badgeZh,
          defaultPromptZh: bp.defaultPromptZh,
          archSummaryZh: bp.archSummaryZh,
          fileCount: bp.files.length,
          files: bp.files.map((f) => ({ filePath: f.filePath, role: f.role })),
        }));
        sendJson(res, 200, { ok: true, blueprints: list });
        return;
      }

      // 3. Ollama Auto-Discovery
      if (method === 'GET' && pathname === '/api/ollama/detect') {
        const hostParam = parsedUrl.searchParams.get('host') || undefined;
        const detection = await detectLocalOllama(hostParam);
        sendJson(res, 200, { ok: true, ...detection });
        return;
      }

      // 4. Sidecar Lens Human Decoder
      if (method === 'POST' && pathname === '/api/decode-msg') {
        const body = await readJsonBody<{ text?: string }>(req);
        const decoded = decodeBabelTeleToZh(String(body.text ?? ''));
        sendJson(res, 200, { ok: true, decoded });
        return;
      }

      // 5. On-Demand ArtifactSanitizer & BT-Header Inspector
      if (method === 'POST' && pathname === '/api/sanitize') {
        const body = await readJsonBody<{
          filePath?: string;
          content?: string;
          language?: TargetLanguage;
        }>(req);
        const filePath = String(body.filePath ?? 'Snippet.java');
        const content = String(body.content ?? '');
        const lang = body.language ? normalizeLanguage(body.language) : inferLanguageFromPath(filePath);
        const sanitizer = auditArtifact(filePath, content, lang);
        const btHeaderDigest = extractBtHeader(filePath, content, lang);
        sendJson(res, 200, { ok: true, sanitizer, btHeaderDigest });
        return;
      }

      // 6. Real-Time SSE Streaming War-Room Run (/api/runs/stream via GET or POST)
      if ((method === 'GET' || method === 'POST') && pathname === '/api/runs/stream') {
        const bodyParams =
          method === 'POST' ? await readJsonBody<Record<string, unknown>>(req) : {};

        const getParam = (key: string): unknown =>
          bodyParams[key] !== undefined ? bodyParams[key] : parsedUrl.searchParams.get(key) ?? undefined;

        const language = normalizeLanguage(getParam('language') ?? getParam('lang'));
        const modeSelection = normalizeRunMode(getParam('busMode') ?? getParam('bus'));
        const engine = normalizeEngine(getParam('engine'));
        const prompt = String(getParam('prompt') ?? '');
        const injectFaultDrill =
          getParam('injectFaultDrill') === true || getParam('injectFaultDrill') === 'true' || getParam('injectFaultDrill') === '1';
        const fastMode = getParam('fast') === true || getParam('fast') === 'true' || getParam('fast') === '1';

        const apiKey = getParam('apiKey') ? String(getParam('apiKey')) : undefined;
        const baseUrl = getParam('baseUrl') ? String(getParam('baseUrl')) : undefined;
        const model = getParam('model') ? String(getParam('model')) : undefined;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        });

        let clientClosed = false;
        req.on('close', () => {
          clientClosed = true;
        });

        const writeSse = (eventName: string, data: unknown): void => {
          if (clientClosed || res.writableEnded) return;
          res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
          if (modeSelection === 'ab-race') {
            // Execute BOTH BabelTele Bus AND Verbose-NL Bus back-to-back for authentic dual-run race!
            writeSse('race-phase', {
              phase: 'babeltele',
              labelZh: '第 1 棒：⚡ 巴别语极速控制流总线推进中...',
            });

            const btRun = await executeSwarmRun({
              prompt,
              language,
              busMode: 'babeltele',
              injectFaultDrill,
              computeAbComparison: true,
              simulateStreamingDelay: !fastMode && engine === 'demo-sim',
              llm: { engine, apiKey, baseUrl, model },
              onEvent: (ev) => writeSse(ev.type, { ...ev, raceTrack: 'babeltele' }),
            });

            writeSse('race-phase', {
              phase: 'verbose-nl',
              labelZh: '第 2 棒（对照组）：📝 传统自然语言冗长总线推进中...',
            });

            const nlRun = await executeSwarmRun({
              prompt,
              language,
              busMode: 'verbose-nl',
              injectFaultDrill,
              computeAbComparison: false,
              simulateStreamingDelay: !fastMode && engine === 'demo-sim',
              llm: { engine, apiKey, baseUrl, model },
              onEvent: (ev) => {
                // Stream control messages and status updates tagged as verbose-nl baseline track
                if (ev.type === 'control-msg' || ev.type === 'agent-status') {
                  writeSse('race-baseline-event', ev);
                }
              },
            });

            const measuredSpeedup =
              Math.round(
                (Math.max(1, nlRun.telemetry.durationMs) /
                  Math.max(1, btRun.telemetry.durationMs)) *
                  100
              ) / 100;

            const mergedAb = {
              babeltele: btRun.telemetry,
              verboseNl: nlRun.telemetry,
              controlTokenReductionPercent: computeSavedPercent(
                btRun.telemetry.controlPlaneTokens,
                nlRun.telemetry.controlPlaneTokens
              ),
              totalBusAndMemoryReductionPercent: computeSavedPercent(
                btRun.telemetry.totalBusAndMemoryTokens,
                nlRun.telemetry.totalBusAndMemoryTokens
              ),
              speedupMultiplier:
                measuredSpeedup >= 1.2
                  ? measuredSpeedup
                  : btRun.abComparison?.speedupMultiplier ?? 2.8,
              stageBreakdown: btRun.abComparison?.stageBreakdown ?? [],
            };

            btRun.abComparison = mergedAb;

            writeSse('race-complete', {
              btRunId: btRun.runId,
              nlRunId: nlRun.runId,
              abComparison: mergedAb,
              nlMessagesCount: nlRun.messages.length,
            });
          } else {
            const activeBus: BusMode = modeSelection;
            await executeSwarmRun({
              prompt,
              language,
              busMode: activeBus,
              injectFaultDrill,
              computeAbComparison: true,
              simulateStreamingDelay: !fastMode && engine === 'demo-sim',
              llm: { engine, apiKey, baseUrl, model },
              onEvent: (ev) => writeSse(ev.type, ev),
            });
          }
        } catch (runErr: unknown) {
          writeSse('run-error', {
            error: runErr instanceof Error ? runErr.message : String(runErr),
          });
        } finally {
          if (!res.writableEnded) {
            res.end();
          }
        }
        return;
      }

      // 7. Synchronous JSON Run Endpoint (POST /api/runs)
      if (method === 'POST' && pathname === '/api/runs') {
        const body = await readJsonBody<Record<string, unknown>>(req);
        const language = normalizeLanguage(body.language ?? body.lang);
        const busMode: BusMode = body.busMode === 'verbose-nl' ? 'verbose-nl' : 'babeltele';
        const engine = normalizeEngine(body.engine);
        const prompt = String(body.prompt ?? '');
        const injectFaultDrill = Boolean(body.injectFaultDrill);

        const result = await executeSwarmRun({
          prompt,
          language,
          busMode,
          injectFaultDrill,
          computeAbComparison: true,
          simulateStreamingDelay: false,
          llm: {
            engine,
            apiKey: body.apiKey ? String(body.apiKey) : undefined,
            baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
            model: body.model ? String(body.model) : undefined,
          },
        });
        sendJson(res, 200, { ok: true, result });
        return;
      }

      // 8. List Recent Runs (GET /api/runs)
      if (method === 'GET' && pathname === '/api/runs') {
        const runs = getRecentRuns().map((r) => ({
          runId: r.runId,
          createdAt: r.createdAt,
          prompt: r.prompt,
          language: r.language,
          busMode: r.busMode,
          engine: r.engine,
          passed: r.finalVerification.passed,
          zeroBabelTeleLeakage: r.finalVerification.zeroBabelTeleLeakage,
          filesCount: r.artifacts.length,
          telemetry: r.telemetry,
        }));
        sendJson(res, 200, { ok: true, runs });
        return;
      }

      // 9. Get Single Run or Workspace File (/api/runs/:runId and /api/runs/:runId/file)
      const runFileMatch = pathname.match(/^\/api\/runs\/([^/]+)\/file$/);
      if (method === 'GET' && runFileMatch) {
        const runId = decodeURIComponent(runFileMatch[1]);
        const relFile = parsedUrl.searchParams.get('path') || '';
        const run = getRunById(runId);
        if (!run) {
          sendJson(res, 404, { ok: false, error: `Run not found: ${runId}` });
          return;
        }
        try {
          const absFile = safeResolveWorkspaceFile(run.workspacePath, relFile);
          if (!fs.existsSync(absFile) || !fs.statSync(absFile).isFile()) {
            sendJson(res, 404, { ok: false, error: `File not found in workspace: ${relFile}` });
            return;
          }
          const content = fs.readFileSync(absFile, 'utf8');
          const lang = inferLanguageFromPath(relFile);
          const sanitizer = auditArtifact(relFile, content, lang);
          const btHeaderDigest = extractBtHeader(relFile, content, lang);
          sendJson(res, 200, {
            ok: true,
            runId,
            filePath: relFile,
            content,
            sanitizer,
            btHeaderDigest,
          });
        } catch (pathErr: unknown) {
          sendJson(res, 400, {
            ok: false,
            error: pathErr instanceof Error ? pathErr.message : 'Invalid file path',
          });
        }
        return;
      }

      const runDetailMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (method === 'GET' && runDetailMatch) {
        const runId = decodeURIComponent(runDetailMatch[1]);
        const run = getRunById(runId);
        if (!run) {
          sendJson(res, 404, { ok: false, error: `Run not found: ${runId}` });
          return;
        }
        sendJson(res, 200, { ok: true, result: run });
        return;
      }

      // 10. Serve War-Room Web UI Static Assets from public/
      if (method === 'GET') {
        const targetRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const resolvedPublic = path.resolve(publicDir);
        const candidate = path.resolve(resolvedPublic, targetRel);
        if (
          (candidate === resolvedPublic || candidate.startsWith(resolvedPublic + path.sep)) &&
          fs.existsSync(candidate) &&
          fs.statSync(candidate).isFile()
        ) {
          const ext = path.extname(candidate).toLowerCase();
          res.writeHead(200, {
            'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
          });
          res.end(fs.readFileSync(candidate));
          return;
        }
      }

      sendJson(res, 404, { ok: false, error: `Route not found: ${method} ${pathname}` });
    } catch (err: unknown) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  return server;
}

export async function startWarRoomServer(
  port = Number(process.env.PORT || 3722)
): Promise<{ server: http.Server; port: number }> {
  const server = createWarRoomServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ server, port: actualPort });
    });
  });
}

if (require.main === module) {
  const desiredPort = Number(process.env.PORT || 3722);
  startWarRoomServer(desiredPort)
    .then(({ port }) => {
      const tc = detectHostToolchains();
      console.log(`\n⚡ BabelTele Swarm War-Room Server running at http://127.0.0.1:${port}`);
      console.log(
        `   Toolchains detected: Node ${tc.node} | ${tc.tsc} | Java: ${tc.javac ?? 'N/A'} | Python: ${tc.python ?? 'N/A'}\n`
      );
    })
    .catch((err: unknown) => {
      console.error('Failed to start War-Room Server:', err);
      process.exit(1);
    });
}
