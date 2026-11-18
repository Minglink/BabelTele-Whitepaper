// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import type { ReactNode, RefObject } from 'react'
import {
  IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { ConversationContentProps } from '../contract/slots.ts'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationContentProps['t']

export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderCloseRegular className={css.folder} size={16} />
        : <IconFolderOpenRegular className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutlineRegular className={css.chevron} size={12} />
    </button>
  )
}

export interface HeroShellProps {
  t: HeroTranslate
  renderSlot: ConversationContentProps['renderSlot']
  children?: ReactNode
}

/**
 * Minimalist fine-line BabelTele Agent hero mark (28px, 1.5px stroke).
 */
function HeroMark() {
  return (
    <svg
      className={css.fish}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.5V20.5M8.25 6.75H15.75M6.25 12H17.75M4.25 17.25H19.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          <span className={css.fishHitbox}>
            {renderSlot('conversation.hero.brand.mark', { size: 28, className: css.fish }, {
              fallback: <HeroMark />,
            })}
          </span>
          <span className={css.titleGroup}>
            <span>{t('hero.headline')}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
