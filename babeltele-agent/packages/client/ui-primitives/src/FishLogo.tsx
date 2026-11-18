import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link FISH_LOGO_PATH} (BabelTele Silicon Tower-Bolt emblem). */
export const FISH_LOGO_VIEWBOX = { width: 24, height: 24 }

/**
 * Geometric BabelTele Silicon Tower-Bolt vector silhouette.
 * Keeps the `FISH_LOGO_PATH` export contract so all Harness surfaces render the BabelTele emblem natively.
 */
export const FISH_LOGO_PATH =
  'M12 1.5L21 6.7V17.3L12 22.5L3 17.3V6.7L12 1.5ZM12 3.85L5.05 7.86V16.14L12 20.15L18.95 16.14V7.86L12 3.85ZM13.35 5.8L7.6 13.05H11.55L10.65 18.2L16.4 10.95H12.45L13.35 5.8Z'

/**
 * Render the BabelTele Silicon Tower-Bolt emblem.
 * @param props.size - width in px (default 24; 1:1 geometric aspect ratio).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * FISH_LOGO_VIEWBOX.height) / FISH_LOGO_VIEWBOX.width}
      className={className}
      viewBox={`0 0 ${FISH_LOGO_VIEWBOX.width} ${FISH_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path fillRule="evenodd" clipRule="evenodd" d={FISH_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}
