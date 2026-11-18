/** Official reasoning content and its minimalist fine-line BabelTele Sidecar Lens. */
import { memo, useMemo, useState } from 'react'
import {
  decodeBabelTeleToZh,
  looksLikeBabelTele,
  MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { FactoryComponentPropsOf, PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { markdownLabels } from '../markdown-labels.ts'

type ReasoningBodyProps = PropsRuntime<'conversation.chat.reasoning.body'> & PropsRenderFactories

export const ReasoningContent = memo(function ReasoningContent({ text, running, labels, t }: FactoryComponentPropsOf<'conversation.chat.reasoning.content'>) {
  const resolvedLabels = useMemo(() => labels ?? markdownLabels(t), [labels, t])
  return <MarkdownText text={text} streaming={running} labels={resolvedLabels} variant="compact" />
})

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: '2px',
        }}
      >
        <span
          style={{
            fontSize: '11.5px',
            lineHeight: '16px',
            color: 'var(--dsw-alias-label-caption)',
            fontFamily: 'var(--ds-font-family-code)',
          }}
        >
          {hasBtSyntax ? 'BT-CoT · 纯巴别语思维链' : 'CoT'}
        </span>
        <button
          type="button"
          onClick={() => { setHumanLens(v => !v) }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '20px',
            padding: '0 7px',
            borderRadius: '4px',
            border: '0.5px solid var(--dsw-alias-border-l2)',
            background: 'transparent',
            color: humanLens ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)',
            fontSize: '11.5px',
            lineHeight: '16px',
            fontWeight: 400,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M1.75 8S4.1 3.75 8 3.75 14.25 8 14.25 8 11.9 12.25 8 12.25 1.75 8 1.75 8Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.25" />
          </svg>
          <span>{humanLens ? '还原 #BT' : '中文透视'}</span>
        </button>
      </div>
      {renderFactorySlot('conversation.chat.reasoning.content', { text: displayText, running })}
    </div>
  )
}
