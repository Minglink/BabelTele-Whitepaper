/**
 * Default one-shot summarization and durable checkpoint framing.
 *
 * @module @deepseek-ai/dsh-compaction-basic/summarizer
 */

import type { Context } from '@deepseek-ai/cordis'
import { contentHasImage, BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm'
import { deepFreeze } from '@deepseek-ai/dsh-util-values'
import type {
  ContentBlock, FinishReason, GenerateOptions, Message, RequestMessage, TokenUsage, ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'

interface SummaryConfig {
  readonly summarizationProvider: string
  readonly summarizationModel: string
  readonly maxTokens: number
}

/** Exact provider/model pair that receives one summarization request. */
export type SummaryRoute = Pick<GenerateOptions, 'provider' | 'model'>

/** Tags wrapping the structured summary inside the landed checkpoint node. */
const SUMMARY_OPEN_TAG = '<compacted-summary>'
const SUMMARY_CLOSE_TAG = '</compacted-summary>'

/**
 * The summarization directive, delivered as the FINAL user message after the
 * replayed conversation rather than as a distinct summarizer system prompt.
 * Keeping the conversation's own system prompt, tools, and message prefix in
 * front of it makes the auxiliary call a genuine prefix of the last routed
 * request, so the provider's KV cache is reused instead of invalidated.
 */
const COMPACTION_INSTRUCTION = [
  'You are now acting as the BabelTele SMFT (Semantic Merkle Fault-Tolerant) Compaction Engine (`BT-Spec v1.0`) for this coding agent. Condense the conversation ABOVE into a high-density, zero-loss `[SMFT-T1]` checkpoint so work resumes immediately at maximum token efficiency.',
  '',
  'Output EXACTLY the `[SMFT-T1]` structure below: keep every `#Section` header in order. Use compact 1-token ASCII BT-L2 operators (`->`, `=>`, `?`, `&`, `!ban:`, `!exc:`, `@path(L=n)`) and terse bullets — NEVER prose paragraphs. Write `(none)` for an empty section.',
  '',
  '[SMFT-T1]',
  '#Intent',
  '- [user core goals & evolving directives; preserve exact constraints and negations (`!ban:...`)]',
  '',
  '#Stack',
  '- [languages, frameworks, architecture invariants, runtime ports/endpoints]',
  '',
  '#Files',
  '- [@exact/path(status) -> key symbols, mutations, or line anchors]',
  '',
  '#DiagFix',
  '- [error/symptom -> root_cause => verified_fix; include user corrections]',
  '',
  '#Pending',
  '- [explicitly requested tasks still incomplete]',
  '',
  '#Current',
  '- [exact state at checkpoint boundary]',
  '',
  '#Next',
  '- [single immediate next engineering action, or `(none)`]',
  '',
  '#Anchors',
  '- [hard literal anchors that MUST NOT be lost: file paths, commands, ports, version numbers, API names, user preferences]',
  '',
  'Rules:',
  '- Use compact ASCII BT-L2 notation (`->`, `=>`, `&`, `!ban:`). Do NOT use multi-token rare Unicode math glyphs.',
  '- Preserve 100% of exact file paths, commands, error codes, identifiers, numeric constants, and function signatures.',
  '- Capture user feedback and explicit corrections faithfully.',
  '- Do NOT mention this compaction request and do NOT call any tools.',
  `- If the conversation already contains a ${SUMMARY_OPEN_TAG} block, treat it as a PRIOR [SMFT-T1] checkpoint: merge still-valid facts with newer state, prune superseded facts, and emit one consolidated [SMFT-T1] checkpoint.`,
].join('\n')

/** Framing that makes the replacement user message established context. */
const CHECKPOINT_PREAMBLE =
  'This is an automatically generated BabelTele [SMFT-T1] semantic checkpoint condensing an earlier span of the conversation. Treat all hard anchors, file states, and constraints inside it as established ground truth without restating them. Continue executing the task directly from the messages that follow.'

/**
 * The replayed conversation surface the summarizer condenses. Reproducing the
 * last routed request's system prompt, tools, and leading messages verbatim
 * lets the auxiliary call reuse the provider's warm prefix cache; the trailing
 * compaction instruction is then the only novel input.
 */
export interface SummarizationInput {
  /** The conversation's tool schemas, reused for prefix-cache alignment; absent when the request carried none. */
  readonly tools?: readonly ToolSchema[]
  /** The derived system head, when present, followed by the shadowed region in surface order. */
  readonly messages: readonly Message[]
}

/** Safe summary content plus the exact auxiliary call envelope recorded with it. */
export type SummaryResult = {
  summary: ContentBlock[]
  provider: string
  model: string
  maxTokens?: number
  /** Provider-reported usage for this summarization request. */
  usage?: TokenUsage
} & (
  | {
    /** Complete provider output before the text-only summary projection. */
    rawOutput: ContentBlock[]
    /** Identifies exactly one call through this context's `ctx.llm.stream()`. */
    llmStreamCall: true
  }
  | {
    /** Optional complete output from an unmarked template, remote, or other summarizer. */
    rawOutput?: ContentBlock[]
    /** An unmarked result does not identify a call through this context's LLM seam. */
    llmStreamCall?: never
  }
)

/**
 * Run the default cache-reusing `ctx.llm.stream()` summarization call: replay
 * the conversation prefix, then append the compaction instruction as the final
 * user message so the provider's warm prefix cache is reused.
 * @param ctx - context providing the LLM service.
 * @param config - resolved backend configuration.
 * @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
 * @param agent - supplies tool history and session id.
 * @param conversation - route used when `config` names no summary target; `undefined` when the conversation has none.
 * @param signal - optional cancellation forwarded to the adapter.
 * @returns safe text-only summary blocks and the exact call envelope and output.
 */
export async function summarizeWithLlm(
  ctx: Context,
  config: SummaryConfig,
  input: SummarizationInput,
  agent: Agent,
  conversation: SummaryRoute | undefined,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const configured = config.summarizationProvider.length === 0
    ? undefined
    : { provider: config.summarizationProvider, model: config.summarizationModel }
  const target = configured ?? conversation
  if (target === undefined) {
    throw new Error(
      'no provider/model available for summarization: set both BasicCompactionConfig summarization fields, route one request, or set both AgentOptions fields',
    )
  }

  const assembler = new BlockAssembler()
  const messages: RequestMessage[] = [
    ...input.messages,
    deepFreeze({
      role: 'user',
      content: [{ type: 'text', text: COMPACTION_INSTRUCTION }],
    }),
  ]
  const options: GenerateOptions = {
    provider: target.provider,
    model: target.model,
    messages,
    toolHistory: agent.session.toolHistory(),
    ...input.tools === undefined ? {} : { tools: [...input.tools] },
    maxTokens: config.maxTokens,
    sessionId: agent.session.id,
    purpose: 'compaction',
    ...signal === undefined ? {} : { signal },
  }
  for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk)
  const error = finishError(assembler.finish)
  if (error !== undefined) throw error

  const rawOutput = assembler.blocks()
  const summary = summaryText(rawOutput)
  if (!summary.some(block => block.text.trim().length > 0)) {
    throw new Error('summarization produced no text summary content')
  }
  return {
    summary,
    rawOutput,
    llmStreamCall: true,
    provider: options.provider,
    model: options.model,
    maxTokens: config.maxTokens,
    ...(assembler.usage === undefined ? {} : { usage: assembler.usage }),
  }
}

/**
 * Wrap raw summary blocks in the durable checkpoint framing.
 * @param summary - safe text-only model output.
 * @returns content for the synthesized replacement user message.
 */
export function frameSummary(summary: readonly ContentBlock[]): ContentBlock[] {
  return [
    { type: 'text', text: `${CHECKPOINT_PREAMBLE}\n\n${SUMMARY_OPEN_TAG}` },
    ...summary,
    { type: 'text', text: SUMMARY_CLOSE_TAG },
  ]
}

/** Map a terminal summarization finish to its fail-closed error. */
function finishError(finish: FinishReason): Error | undefined {
  switch (finish.kind) {
    case 'error':
    case 'aborted': {
      return LlmError.fromFailure(finish.failure)
    }
    case 'max-tokens': {
      const error = new Error('summarization truncated at the token cap (incomplete checkpoint)') as Error & { code?: string }
      error.code = 'MAX_TOKENS'
      return error
    }
    default:
      return undefined
  }
}

/** Reject visual output and keep only text before synthesizing a user message. */
function summaryText(
  blocks: readonly ContentBlock[],
): Array<Extract<ContentBlock, { type: 'text' }>> {
  if (contentHasImage(blocks)) {
    throw new LlmError('compaction summary cannot contain image output', 'UNSUPPORTED_CONTENT')
  }
  return blocks.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
}
