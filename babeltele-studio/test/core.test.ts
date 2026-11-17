import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import {
  auditBabelTele,
  compileOfflineRule,
  compileToBabelTele,
  compareTokenMetrics,
  countDualTokens,
  countTokens,
  decodeFromBabelTele,
  dehydrateText,
  enforceAnchorLock,
  extractHardAnchors,
  PRESET_EXAMPLES,
  probeOllama,
  probeSymbolEfficiency,
  relayCompare,
  type CompilerProfileId,
} from "../dist/index.js";

describe("BPE Token Accountant (tokenizer.ts)", () => {
  it("computes real o200k_base and cl100k_base subword BPE counts", () => {
    const snap = countDualTokens("During photosynthesis, plants take in carbon dioxide and water.");
    assert.ok(snap.chars > 40);
    assert.ok(snap.o200k_base >= 10 && snap.o200k_base <= 16);
    assert.ok(snap.cl100k_base >= 10 && snap.cl100k_base <= 16);
    assert.equal(countTokens(""), 0);
  });

  it("detects the Naive Symbol Illusion (ΔL_BPE >= 0 despite shorter visual length)", () => {
    const report = compareTokenMetrics("water", "💧");
    assert.equal(report.sourceChars, 5);
    assert.equal(report.compiledChars, 1);
    assert.ok(report.o200k_base.deltaTokens >= 0, "Emoji should not reduce BPE tokens vs 'water'");
    assert.equal(report.naiveSymbolIllusion, true);
    assert.equal(report.visualIllusionTrap, true);

    const probe = probeSymbolEfficiency(" and", "∧");
    assert.equal(probe.recommended, " and");
  });

  it("confirms net BPE savings (ΔL_BPE < 0) on canonical BabelTele clause collapse", () => {
    const src =
      "If the JWT header algorithm is set to 'none' or the expiration timestamp is missing, immediately reject the request with HTTP 401 except on public healthcheck endpoints.";
    const bt = "?JWT.alg=='none' | !JWT.exp => reject(401) !exc:/healthz";
    const report = compareTokenMetrics(src, bt);
    assert.equal(report.netBenefitAchieved, true);
    assert.ok(report.o200k_base.deltaTokens < -10);
    assert.ok(report.cl100k_base.deltaTokens < -10);
    assert.equal(report.naiveSymbolIllusion, false);
  });
});

describe("Tier-1 Deterministic Hard-Anchor Auditor (auditor.ts)", () => {
  it("extracts exact numbers, versions, URLs/IPs/paths, code identifiers, and placeholders", () => {
    const src =
      "Policy v2.4.1 on https://api.deepseek.com/v1 and 127.0.0.1:11434 (/api/v2/checkout): call inventoryService & OrderCreateService with order_idempotency_log, P99 <= 200ms (99.5% SLA, lr=3e-4, <2^159), POST /healthz, keep BIBREF_01 and TABREF_04.";
    const anchors = extractHardAnchors(src).map((a) => a.value);

    for (const expected of [
      "BIBREF_01",
      "TABREF_04",
      "https://api.deepseek.com/v1",
      "127.0.0.1:11434",
      "v2.4.1",
      "/api/v2/checkout",
      "/healthz",
      "POST",
      "inventoryService",
      "OrderCreateService",
      "order_idempotency_log",
      "P99",
      "99.5%",
      "3e-4",
      "2^159",
      "200",
    ]) {
      assert.ok(anchors.includes(expected), `Expected anchor "${expected}" to be extracted`);
    }
  });

  it("enforces digit boundaries so 80 does not falsely match 800, and enforces negation preservation", () => {
    const src = "严禁延迟超过 80ms，除非降级模式";
    const driftedBt = "#Spec latency<=800ms";
    const failedAudit = auditBabelTele(src, driftedBt);
    assert.equal(failedAudit.passed, false);
    assert.ok(failedAudit.missingAnchors.includes("80"));
    assert.equal(failedAudit.negationPreserved, false);

    const lockedBt = enforceAnchorLock(driftedBt, failedAudit);
    assert.ok(lockedBt.includes("![Lock:"));
    const reAudit = auditBabelTele(src, lockedBt);
    assert.equal(reAudit.passed, true);
  });

  it("ignores polite rhetorical '能不能' / '不好意思' when checking semantic negation", () => {
    const politePositive = "你好请问能不能麻烦帮我看看这个订单查询接口，不好意思打扰一下，超时阈值是 500ms";
    const bt = "#OrderQuery $timeout:500ms => inspect";
    const audit = auditBabelTele(politePositive, bt);
    assert.equal(audit.sourceHasNegation, false);
    assert.equal(audit.negationPreserved, true);
    assert.equal(audit.passed, true);
  });
});

