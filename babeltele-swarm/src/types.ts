export type TargetLanguage = 'java' | 'typescript' | 'python';

export type BusMode = 'babeltele' | 'verbose-nl';

export type RunModeSelection = 'babeltele' | 'verbose-nl' | 'ab-race';

export type EngineMode = 'demo-sim' | 'ollama' | 'openai-compat';

export type AgentRole = 'PM-Spec' | 'Architect' | 'Coder' | 'Verifier' | 'Fixer';

export type PipelineStage =
  | 'prd'
  | 'arch'
  | 'draft'
  | 'memory-sync'
  | 'verify'
  | 'diag'
  | 'fix';

export interface LlmConfig {
  engine: EngineMode;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface ControlPlaneMessage {
  id: string;
  timestamp: string;
  agent: AgentRole;
  busMode: BusMode;
  stage: PipelineStage;
  targetFile?: string;
  rawContent: string;
  humanZh: string;
  tokens: number;
  baselineVerboseTokens?: number;
  latencyMs: number;
}

export interface ArchitectFileContract {
  filePath: string;
  role: string;
  moduleOrPackage: string;
  expectedSymbols: string[];
  btContract: string;
  dependencies: string[];
}

export interface ArchitectManifest {
  projectName: string;
  language: TargetLanguage;
  btArchSpec: string;
  verboseArchSpec: string;
  humanSummaryZh: string;
  files: ArchitectFileContract[];
}

export interface SanitizerViolation {
  line: number;
  column: number;
  rule:
    | 'BT_FRAME_SIGIL'
    | 'BT_CONTROL_TAG'
    | 'BT_SYMBOL_OPERATOR'
    | 'MARKDOWN_FENCE_LEAK'
    | 'PROSE_CHATTER_LEAK'
    | 'UNBALANCED_BRACES'
    | 'INVALID_HEADER';
  snippet: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SanitizerReport {
  filePath: string;
  language: TargetLanguage | 'other';
  clean: boolean;
  babelTeleLeakageCount: number;
  braceBalanceOk: boolean;
  headerValid: boolean;
  violations: SanitizerViolation[];
  sanitizedContent: string;
}

export interface SymbolTypeInfo {
  kind: 'class' | 'interface' | 'enum' | 'record' | 'type' | 'dataclass';
  name: string;
  extendsOrImplements: string[];
  fields: string[];
  methods: string[];
}

export interface FileSymbolDigest {
  filePath: string;
  language: TargetLanguage | 'other';
  moduleOrPackage: string;
  imports: string[];
  types: SymbolTypeInfo[];
  functions: string[];
  thrownExceptions: string[];
  btHeader: string;
  humanSummaryZh: string;
  rawTokens: number;
  headerTokens: number;
  compressionRatio: number;
  savedPercent: number;
}

export interface FileVerificationResult {
  filePath: string;
  sanitizerClean: boolean;
  babelTeleLeakageCount: number;
  contractMatched: boolean;
  missingSymbols: string[];
  syntaxValid: boolean;
  issues: string[];
}

export interface ProjectVerificationReport {
  passed: boolean;
  iteration: number;
  toolchainUsed: string;
  toolchainExecuted: boolean;
  runtimeTestsExecuted: boolean;
  zeroBabelTeleLeakage: boolean;
  totalLeakageCount: number;
  filesChecked: number;
  fileResults: FileVerificationResult[];
  compilerStdout: string;
  compilerStderr: string;
  btDiag: string;
  verboseDiag: string;
  humanSummaryZh: string;
}

export interface GeneratedArtifact {
  filePath: string;
  absolutePath: string;
  language: TargetLanguage | 'other';
  content: string;
  lines: number;
  bytes: number;
  rawTokens: number;
  sanitizer: SanitizerReport;
  btHeaderDigest: FileSymbolDigest;
  healedIterations: number;
}

export interface StageTokenBreakdown {
  stage: string;
  stageLabelZh: string;
  btTokens: number;
  nlTokens: number;
  savedPercent: number;
}

export interface SwarmTelemetry {
  busMode: BusMode;
  controlPlaneTokens: number;
  memoryContextTokensUsed: number;
  rawMemoryContextWouldBe: number;
  memoryTokensSavedPercent: number;
  totalBusAndMemoryTokens: number;
  artifactTokens: number;
  artifactFilesCount: number;
  durationMs: number;
  selfHealingLoops: number;
  zeroPollutionVerified: boolean;
}

export interface ABComparisonReport {
  babeltele: SwarmTelemetry;
  verboseNl: SwarmTelemetry;
  controlTokenReductionPercent: number;
  totalBusAndMemoryReductionPercent: number;
  speedupMultiplier: number;
  stageBreakdown: StageTokenBreakdown[];
}

export interface SwarmRunOptions {
  runId?: string;
  prompt: string;
  language: TargetLanguage;
  busMode: BusMode;
  computeAbComparison?: boolean;
  injectFaultDrill?: boolean;
  simulateStreamingDelay?: boolean;
  workspaceRootDir?: string;
  llm?: LlmConfig;
  onEvent?: (event: SwarmStreamEvent) => void;
}

export type SwarmStreamEvent =
  | {
      type: 'run-start';
      runId: string;
      prompt: string;
      language: TargetLanguage;
      busMode: BusMode;
      engine: EngineMode;
      workspacePath: string;
      timestamp: string;
    }
  | {
      type: 'agent-status';
      runId: string;
      agent: AgentRole;
      status: 'working' | 'done' | 'healing';
      detail: string;
    }
  | {
      type: 'control-msg';
      runId: string;
      message: ControlPlaneMessage;
    }
  | {
      type: 'manifest-ready';
      runId: string;
      manifest: ArchitectManifest;
    }
  | {
      type: 'artifact-written';
      runId: string;
      artifact: GeneratedArtifact;
      smftPoolSnapshot: string;
    }
  | {
      type: 'verification-report';
      runId: string;
      report: ProjectVerificationReport;
    }
  | {
      type: 'ab-progress';
      runId: string;
      btTokensSoFar: number;
      nlTokensSoFar: number;
      btProgressPct: number;
      nlProgressPct: number;
    }
  | {
      type: 'run-complete';
      runId: string;
      result: SwarmRunResult;
    }
  | {
      type: 'run-error';
      runId: string;
      error: string;
    };

export interface SwarmRunResult {
  runId: string;
  createdAt: string;
  prompt: string;
  language: TargetLanguage;
  busMode: BusMode;
  engine: EngineMode;
  workspacePath: string;
  prdSpec: string;
  manifest: ArchitectManifest;
  messages: ControlPlaneMessage[];
  artifacts: GeneratedArtifact[];
  smftMemoryPool: FileSymbolDigest[];
  smftFormattedPool: string;
  verificationHistory: ProjectVerificationReport[];
  finalVerification: ProjectVerificationReport;
  telemetry: SwarmTelemetry;
  abComparison?: ABComparisonReport;
}
