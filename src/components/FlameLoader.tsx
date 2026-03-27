'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Animated Lumio flame loader.
 * Shows a stroke-outline of the flame that draws itself in,
 * fills with brand orange, then resets — looping until dismissed.
 * Appears after `delay` ms so fast loads never flash it.
 */
export default function FlameLoader({ delay = 600, size = 64 }: { delay?: number; size?: number }) {
  const [visible, setVisible] = useState(delay === 0);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState<number | null>(null);

  useEffect(() => {
    if (delay === 0) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (visible && pathRef.current) {
      setPathLength(Math.ceil(pathRef.current.getTotalLength()) + 4);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <style>{`
        @keyframes kb-flame-draw {
          0% {
            stroke-dashoffset: ${pathLength};
            fill-opacity: 0;
          }
          50% {
            stroke-dashoffset: 0;
            fill-opacity: 0;
          }
          70% {
            stroke-dashoffset: 0;
            fill-opacity: 1;
          }
          90% {
            stroke-dashoffset: 0;
            fill-opacity: 1;
          }
          100% {
            stroke-dashoffset: ${pathLength};
            fill-opacity: 0;
          }
        }

        @keyframes kb-flame-glow {
          0%, 55% { filter: drop-shadow(0 0 0px transparent); }
          72% { filter: drop-shadow(0 0 18px rgba(250, 66, 15, 0.9)); }
          88% { filter: drop-shadow(0 0 10px rgba(250, 66, 15, 0.5)); }
          100% { filter: drop-shadow(0 0 0px transparent); }
        }

        .kb-flame-loader-svg {
          animation: kb-flame-glow 2.4s ease-in-out infinite;
        }

        .kb-flame-loader-path {
          stroke-dasharray: ${pathLength ?? 0};
          stroke-dashoffset: ${pathLength ?? 0};
          fill: #fa420f;
          fill-opacity: 0;
          stroke: #fa420f;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: ${pathLength ? 'kb-flame-draw 2.4s ease-in-out infinite' : 'none'};
        }
      `}</style>

      <svg
        className="kb-flame-loader-svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="575 -5 65 95"
        style={{ width: size, height: size }}
        aria-label="Loading…"
      >
        <path
          ref={pathRef}
          className="kb-flame-loader-path"
          d="M607.665,85.002 C599.884,85.002 593.331,82.269 587.998,76.798 C582.665,71.331 580.028,64.768 579.998,57.107 C579.941,42.541 586.944,32.765 592.177,28.186 C589.274,44.173 605.779,44.594 601.191,31.580 C594.742,10.187 607.500,0.000 607.500,0.000 C607.500,0.000 608.726,13.316 627.498,37.416 C631.946,43.126 634.998,49.231 634.998,57.107 C634.998,64.768 632.498,71.331 627.498,76.798 C622.498,82.269 615.883,85.002 607.665,85.002 Z"
        />
      </svg>
    </div>
  );
}
