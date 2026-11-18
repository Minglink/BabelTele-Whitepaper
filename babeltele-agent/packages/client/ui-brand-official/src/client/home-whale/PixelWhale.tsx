/** Home frame layer: pure flat minimalist DeepSeek-style surface with zero background clutter. */
import type { ReactNode } from 'react'
import type { HeroFrameOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './PixelWhale.module.css'

/** Frame owner state and the wrapped content. */
export type PixelWhaleProps = HeroFrameOwnerProps & { children: ReactNode }

/**
 * Layout-neutral minimalist frame around the Conversation scroll body.
 */
export function PixelWhale({ children }: PixelWhaleProps) {
  return <div className={css.layer}>{children}</div>
}
