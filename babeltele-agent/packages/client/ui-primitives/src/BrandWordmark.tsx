import type { IconProps } from './icons/props.ts'
import { FISH_LOGO_PATH } from './FishLogo.tsx'

/** Display options for the BabelTele brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading BabelTele emblem; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the BabelTele brand wordmark (`BabelTele` + `BT-v1` pill).
 * @param props.size - height in px (default 24; width scales proportionally).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading emblem.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 176 : 148
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? '0 0 176 24' : '28 0 148 24'}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && (
        <path fillRule="evenodd" clipRule="evenodd" d={FISH_LOGO_PATH} fill="currentColor" />
      )}
      <text
        x="29"
        y="17.2"
        fill="currentColor"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="15.5"
        fontWeight="700"
        letterSpacing="-0.35"
      >
        BabelTele
      </text>
      <rect x="112" y="5" width="58" height="14" rx="3.5" fill="currentColor" />
      <text
        x="141"
        y="14.7"
        textAnchor="middle"
        fill="var(--dsw-alias-label-primary-inverted)"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        fontSize="9.5"
        fontWeight="700"
        letterSpacing="0.4"
      >
        BT-v1.0
      </text>
    </svg>
  )
}
