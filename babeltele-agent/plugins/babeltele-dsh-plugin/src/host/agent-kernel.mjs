/**
 * Scoped Per-Agent BabelTele Kernel (`@babeltele/dsh-plugin/agent`).
 * Mounted inside `preset-babeltele` (and optional overlays) to provide:
 * 1. Dual-Plane System Prompt (`Plane A`: `#BT` Silicon Reasoning & Subagent Bus; `Plane B`: 100% Pure Native Code)
 * 2. Cross-File `BT-Header` Topological Workspace Signature Injection
 * 3. Optional `agent/pre-step` Input Dehydration with Tier-1 Hard-Anchor Lock
 * 4. `tools/pre-execute` & `tools/result` Dual-Plane `ArtifactSanitizer` Gate
 */
import {
  auditCodePurity,
  countTokens,
  neutralizePrompt,
  scanWorkspaceHeaders,
} from '../protocol/babeltele-core.mjs'
import { btState } from './state.mjs'

export const name = 'babeltele-agent-kernel'
export const inject = ['systemPrompt', 'tools']

const DUAL_PLANE_SECTION = [
  '## BabelTele Super Kernel (`BT-Spec v1.0` Dual-Plane Protocol)',
  '',
  'You operate with **strict Dual-Plane separation** to maximize autonomous engineering speed while guaranteeing 100% clean native source code:',
  '',
  '1. **Plane A — Silicon Reasoning & Subagent Bus (`#BT` Control Plane)**:',
  '   - Keep internal reasoning, scratchpad thoughts, and `subagent` delegation prompts ultra-dense using single-line `BT-Spec v1.0` ASCII operators (`#BT`, `#Plan`, `#Diag`, `#Fix`, `#Verify`, `->`, `?cond=>act`, `&`, `|`, `!exc:`).',
  '   - Eliminate conversational filler, self-narration ("Let me think about...", "First I will..."), and decorative emojis inside intermediate tool-calling steps. Preserve 100% of exact file paths, line numbers, thresholds, and identifiers.',
  '   - When presenting your **final answer** to the human user after completing tool execution, write clear, concise, natural human language matching the user\'s locale (e.g., Simplified Chinese).',
  '',
  '2. **Plane B — Native Code & File Artifacts (`0% Pollution Invariant`)**:',
  '   - Every file written or edited via `write`, `edit`, `apply_patch`, `str_replace_editor`, or shell scripts MUST be **100% pure, idiomatic, compilable native code** (`Python`, `Java`, `TypeScript`, `Go`, `Rust`, `SQL`, `HTML/CSS`, etc.) with standard docstrings/comments.',
  '   - **NEVER** leak `#BT`, `⟦...⟧`, `[SMFT-T1]`, or BabelTele shorthand operators into source code files or code comments.',
].join('\n')

function extractFileCandidate(toolName, args) {
  if (!args || typeof args !== 'object') return null
  const n = String(toolName || '').toLowerCase()
  if (n === 'write' || n === 'write_file') {
    const path = args.file_path ?? args.path ?? args.filePath
    const content = args.content ?? args.text
    if (typeof path === 'string' && typeof content === 'string') return { path, content }
  }
  if (n === 'edit' || n === 'edit_file' || n === 'str_replace_editor') {
    const path = args.file_path ?? args.path ?? args.filePath
    const content = args.new_string ?? args.new_str ?? args.newText ?? args.content
    if (typeof path === 'string' && typeof content === 'string') return { path, content }
  }
  return null
}

export function apply(ctx) {
  // 1. Register Dual-Plane System Prompt Section
  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: 'babeltele-dual-plane-protocol',
      order: 25,
      interpolate: false,
      text: () => (btState.prefs.btEnabled ? DUAL_PLANE_SECTION : ''),
    }),
  )

  // 2. Register Dynamic Cross-File `BT-Header` Workspace Index Context
  ctx.effect(() =>
    ctx.systemPrompt.context({
      name: 'babeltele-bt-header-index',
      order: 65,
      interpolate: false,
      text: (assembleCtx) => {
        if (!btState.prefs.btEnabled || !btState.prefs.injectBtHeaders) return ''
        const cwd = assembleCtx?.agent?.session?.meta?.cwd
        if (!cwd) return ''
        const { digest, count } = scanWorkspaceHeaders(cwd, 20)
        if (!digest || count === 0) return ''
        return `[BT-Header Cross-File Index (${count} files)]\n${digest}`
      },
    }),
  )

  // 3. Optional Pre-Step User Prompt Neutralizer (with Tier-1 Hard-Anchor Lock)
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (
      decision.kind !== 'enter'
      || !btState.prefs.btEnabled
      || !btState.prefs.autoNeutralizeOnSend
      || !Array.isArray(decision.messages)
      || decision.messages.length === 0
    ) {
      return decision
    }

    const updatedMessages = await Promise.all(
      decision.messages.map(async (msg) => {
        if (msg?.source?.kind !== 'user' || !Array.isArray(msg.content)) return msg
        let mutated = false
        const newContent = await Promise.all(
          msg.content.map(async (block) => {
            if (block?.type !== 'text' || typeof block.text !== 'string') return block
            const trimmed = block.text.trim()
            if (trimmed.length < 30 || trimmed.startsWith('/') || trimmed.startsWith('#Task')) {
              return block
            }
            const res = await neutralizePrompt(trimmed)
            if (res.babeltele && res.babeltele !== trimmed && res.audit.passed) {
              mutated = true
              btState.recordNeutralization(res.budget.savedTokens)
              return { ...block, text: res.babeltele }
            }
            return block
          }),
        )
        return mutated ? { ...msg, content: newContent } : msg
      }),
    )

    return { ...decision, messages: updatedMessages }
  })

  // 4. Dual-Plane `ArtifactSanitizer` Pre-Execute Gate
  ctx.on('tools/pre-execute', async (exec, next) => {
    const candidate = extractFileCandidate(exec?.name, exec?.args)
    if (candidate && btState.prefs.strictCodeGuard) {
      const purity = auditCodePurity(candidate.path, candidate.content)
      if (purity.checked && !purity.pure) {
        btState.recordFileAudit({
          path: candidate.path,
          tool: exec.name,
          pure: false,
          issues: purity.issues,
        })
        return {
          kind: 'deny',
          reason:
            `[BabelTele Dual-Plane Sanitizer] Blocked non-native symbol leakage in "${candidate.path}": `
            + `${purity.issues.join('; ')}. Plane B requires 100% pure native code with zero #BT shorthand.`,
        }
      }
    }
    return next()
  })

  // 5. Observe Completed Tool Calls & Assistant Reasoning Telemetry
  ctx.on('tools/result', (exec, result) => {
    if (result?.isError) return
    const candidate = extractFileCandidate(exec?.name, exec?.args)
    if (candidate) {
      const purity = auditCodePurity(candidate.path, candidate.content)
      if (purity.checked) {
        btState.recordFileAudit({
          path: candidate.path,
          tool: exec.name,
          pure: purity.pure,
          issues: purity.issues,
        })
      }
    }
  })

  ctx.on('session/event', (_session, event) => {
    if (!btState.prefs.btEnabled || event?.type !== 'assistant/message') return
    const blocks = event?.data?.message?.content
    if (!Array.isArray(blocks)) return
    for (const b of blocks) {
      if (b?.type === 'thinking' && typeof b.thinking === 'string' && b.thinking.trim()) {
        btState.recordReasoningStep(countTokens(b.thinking))
      }
    }
  })
}
