#!/usr/bin/env node
import { SHOWCASE_BLUEPRINTS } from './core/demoBlueprints';
import { executeSwarmRun } from './orchestrator/swarmEngine';
import type { BusMode, EngineMode, TargetLanguage } from './types';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function printHelp(): void {
  console.log(`
${ANSI.bold}${ANSI.cyan}⚡ BabelTele Swarm CLI (@babeltele/swarm v1.0.0)${ANSI.reset}
巴别语双平面极速项目推进引擎 — 控制平面巴别语极速流转，产物平面 100% 纯净原生源码

${ANSI.bold}Usage:${ANSI.reset}
  npm run cli -- run "<prompt>" [options]
  npm run cli -- list-demos

${ANSI.bold}Options:${ANSI.reset}
  --lang <java|typescript|python>   Target programming language (default: java)
  --bus <babeltele|verbose-nl>      Inter-agent bus mode (default: babeltele)
  --demo                            Use built-in instant showcase simulator (default if no API key)
  --engine <demo-sim|ollama|openai-compat>
  --fault-drill                     Inject a BabelTele pollution fault on Pass 1 to test Fixer self-healing
  --model <name>                    Model name for Ollama / OpenAI-compatible API
  --base-url <url>                  API Base URL (e.g. https://api.deepseek.com/v1)
  --api-key <key>                   API Key (or set OPENAI_API_KEY env)
  --help, -h                        Show this help message
`);
}

