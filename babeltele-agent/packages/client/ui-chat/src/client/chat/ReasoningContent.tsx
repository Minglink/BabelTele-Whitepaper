/** Official reasoning content and its BabelTele Sidecar Human-Language Lens adapter. */
import { memo, useMemo, useState } from 'react'
import {
  decodeBabelTeleToZh,
  looksLikeBabelTele,
  MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { markdownLabels } from '../markdown-labels.ts'

type ReasoningBodyProps = PropsRuntime<'conversation.chat.reasoning.body'> & PropsRenderFactories

/**
 * Render compact reasoning with caller-supplied labels or Chat's defaults.
 */
export const ReasoningContent = memo(function ReasoningContent({ text, running, labels, t }: FactoryComponentPropsOf<'conversation.chat.reasoning.content'>) {
  const resolvedLabels = useMemo(() => labels ?? markdownLabels(t), [labels, t])
  return <MarkdownText text={text} streaming={running} labels={resolvedLabels} variant="compact" />
})

/**
 * Render the default Reasoning Body with a native BabelTele Sidecar Human-Language Lens
 * (`⚡ #BT 硅基原文` <-> `👁️ 中文人话透视`) so humans can audit compact `#BT` thoughts effortlessly.
 */
export function DefaultReasoningBody({ text, running, renderFactorySlot }: ReasoningBodyProps) {
  const [humanLens, setHumanLens] = useState(false)
  const hasBtSyntax = useMemo(
    () => looksLikeBabelTele(text) || /(?:=>|->|!禁止:|!ban:|\[SMFT-T1\])/u.test(text),
    [text],
  )
  const displayText = useMemo(
    () => (humanLens ? decodeBabelTeleToZh(text) : text),
    [humanLens, text],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          paddingBottom: '2px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '1px 7px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            background: 'color-mix(in srgb, var(--dsw-alias-button-info-fill, #3964fe) 11%, transparent)',
            color: 'var(--dsw-alias-button-info-fill, #3964fe)',
          }}
        >
          {hasBtSyntax ? '⚡ Plane-A 巴别语高密度硅基推理' : '⚡ 双平面思考流 · 巴别语透视就绪'}
        </span>
        <button
          type="button"
          onClick={() => { setHumanLens(v => !v) }}
          style={{
            height: '22px',
            padding: '0 8px',
            borderRadius: '999px',
            border: '1px solid var(--dsw-alias-border-l2)',
            background: humanLens
              ? 'color-mix(in srgb, var(--dsw-alias-button-info-fill, #3964fe) 14%, transparent)'
              : 'transparent',
            color: humanLens
              ? 'var(--dsw-alias-button-info-fill, #3964fe)'
              : 'var(--dsw-alias-label-secondary)',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {humanLens ? '⚡ 切回 #BT 硅基原文' : '👁️ 中文人话透视'}
        </button>
      </div>
      {renderFactorySlot('conversation.chat.reasoning.content', { text: displayText, running })}
    </div>
  )
}
