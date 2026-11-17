import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { runCli } from "../dist/cli.js";
import { startStudioServer } from "../dist/server.js";

describe("HTTP Web Studio Server & REST API (server.ts)", () => {
  it("serves Web UI and handles /api/health, /api/ollama/detect, /api/tokenize, /api/compile, /api/decode, /api/audit, /api/relay", async () => {
    // Mock downstream LLM server for /api/relay & /api/ollama/detect
    const mockLlm = http.createServer(async (req, res) => {
      if (req.url === "/api/tags") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: "qwen2.5:7b", size: 4700000000 }] }));
        return;
      }
      if (req.url === "/v1/chat/completions") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          model: string;
          messages: Array<{ content: string }>;
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            model: body.model,
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "已接收巴别语规约：使用 Redis Lua 预扣减 + 异步 MQ 削峰，确保 P99 <= 200ms。",
                },
              },
            ],
            usage: { prompt_tokens: 42, completion_tokens: 26, total_tokens: 68 },
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => mockLlm.listen(0, "127.0.0.1", () => resolve()));
    const mockAddr = mockLlm.address();
    const mockPort = typeof mockAddr === "object" && mockAddr ? mockAddr.port : 0;
    const mockUrl = `http://127.0.0.1:${mockPort}`;

    const studio = await startStudioServer(0, "127.0.0.1");

    try {
      // 1. Static Web Studio index.html
      const htmlRes = await fetch(`${studio.url}/`);
      assert.equal(htmlRes.status, 200);
      const html = await htmlRes.text();
      assert.ok(html.includes("BabelTele Studio"));
      assert.ok(html.includes("BT-Spec v1.0"));

      // 2. GET /api/health
      const healthRes = await fetch(`${studio.url}/api/health`);
      assert.equal(healthRes.status, 200);
      const health = (await healthRes.json()) as {
        ok: boolean;
        profiles: unknown[];
        presets: unknown[];
      };
      assert.equal(health.ok, true);
      assert.equal(health.profiles.length, 5);
      assert.equal(health.presets.length, 4);

      // 3. GET /api/ollama/detect
      const ollamaRes = await fetch(
        `${studio.url}/api/ollama/detect?baseUrl=${encodeURIComponent(mockUrl)}`,
      );
      assert.equal(ollamaRes.status, 200);
      const ollamaJson = (await ollamaRes.json()) as {
        available: boolean;
        recommendedModel: string;
      };
      assert.equal(ollamaJson.available, true);
      assert.equal(ollamaJson.recommendedModel, "qwen2.5:7b");

      // 4. POST /api/tokenize
      const tokRes = await fetch(`${studio.url}/api/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello BabelTele Studio 3721!" }),
      });
      assert.equal(tokRes.status, 200);
      const tokJson = (await tokRes.json()) as { o200k_base: number; cl100k_base: number };
      assert.ok(tokJson.o200k_base > 0);
      assert.ok(tokJson.cl100k_base > 0);

      // 5. POST /api/compile (offline-rule)
      const src =
        "你好请问能不能麻烦帮我看看！我真是服了这个破系统总是超时：/api/v2/checkout 接口在商品超过 50 件时延迟超过 3500ms，要求优化到 200ms 以内，严禁直连主库 MySQL，除非 Redis 宕机！";
      const compRes = await fetch(`${studio.url}/api/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: src, profile: "neutral-formal", offline: true }),
      });
      assert.equal(compRes.status, 200);
      const compJson = (await compRes.json()) as {
        output: string;
        audit: { passed: boolean };
        tokenMetrics: { o200k_base: { deltaTokens: number } };
      };
      assert.equal(compJson.audit.passed, true);
      assert.ok(compJson.tokenMetrics.o200k_base.deltaTokens < 0);

      // 6. POST /api/decode (offline-rule)
      const decRes = await fetch(`${studio.url}/api/decode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ btText: compJson.output, targetLang: "zh", offline: true }),
      });
      assert.equal(decRes.status, 200);
      const decJson = (await decRes.json()) as { decodedText: string; audit: { passed: boolean } };
      assert.ok(decJson.decodedText.includes("/api/v2/checkout"));
      assert.equal(decJson.audit.passed, true);

      // 7. POST /api/audit
      const audRes = await fetch(`${studio.url}/api/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: src, btText: compJson.output }),
      });
      assert.equal(audRes.status, 200);
      const audJson = (await audRes.json()) as { audit: { passed: boolean } };
      assert.equal(audJson.audit.passed, true);

      // 8. POST /api/relay
      const relayRes = await fetch(`${studio.url}/api/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: src,
          profile: "neutral-formal",
          compileEngine: "offline-rule",
          baseUrl: `${mockUrl}/v1`,
          model: "qwen2.5:7b",
          compareRaw: true,
        }),
      });
      assert.equal(relayRes.status, 200);
      const relayJson = (await relayRes.json()) as {
        btRelay: { answer: string };
        savings: { inputBpeSavedO200k: number };
      };
      assert.ok(relayJson.btRelay.answer.includes("200ms"));
      assert.ok(relayJson.savings.inputBpeSavedO200k > 0);
    } finally {
      await new Promise<void>((resolve) => studio.server.close(() => resolve()));
      await new Promise<void>((resolve) => mockLlm.close(() => resolve()));
    }
  });
});

describe("CLI Commands (cli.ts)", () => {
  it("runs compile, decode, and audit commands cleanly with proper exit codes", async () => {
    const logs: string[] = [];
    const codeCompile = await runCli(
      [
        "compile",
        "如果 JWT.alg 设置为 'none' 或者过期时间缺失，则立即返回 HTTP 401，除非访问 /healthz",
        "--profile",
        "bt-skeleton",
        "--offline",
        "--json",
      ],
      { stdout: (s) => logs.push(s) },
    );
    assert.equal(codeCompile, 0);
    const parsedCompile = JSON.parse(logs[0]) as { output: string; audit: { passed: boolean } };
    assert.equal(parsedCompile.audit.passed, true);

    const decLogs: string[] = [];
    const codeDecode = await runCli(
      ["decode", parsedCompile.output, "--lang", "en", "--offline"],
      { stdout: (s) => decLogs.push(s) },
    );
    assert.equal(codeDecode, 0);
    assert.ok(decLogs.join("\n").includes("401"));

    // Passing audit returns exit code 0
    const passLogs: string[] = [];
    const codeAuditPass = await runCli(
      ["audit", "timeout <= 200ms & !directDB", "$timeout<=200ms & !directDB"],
      { stdout: (s) => passLogs.push(s) },
    );
    assert.equal(codeAuditPass, 0);

    // Failing audit (dropped number 200) returns exit code 2
    const failLogs: string[] = [];
    const codeAuditFail = await runCli(
      ["audit", "timeout <= 200ms & !directDB", "$timeout<=999ms & !directDB"],
      { stdout: (s) => failLogs.push(s) },
    );
    assert.equal(codeAuditFail, 2);
  });
});
