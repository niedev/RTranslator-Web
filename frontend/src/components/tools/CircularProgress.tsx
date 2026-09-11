/**
 * CircularProgress
 * A custom circular progress indicator.
 *
 * - Pass a `value` (0-100) for the determinate mode (fills based on progress).
 * - Omit `value` (or pass undefined/null) for the indeterminate mode
 *   (a spinning arc animation, used while the actual progress is unknown).
 *
 * The indeterminate animation follows the same technique other material progressbars use:
 * a wrapper spins continuously and linearly (0deg -> 360deg, which loops
 * with zero visual seam), while the circle's stroke-dasharray/dashoffset
 * are animated separately to grow and shrink the arc. Keeping rotation and
 * dash-length on two different elements/animations is what avoids stutter -
 * mixing both on one element causes a visible snap at every loop restart.
 */
export interface CircularProgressProps {
  /** 0-100. If omitted (or null/NaN) -> indeterminate mode. */
  value?: number | null;
  /** Diameter in px. @default 40 */
  size?: number;
  /** Stroke width in px. @default 4 */
  thickness?: number;
  /** Stroke color of the indicator. @default 'currentColor' */
  color?: string;
  /** Stroke color of the background track. @default 'transparent' */
  trackColor?: string;
  /** Rounded line caps, Material-3 style. @default true */
  rounded?: boolean;
  className?: string;
}

export default function CircularProgress({
  value,
  size = 40,
  thickness = 4,
  color = 'currentColor',
  trackColor = 'transparent',
  rounded = true,
  className = '',
}: CircularProgressProps) {
  const isIndeterminate =
    value === undefined || value === null || Number.isNaN(value);
  const clampedValue = isIndeterminate ? 0 : Math.min(100, Math.max(0, value));

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // For determinate mode: how much of the circle to fill.
  const determinateOffset = circumference - (clampedValue / 100) * circumference;

  // Ratios ported from MUI's own indeterminate keyframes (tuned against a
  // 44px/radius-20.2 viewBox), generalized proportionally to our circumference.
  const dashMin = 1; // px - practically a dot, so the arc starts almost invisible
  const dashMax = circumference * 0.7881; // longest arc length reached mid-cycle
  const gap = circumference * 3; // gap bigger than the circle so only one arc ever shows
  const offsetStart = 0;
  const offsetMid = -circumference * 0.1182;
  const offsetEnd = -circumference * 0.9849;

  return (
    <span
      className={`cp-root ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : Math.round(clampedValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-busy={isIndeterminate || undefined}
    >
      <span className={isIndeterminate ? 'cp-spin' : 'cp-spin cp-spin-static'}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="cp-svg"
        >
          {/* background track */}
          {trackColor !== 'transparent' && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={trackColor}
              strokeWidth={thickness}
            />
          )}

          {/* progress indicator */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap={rounded ? 'round' : 'butt'}
            strokeDasharray={isIndeterminate ? undefined : circumference}
            strokeDashoffset={isIndeterminate ? undefined : determinateOffset}
            className={
              isIndeterminate ? 'cp-circle cp-circle-indeterminate' : 'cp-circle'
            }
          />
        </svg>
      </span>

      <style>{`
        .cp-root {
          display: inline-flex;
          position: relative;
        }
        .cp-spin {
          display: inline-flex;
          transform-origin: 50% 50%;
        }
        .cp-spin:not(.cp-spin-static) {
          animation: cp-spin 1.4s linear infinite;
        }
        .cp-svg {
          display: block;
          transform: rotate(-90deg);
        }
        .cp-circle {
          transition: stroke-dashoffset 0.3s ease;
        }
        .cp-circle-indeterminate {
          transition: none;
          animation: cp-dash 1.4s ease-in-out infinite;
        }

        /* Continuous, seamless rotation: 0deg and 360deg are visually
           identical, so the loop restart never produces a jump. */
        @keyframes cp-spin {
          100% { transform: rotate(360deg); }
        }

        /* Only dash length/offset change here - no transform - so this
           never fights with the spin animation above. */
        @keyframes cp-dash {
          0% {
            stroke-dasharray: ${dashMin}px, ${gap}px;
            stroke-dashoffset: ${offsetStart}px;
          }
          50% {
            stroke-dasharray: ${dashMax}px, ${gap}px;
            stroke-dashoffset: ${offsetMid}px;
          }
          100% {
            stroke-dasharray: ${dashMax}px, ${gap}px;
            stroke-dashoffset: ${offsetEnd}px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cp-spin:not(.cp-spin-static) {
            animation-duration: 3s;
          }
          .cp-circle-indeterminate {
            animation-duration: 3s;
          }
        }
      `}</style>
    </span>
  );
}