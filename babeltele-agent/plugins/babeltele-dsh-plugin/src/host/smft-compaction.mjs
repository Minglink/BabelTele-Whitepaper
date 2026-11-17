/**
 * BabelTele SMFT (Semantic Merkle Folding Tree) Compaction Engine for DeepSeek Harness.
 * Subclasses `@deepseek-ai/dsh-compaction-basic` (`BasicCompactionEngine`) to condense
 * long-horizon coding sessions into ultra-dense `[SMFT-T1]` BabelTele checkpoints (~65% fewer tokens)
 * while reusing the provider's warm KV prefix cache.
 */
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { BlockAssembler, LlmError } from '@deepseek-ai/dsh-llm'
import { btState } from './state.mjs'

const SMFT_COMPACTION_INSTRUCTION = [
  'Role: BT-Spec v1.0 Semantic Merkle Folding Tree (SMFT) Compaction Engine.',
  'Condense the conversation ABOVE into an ultra-compact `[SMFT-T1]` BabelTele checkpoint so the coding agent can resume zero-shot with 0% loss of engineering anchors.',
  '',
  'Output EXACTLY this structure using 1-token ASCII operators (`->`, `=>`, `&`, `|`, `!`, `@`):',
  '[SMFT-T1]',
  '#Intent <user goals & constraints in BT-L2; preserve exact wording where critical>',
  '#Stack <languages, frameworks, architecture invariants>',
  '#Files <@exact/path(L=line): changes_made -> status>',
  '#DiagFix <error_code/symptom => root_cause -> verified_fix | (none)>',
  '#Pending <remaining tasks | (none)>',
  '#Next <single immediate next step>',
  '',
  'Rules:',
  '- Preserve 100% of exact file paths, CLI commands, error strings, identifiers, numeric thresholds, and negations verbatim.',
  '- Do NOT use verbose prose paragraphs or decorative multi-byte emojis.',
  '- Output ONLY the `[SMFT-T1]` checkpoint text; call NO tools.',
].join('\n')

export default class BabelTeleSmftCompactionEngine extends BasicCompactionEngine {
  async summarize(input, agent, signal) {
    if (!btState.prefs.btEnabled) {
      return super.summarize(input, agent, signal)
    }

    const reqHeader = agent.session.requestHeader?.()?.config
    const curSel = agent.model?.current?.()
    const provider = reqHeader?.provider || curSel?.provider || agent.options?.provider
    const model = reqHeader?.model || curSel?.model || agent.options?.model

    if (!provider || !model) {
      return super.summarize(input, agent, signal)
    }

    const assembler = new BlockAssembler()
    const messages = [
      ...input.messages,
      Object.freeze({
        role: 'user',
        content: [{ type: 'text', text: SMFT_COMPACTION_INSTRUCTION }],
      }),
    ]

    const streamOptions = {
      provider,
      model,
      messages,
      toolHistory: agent.session.toolHistory(),
      ...(input.tools ? { tools: [...input.tools] } : {}),
      maxTokens: 2048,
      sessionId: agent.session.id,
      purpose: 'compaction',
      ...(signal ? { signal } : {}),
    }

    for await (const chunk of this.ctx.llm.stream(streamOptions)) {
      assembler.push(chunk)
    }

    if (assembler.finish.kind === 'error' || assembler.finish.kind === 'aborted') {
      throw LlmError.fromFailure(assembler.finish.failure)
    }

    const rawOutput = assembler.blocks()
    const summary = rawOutput.filter(b => b.type === 'text')
    if (!summary.some(b => b.text.trim().length > 0)) {
      return super.summarize(input, agent, signal)
    }

    btState.recordSmftCompaction()
    return {
      summary,
      rawOutput,
      llmStreamCall: true,
      provider,
      model,
      maxTokens: 2048,
      ...(assembler.usage ? { usage: assembler.usage } : {}),
    }
  }
}
