import type { IconProps } from './icons/props.ts'

/** Display options for the minimalist BabelTele Agent wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading fine-line emblem; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Minimalist fine-line wordmark: `巴别语 Agent` (pure monochrome typography, zero heavy filled blocks).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 132 : 104
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? '0 0 132 24' : '28 0 104 24'}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && (
        <path
          d="M12 4V20M8.5 7H15.5M6.5 12H17.5M4.5 17H19.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <text
        x="29"
        y="16.8"
        fill="currentColor"
        fontFamily="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', Inter, sans-serif"
        fontSize="14.5"
        fontWeight="500"
        letterSpacing="0.1"
      >
        巴别语 Agent
      </text>
    </svg>
  )
}
