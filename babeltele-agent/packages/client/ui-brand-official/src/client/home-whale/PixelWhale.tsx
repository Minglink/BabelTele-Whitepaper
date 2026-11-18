/** Home frame layer: subtle BabelTele Silicon Protocol ambient backdrop below the Hero content. */
import type { ReactNode } from 'react'
import type { HeroFrameOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './PixelWhale.module.css'

/** Frame owner state and the wrapped content. */
export type PixelWhaleProps = HeroFrameOwnerProps & { children: ReactNode }

/**
 * Wrap the Conversation scroll body; while the home hero is shown, render a subtle
 * silicon radial-grid aura without upstream whale artwork.
 */
export function PixelWhale({ hero, children }: PixelWhaleProps) {
  return (
    <div className={css.layer}>
      {hero && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(620px 280px at 50% 34%, color-mix(in srgb, var(--dsw-alias-button-info-fill, #3964fe) 7%, transparent), transparent 72%)',
          }}
        />
      )}
      {children}
    </div>
  )
}