describe("Stage-1 Rule Dehydrator & Offline Compiler (ruleEngine.ts)", () => {
  it("strips emotional venting and polite conversational noise while preserving hard facts", () => {
    const noisy =
      "你好请问能不能麻烦帮我看看！我真是服了这个破系统总是超时，我都快崩溃了！接口 /api/v1/pay 延迟超过 1500ms，万分感谢！";
    const res = dehydrateText(noisy);
    assert.ok(res.strippedNoiseCount >= 3);
    assert.ok(!res.cleanedText.includes("崩溃"));
    assert.ok(!res.cleanedText.includes("万分感谢"));
    assert.ok(res.cleanedText.includes("/api/v1/pay"));
    assert.ok(res.cleanedText.includes("1500"));
  });

  it("compiles all 4 built-in presets across all 5 BT-Spec v1.0 profiles with ΔL_BPE < 0 & 100% audit pass", () => {
    const profiles: CompilerProfileId[] = [
      "neutral-formal",
      "bt-core",
      "bt-memory",
      "bt-skeleton",
      "bt-zero",
    ];

    for (const preset of PRESET_EXAMPLES) {
      for (const profile of profiles) {
        const compiled = compileOfflineRule(preset.sourceText, profile);
        const metrics = compareTokenMetrics(preset.sourceText, compiled.btOutput);
        const audit = auditBabelTele(preset.sourceText, compiled.btOutput);

        assert.equal(
          audit.passed,
          true,
          `Preset "${preset.id}" [${profile}] failed Tier-1 audit: missing=${audit.missingAnchors.join(",")}`,
        );
        assert.ok(
          metrics.o200k_base.deltaTokens < 0,
          `Preset "${preset.id}" [${profile}] did not achieve ΔL_BPE < 0 (got ${metrics.o200k_base.deltaTokens})`,
        );
      }
    }
  });
});

describe("3-Stage Hybrid Compiler, Circuit Breaker, Decoder & Relay (compiler.ts)", () => {
  it("triggers Auto-Fallback Circuit Breaker on tiny already-dense inputs to prevent token inflation", async () => {
    const res = await compileToBabelTele("x=42", { offline: true });
    assert.ok(res.tokenMetrics.o200k_base.compiledTokens <= res.tokenMetrics.o200k_base.sourceTokens);
    assert.equal(res.audit.passed, true);
  });

  it("supports mock OpenAI/Ollama Stage-2 LLM, strips <think>, auto-locks dropped anchors, decodes & relays", async () => {
    const mockServer = http.createServer(async (req, res) => {
      if (req.url === "/api/tags" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            models: [
              { name: "nomic-embed-text:latest", size: 274000000 },
              { name: "qwen2.5:3b", size: 1900000000, details: { parameter_size: "3B" } },
            ],
          }),
        );
        return;
      }

      if (req.url === "/v1/chat/completions" && req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };
        const sys = body.messages[0]?.content || "";
        const usr = body.messages[body.messages.length - 1]?.content || "";

        let reply = "";
        if (sys.includes("BT-Decoder") || sys.includes("无损旁路解码器")) {
          reply = `【已还原】当接口 /api/v2/orders 并发超过 3000 时，禁止直连主库 directDB，必须走 Redis 缓存（超时 150ms）。`;
        } else if (sys.includes("提纯") || sys.includes("压缩")) {
          reply = `<think>Analyzing propositions...</think>\n#OrderAPI /api/v2/orders ?qps>3000 => Redis & !directDB`;
        } else {
          reply = `工程方案：针对载荷 [${usr.slice(0, 28)}...]，采用 Redis Pipeline 批量校验 + 本地二级缓存。`;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            model: body.model,
            choices: [{ message: { role: "assistant", content: reply } }],
            usage: {
              prompt_tokens: Math.max(8, Math.ceil(usr.length / 3)),
              completion_tokens: 24,
              total_tokens: Math.max(8, Math.ceil(usr.length / 3)) + 24,
            },
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", () => resolve()));
    const addr = mockServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    const mockRoot = `http://127.0.0.1:${port}`;

    try {
      const ollamaInfo = await probeOllama(mockRoot);
      assert.equal(ollamaInfo.available, true);
      assert.equal(ollamaInfo.recommendedModel, "qwen2.5:3b");

      const verboseSrc =
        "你好麻烦帮我看看！我真是服了这个破系统总是卡死：当订单接口 /api/v2/orders 每秒并发请求超过 3000 的时候，绝对禁止直接查主库，必须走缓存且超时控制在 150ms 以内，万分感谢！";
      const compiled = await compileToBabelTele(verboseSrc, {
        engine: "ollama",
        llmConfig: { baseUrl: `${mockRoot}/v1` },
      });

      assert.equal(compiled.engineUsed, "ollama");
      assert.equal(compiled.modelUsed, "qwen2.5:3b");
      assert.ok(!compiled.output.includes("<think>"));
      assert.equal(compiled.anchorLockApplied, true);
      assert.ok(compiled.output.includes("150"));
      assert.equal(compiled.audit.passed, true);
      assert.ok(compiled.tokenMetrics.o200k_base.deltaTokens < 0);

      const decoded = await decodeFromBabelTele(compiled.output, "zh", {
        engine: "openai-api",
        baseUrl: `${mockRoot}/v1`,
        model: "qwen2.5:3b",
      });
      assert.equal(decoded.engineUsed, "openai-api");
      assert.ok(decoded.decodedText.includes("/api/v2/orders"));
      assert.equal(decoded.audit.passed, true);

      const relayRes = await relayCompare(
        verboseSrc,
        { engine: "offline-rule", profile: "neutral-formal" },
        {
          baseUrl: `${mockRoot}/v1`,
          model: "qwen2.5:3b",
          compareRaw: true,
        },
      );
      assert.ok(relayRes.btRelay.answer.includes("工程方案"));
      assert.ok(relayRes.savings.inputBpeSavedO200k > 15);
      assert.ok(relayRes.rawBaseline !== undefined);
    } finally {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });
});