function parseCliArgs(argv: string[]): {
  command: 'run' | 'list-demos' | 'help';
  prompt: string;
  language: TargetLanguage;
  busMode: BusMode;
  engine: EngineMode;
  faultDrill: boolean;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
} {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return {
      command: 'help',
      prompt: '',
      language: 'java',
      busMode: 'babeltele',
      engine: 'demo-sim',
      faultDrill: false,
    };
  }

  if (argv[0] === 'list-demos') {
    return {
      command: 'list-demos',
      prompt: '',
      language: 'java',
      busMode: 'babeltele',
      engine: 'demo-sim',
      faultDrill: false,
    };
  }

  const args = argv[0] === 'run' ? argv.slice(1) : argv.slice();
  const positional: string[] = [];
  let language: TargetLanguage = 'java';
  let busMode: BusMode = 'babeltele';
  let engine: EngineMode | undefined;
  let faultDrill = false;
  let model: string | undefined;
  let baseUrl: string | undefined;
  let apiKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--lang' && args[i + 1]) {
      const val = args[++i].toLowerCase();
      if (val === 'java' || val === 'typescript' || val === 'python') {
        language = val;
      } else if (val === 'ts') {
        language = 'typescript';
      } else if (val === 'py') {
        language = 'python';
      }
    } else if (arg === '--bus' && args[i + 1]) {
      const val = args[++i].toLowerCase();
      if (val === 'babeltele' || val === 'verbose-nl') {
        busMode = val;
      }
    } else if (arg === '--demo') {
      engine = 'demo-sim';
    } else if (arg === '--engine' && args[i + 1]) {
      const val = args[++i] as EngineMode;
      if (val === 'demo-sim' || val === 'ollama' || val === 'openai-compat') {
        engine = val;
      }
    } else if (arg === '--fault-drill') {
      faultDrill = true;
    } else if (arg === '--model' && args[i + 1]) {
      model = args[++i];
    } else if (arg === '--base-url' && args[i + 1]) {
      baseUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      apiKey = args[++i];
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  const resolvedEngine: EngineMode =
    engine ?? (apiKey || process.env.OPENAI_API_KEY ? 'openai-compat' : 'demo-sim');

  return {
    command: 'run',
    prompt: positional.join(' ').trim(),
    language,
    busMode,
    engine: resolvedEngine,
    faultDrill,
    model,
    baseUrl,
    apiKey,
  };
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === 'help') {
    printHelp();
    return;
  }

  if (parsed.command === 'list-demos') {
    console.log(`\n${ANSI.bold}${ANSI.cyan}Built-in Compilable Showcase Blueprints:${ANSI.reset}\n`);
    for (const bp of Object.values(SHOWCASE_BLUEPRINTS)) {
      console.log(`  ${ANSI.bold}[${bp.language}]${ANSI.reset} ${bp.titleZh} (${bp.files.length} files)`);
      console.log(`    Prompt: ${ANSI.dim}${bp.defaultPromptZh}${ANSI.reset}\n`);
    }
    return;
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}╔══════════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}║  ⚡ BabelTele Swarm — Dual-Plane Multi-Agent Accelerator                 ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}╚══════════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log(`  Language : ${ANSI.bold}${parsed.language}${ANSI.reset}`);
  console.log(`  Bus Mode : ${ANSI.bold}${parsed.busMode}${ANSI.reset}`);
  console.log(`  Engine   : ${ANSI.bold}${parsed.engine}${ANSI.reset}${parsed.faultDrill ? ` ${ANSI.yellow}(Fault-Drill Self-Healing Enabled)${ANSI.reset}` : ''}\n`);

  const result = await executeSwarmRun({
    prompt: parsed.prompt,
    language: parsed.language,
    busMode: parsed.busMode,
    injectFaultDrill: parsed.faultDrill,
    computeAbComparison: true,
    simulateStreamingDelay: false,
    llm: {
      engine: parsed.engine,
      apiKey: parsed.apiKey,
      baseUrl: parsed.baseUrl,
      model: parsed.model,
    },
    onEvent: (ev) => {
      if (ev.type === 'control-msg') {
        const m = ev.message;
        const firstLine = m.rawContent.split(/\r?\n/)[0].slice(0, 92);
        console.log(
          `  ${ANSI.magenta}[Plane-1 Control]${ANSI.reset} ${ANSI.bold}${m.agent.padEnd(9)}${ANSI.reset} ` +
            `${ANSI.yellow}(${String(m.tokens).padStart(3)} tok)${ANSI.reset} ${firstLine}${m.rawContent.length > 92 ? '...' : ''}`
        );
      } else if (ev.type === 'artifact-written') {
        const a = ev.artifact;
        const statusTag = a.sanitizer.clean
          ? `${ANSI.green}0 BT-Leak ✓${ANSI.reset}`
          : `${ANSI.red}Polluted (${a.sanitizer.babelTeleLeakageCount} leaks) !${ANSI.reset}`;
        console.log(
          `  ${ANSI.blue}[Plane-2 Artifact]${ANSI.reset} Wrote ${ANSI.bold}${a.filePath}${ANSI.reset} ` +
            `(${a.lines} lines | ${statusTag} | BT-Header: ${a.btHeaderDigest.headerTokens}/${a.rawTokens} tok = -${a.btHeaderDigest.savedPercent}%)`
        );
      }
    },
  });

  console.log(`\n${ANSI.bold}─── Verification & Dual-Plane Telemetry ──────────────────────────────────${ANSI.reset}`);
  console.log(`  Workspace        : ${result.workspacePath}`);
  console.log(`  Toolchain        : ${result.finalVerification.toolchainUsed}`);
  console.log(
    `  Zero-Pollution   : ${
      result.finalVerification.zeroBabelTeleLeakage
        ? `${ANSI.green}VERIFIED (0 BabelTele symbols in ${result.artifacts.length} native files)${ANSI.reset}`
        : `${ANSI.red}FAILED (${result.finalVerification.totalLeakageCount} leaks)${ANSI.reset}`
    }`
  );
  console.log(
    `  Build & Tests    : ${
      result.finalVerification.passed
        ? `${ANSI.green}PASSED ✓${ANSI.reset}`
        : `${ANSI.red}FAILED ✗${ANSI.reset}`
    }${result.telemetry.selfHealingLoops > 0 ? ` (Self-Healed in ${result.telemetry.selfHealingLoops} loop)` : ''}`
  );

  if (result.finalVerification.compilerStdout) {
    for (const line of result.finalVerification.compilerStdout.split(/\r?\n/)) {
      console.log(`    ${ANSI.dim}${line}${ANSI.reset}`);
    }
  }

  if (result.abComparison) {
    const ab = result.abComparison;
    console.log(`\n${ANSI.bold}─── BabelTele vs Verbose NL Benchmark (o200k_base) ───────────────────────${ANSI.reset}`);
    console.log(
      `  Control Chatter  : ${ANSI.green}${ab.babeltele.controlPlaneTokens} tok${ANSI.reset} vs ${ab.verboseNl.controlPlaneTokens} tok  (${ANSI.bold}-${ab.controlTokenReductionPercent}%${ANSI.reset})`
    );
    console.log(
      `  Cross-File Mem   : ${ANSI.green}${ab.babeltele.memoryContextTokensUsed} tok${ANSI.reset} vs ${ab.verboseNl.memoryContextTokensUsed} tok  (${ANSI.bold}-${ab.babeltele.memoryTokensSavedPercent}%${ANSI.reset})`
    );
    console.log(
      `  Total Bus+Memory : ${ANSI.green}${ab.babeltele.totalBusAndMemoryTokens} tok${ANSI.reset} vs ${ab.verboseNl.totalBusAndMemoryTokens} tok  (${ANSI.bold}-${ab.totalBusAndMemoryReductionPercent}% | ${ab.speedupMultiplier}x Throughput${ANSI.reset})`
    );
    console.log(
      `  Native Artifacts : ${ANSI.cyan}${result.telemetry.artifactTokens} tok${ANSI.reset} across ${result.artifacts.length} files (100% Pure Lossless Native Code)\n`
    );
  }

  if (!result.finalVerification.passed) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(`${ANSI.red}[CLI Error]${ANSI.reset}`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
