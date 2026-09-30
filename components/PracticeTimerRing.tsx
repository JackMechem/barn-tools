"use client";

import { useEffect, useRef } from "react";
import { formatClock } from "@/lib/practiceTimer";

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The Practice Timer tool page's own countdown ring + "M:SS" label, driven directly off the
 * engine's wall-clock (`Date.now()`) `startedAt`/`durationMs` — deliberately **not** built on the
 * shared `CountdownRing`/`CountdownLabel` (hardcoded to `performance.now()`, the page-load-
 * relative clock every other timer in this app uses). Practice Timer is the one timer here that
 * has to keep counting correctly across an actual page reload, and computing directly off
 * `Date.now()` here — the exact same clock `lib/practiceTimerEngine.ts` itself and
 * `PracticeTimerWidget.tsx`'s sidebar/mobile readout use, via the same `formatClock` — means this
 * display and that one can never show two different numbers for the same running step, the way an
 * separate `performance.timeOrigin` conversion (this component's first version) turned out to.
 */
export default function PracticeTimerRing({
  startedAt,
  durationMs,
  paused,
  remainingMsAtPause,
}: {
  startedAt: number;
  durationMs: number;
  paused: boolean;
  remainingMsAtPause: number | null;
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function paint(remainingMs: number) {
      const fraction = Math.min(1, Math.max(0, 1 - remainingMs / durationMs));
      circleRef.current?.style.setProperty(
        "stroke-dashoffset",
        String(RING_CIRCUMFERENCE * fraction),
      );
      if (labelRef.current) labelRef.current.textContent = formatClock(remainingMs);
    }

    if (paused) {
      paint(remainingMsAtPause ?? 0);
      return;
    }
    let frame = 0;
    const tick = () => {
      paint(Math.max(0, durationMs - (Date.now() - startedAt)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, durationMs, paused, remainingMsAtPause]);

  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="4"
          className="stroke-surface-hover"
        />
        <circle
          ref={circleRef}
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-accent"
          style={{
            strokeDasharray: RING_CIRCUMFERENCE,
            strokeDashoffset: 0,
            transition: "stroke-dashoffset 0.1s linear",
          }}
        />
      </svg>
      <span ref={labelRef} className="text-4xl font-bold tabular-nums" />
    </div>
  );
}
