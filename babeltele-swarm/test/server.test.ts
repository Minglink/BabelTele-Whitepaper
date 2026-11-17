import assert from 'node:assert/strict';
import * as http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { startWarRoomServer } from '../src/server';

describe('War-Room HTTP & Real-Time SSE Server', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    const started = await startWarRoomServer(0);
    server = started.server;
    baseUrl = `http://127.0.0.1:${started.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves War-Room UI HTML and /api/health + /api/blueprints', async () => {
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('BabelTele Swarm'));

    const health = (await fetch(`${baseUrl}/api/health`).then((r) => r.json())) as {
      ok: boolean;
      service: string;
    };
    assert.equal(health.ok, true);
    assert.equal(health.service, '@babeltele/swarm');

    const bp = (await fetch(`${baseUrl}/api/blueprints`).then((r) => r.json())) as {
      ok: boolean;
      blueprints: unknown[];
    };
    assert.equal(bp.ok, true);
    assert.equal(bp.blueprints.length, 3);
  });

  it('decodes BabelTele control messages to Chinese via POST /api/decode-msg (Sidecar Lens)', async () => {
    const res = await fetch(`${baseUrl}/api/decode-msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '#PRD[dom:实时风控 | lang:python | goals:滑动窗+黑名单 | inv:!Guard(score>=80)]',
      }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      decoded: { isBabelTele: boolean; blockType: string; decodedZh: string };
    };
    assert.equal(json.ok, true);
    assert.equal(json.decoded.isBabelTele, true);
    assert.equal(json.decoded.blockType, 'PRD');
    assert.ok(json.decoded.decodedZh.includes('业务领域：实时风控'));
  });

  it('audits code via POST /api/sanitize and blocks path traversal on workspace file endpoint', async () => {
    const sanRes = await fetch(`${baseUrl}/api/sanitize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: 'bad.py',
        content: 'def f(x):\n    if x > 0 ⇒ return x\n',
        language: 'python',
      }),
    }).then((r) => r.json() as Promise<{ ok: boolean; sanitizer: { clean: boolean; babelTeleLeakageCount: number } }>);

    assert.equal(sanRes.ok, true);
    assert.equal(sanRes.sanitizer.clean, false);
    assert.ok(sanRes.sanitizer.babelTeleLeakageCount >= 1);

    // Trigger a fast run via POST /api/runs
    const runRes = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', busMode: 'babeltele', engine: 'demo-sim' }),
    }).then((r) => r.json() as Promise<{ ok: boolean; result: { runId: string } }>);
    assert.equal(runRes.ok, true);

    // Valid file read
    const validFileRes = await fetch(
      `${baseUrl}/api/runs/${runRes.result.runId}/file?path=models.py`
    );
    assert.equal(validFileRes.status, 200);

    // Path traversal attempt must be rejected with 400
    const traversalRes = await fetch(
      `${baseUrl}/api/runs/${runRes.result.runId}/file?path=../../package.json`
    );
    assert.equal(traversalRes.status, 400);
  });

  it('streams live War-Room SSE events via POST /api/runs/stream', async () => {
    const sseRes = await fetch(`${baseUrl}/api/runs/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'typescript',
        busMode: 'babeltele',
        engine: 'demo-sim',
        fast: true,
      }),
    });
    assert.equal(sseRes.status, 200);
    assert.ok(sseRes.headers.get('content-type')?.includes('text/event-stream'));

    const rawSse = await sseRes.text();
    assert.ok(rawSse.includes('event: run-start'));
    assert.ok(rawSse.includes('event: control-msg'));
    assert.ok(rawSse.includes('event: artifact-written'));
    assert.ok(rawSse.includes('event: verification-report'));
    assert.ok(rawSse.includes('event: run-complete'));
  });
});
