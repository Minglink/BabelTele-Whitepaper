import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link FISH_LOGO_PATH} (minimalist fine-line Babel spire mark). */
export const FISH_LOGO_VIEWBOX = { width: 24, height: 24 }

/**
 * Minimalist fine-line architectural spire silhouette (1.5px stroke geometry)
 * for external single-path SVG consumers.
 */
export const FISH_LOGO_PATH =
  'M11.25 3.25a.75.75 0 0 1 1.5 0v17.5a.75.75 0 0 1-1.5 0V3.25ZM7.5 6.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Zm-2 5.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H6.25a.75.75 0 0 1-.75-.75Zm-2 5.25a.75.75 0 0 1 .75-.75h15.5a.75.75 0 0 1 0 1.5H4.25a.75.75 0 0 1-.75-.75Z'

/**
 * Minimalist fine-line BabelTele Agent emblem (airy 1.5px rounded stroke).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
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
