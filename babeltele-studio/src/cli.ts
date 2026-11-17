#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnv } from "./env.js";
import { auditBabelTele } from "./core/auditor.js";
import {
  compileToBabelTele,
  decodeFromBabelTele,
  type EngineMode,
} from "./core/compiler.js";
import { COMPILER_PROFILES, type CompilerProfileId } from "./core/prompts.js";
import { compareTokenMetrics } from "./core/tokenizer.js";
import { startStudioServer } from "./server.js";

loadDotEnv();

function readTextOrFile(arg: string): string {
  const candidate = path.resolve(process.cwd(), arg);
  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate, "utf8");
    }
  } catch {
    // Treat as inline literal string
  }
  return arg;
}

interface ParsedFlags {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedFlags {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const eqIdx = token.indexOf("=");
      if (eqIdx > 2) {
        const key = token.slice(2, eqIdx);
        flags[key] = token.slice(eqIdx + 1);
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (token === "-h") {
      flags["help"] = true;
    } else if (token === "-v") {
      flags["version"] = true;
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function printHelp(write: (s: string) => void = console.log): void {
  write(`BabelTele Studio CLI v1.0.0 (BT-Spec v1.0)
Usage:
  babeltele <command> [arguments] [options]

Commands:
  compile <text-or-file>               Compile natural language into BabelTele
    --profile <id>                     neutral-formal (default) | bt-core | bt-memory | bt-skeleton | bt-zero
    --offline                          Use <2ms deterministic Stage-1 rule engine (no network)
    --engine <mode>                    auto | offline-rule | ollama | openai-api
    --base-url <url>                   OpenAI-compatible API Base URL
    --api-key <key>                    API Key
    --model <name>                     Model name (e.g. deepseek-chat, qwen2.5:3b)
    --raw                              Print only the compiled BabelTele string to stdout
    --json                             Print full JSON report

  decode <bt-text-or-file>             Losslessly restore BabelTele into natural language
    --lang <zh|en>                     Target language (default: zh)
    --offline                          Use deterministic offline structural decoder
    --base-url <url>                   OpenAI-compatible API Base URL
    --api-key <key>                    API Key
    --model <name>                     Model name
    --json                             Print full JSON report

  audit <source-or-file> <bt-or-file>  Run Tier-1 deterministic hard-anchor & BPE audit
    --json                             Print full JSON audit report

  serve                                Start Interactive BabelTele Web Studio
    --port <number>                    HTTP listen port (default: 3721 or PORT env)
`);
}

export async function runCli(
  argv: string[],
  io: { stdout?: (msg: string) => void; stderr?: (msg: string) => void } = {},
): Promise<number> {
  const out = io.stdout ?? ((s: string) => console.log(s));
  const errOut = io.stderr ?? ((s: string) => console.error(s));

  const { positional, flags } = parseArgs(argv);

  if (flags.version) {
    out("1.0.0");
    return 0;
  }

  const command = positional[0];
  if (!command || flags.help) {
    printHelp(out);
    return 0;
  }

  if (command === "compile") {
    const target = positional[1];
    if (!target) {
      errOut("Error: Missing <text-or-file> argument for `compile`.");
      return 1;
    }
    const sourceText = readTextOrFile(target);
    const profileFlag = (typeof flags.profile === "string" ? flags.profile : "neutral-formal") as CompilerProfileId;
    if (!COMPILER_PROFILES[profileFlag]) {
      errOut(
        `Error: Invalid --profile "${profileFlag}". Choose one of: ${Object.keys(COMPILER_PROFILES).join(", ")}`,
      );
      return 1;
    }

    const engineFlag = (typeof flags.engine === "string" ? flags.engine : undefined) as EngineMode | undefined;
    const result = await compileToBabelTele(sourceText, {
      profile: profileFlag,
      offline: Boolean(flags.offline),
      engine: engineFlag,
      llmConfig: {
        baseUrl: typeof flags["base-url"] === "string" ? flags["base-url"] : undefined,
        apiKey: typeof flags["api-key"] === "string" ? flags["api-key"] : undefined,
        model: typeof flags.model === "string" ? flags.model : undefined,
      },
    });

    if (flags.json) {
      out(JSON.stringify(result, null, 2));
      return 0;
    }
    if (flags.raw) {
      out(result.output);
      return 0;
    }

    const o2 = result.tokenMetrics.o200k_base;
    const cl = result.tokenMetrics.cl100k_base;
    out(`=== BabelTele Studio · Compile Report (${result.profile}) ===`);
    out(`Engine      : ${result.engineUsed}${result.modelUsed ? ` (${result.modelUsed})` : ""} [${result.latencyMs}ms]`);
    out(`o200k_base  : ${o2.sourceTokens} -> ${o2.compiledTokens} tokens (Δ=${o2.deltaTokens}, -${o2.compressionRatioPct}% | retain ${o2.retentionPct}%)`);
    out(`cl100k_base : ${cl.sourceTokens} -> ${cl.compiledTokens} tokens (Δ=${cl.deltaTokens}, -${cl.compressionRatioPct}% | retain ${cl.retentionPct}%)`);
    out(
      `Tier-1 Audit: ${result.audit.passed ? "PASSED" : "FAILED"} (${result.audit.matchedAnchors.length}/${result.audit.totalAnchors} anchors, negation=${result.audit.negationPreserved ? "OK" : "MISSING"})`,
    );
    if (result.circuitBreakerTriggered) {
      out(`CircuitBreak: ${result.circuitBreakerReason}`);
    }
    out(`\n--- Compiled BabelTele ---\n${result.output}`);
    return 0;
  }

  if (command === "decode") {
    const target = positional[1];
    if (!target) {
      errOut("Error: Missing <bt-text-or-file> argument for `decode`.");
      return 1;
    }
    const btText = readTextOrFile(target);
    const lang = flags.lang === "en" ? "en" : "zh";
    const engineFlag = (typeof flags.engine === "string" ? flags.engine : undefined) as EngineMode | undefined;

    const result = await decodeFromBabelTele(btText, lang, {
      offline: Boolean(flags.offline),
      engine: engineFlag,
      baseUrl: typeof flags["base-url"] === "string" ? flags["base-url"] : undefined,
      apiKey: typeof flags["api-key"] === "string" ? flags["api-key"] : undefined,
      model: typeof flags.model === "string" ? flags.model : undefined,
    });

    if (flags.json) {
      out(JSON.stringify(result, null, 2));
      return 0;
    }

    out(`=== BT-Decoder (${result.targetLang.toUpperCase()} · ${result.engineUsed} · ${result.latencyMs}ms) ===`);
    out(result.decodedText);
    return 0;
  }

  if (command === "audit") {
    const srcArg = positional[1];
    const btArg = positional[2];
    if (!srcArg || !btArg) {
      errOut("Error: Usage: babeltele audit <source-text-or-file> <bt-text-or-file>");
      return 1;
    }
    const sourceText = readTextOrFile(srcArg);
    const btText = readTextOrFile(btArg);
    const audit = auditBabelTele(sourceText, btText);
    const tokenMetrics = compareTokenMetrics(sourceText, btText);

    if (flags.json) {
      out(JSON.stringify({ audit, tokenMetrics }, null, 2));
      return audit.passed ? 0 : 2;
    }

    const o2 = tokenMetrics.o200k_base;
    out(`=== Tier-1 Deterministic Hard-Anchor & BPE Audit ===`);
    out(`Status          : ${audit.passed ? "PASSED ✓" : "FAILED ✗"} (${audit.auditDurationMs}ms)`);
    out(`Hard Anchors    : ${audit.matchedAnchors.length}/${audit.totalAnchors} preserved`);
    if (audit.matchedAnchors.length > 0) {
      out(`Matched         : ${audit.matchedAnchors.join(", ")}`);
    }
    if (audit.missingAnchors.length > 0) {
      out(`Missing (!)     : ${audit.missingAnchors.join(", ")}`);
    }
    out(
      `Negation Check  : ${audit.negationPreserved ? "PASSED" : "FAILED"}${audit.sourceHasNegation ? ` (triggers: ${audit.sourceNegations.join(", ")})` : " (none in source)"}`,
    );
    out(
      `BPE (o200k_base): ${o2.sourceTokens} -> ${o2.compiledTokens} tokens (Δ=${o2.deltaTokens}, -${o2.compressionRatioPct}%)${tokenMetrics.naiveSymbolIllusion ? " [WARNING: Naive Symbol Illusion ΔL_BPE>=0]" : ""}`,
    );
    return audit.passed ? 0 : 2;
  }

  if (command === "serve") {
    const port =
      typeof flags.port === "string"
        ? Number(flags.port)
        : Number(process.env.PORT || 3721);
    const { url } = await startStudioServer(port, "0.0.0.0");
    out(`🗼 BabelTele Studio Web Server listening on ${url}`);
    return 0;
  }

  errOut(`Unknown command: "${command}". Run with --help for usage.`);
  return 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && invokedPath === selfPath) {
  runCli(process.argv.slice(2))
    .then((code) => {
      if (process.argv[2] !== "serve") {
        process.exit(code);
      }
    })
    .catch((err) => {
      console.error("CLI Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
