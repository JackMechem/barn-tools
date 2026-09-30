"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { StopwatchIcon } from "@/components/tools";
import { formatClock } from "@/lib/practiceTimer";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/practiceTimerEngine";

/** A ticking "M:SS" readout for a running (or frozen-while-paused) Practice Timer step. Writes
    straight to the DOM via rAF rather than React state, same reasoning as CountdownLabel — a
    once-a-second-or-faster text update shouldn't re-render the whole sidebar. Computes off
    Date.now() directly, and formats via the same `formatClock` the tool page's own
    `PracticeTimerRing` uses, so the two can never show different numbers for the same step. */
function RemainingLabel({
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
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (paused) {
      if (spanRef.current) spanRef.current.textContent = formatClock(remainingMsAtPause ?? 0);
      return;
    }
    let frame = 0;
    const tick = () => {
      const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
      if (spanRef.current) spanRef.current.textContent = formatClock(remaining);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startedAt, durationMs, paused, remainingMsAtPause]);

  return <span className="shrink-0 tabular-nums" ref={spanRef} />;
}

/** The "what's running right now" glimpse shown outside the Practice Timer tool itself while a
    session is running — a compact card in the desktop sidebar footer (in both its full and
    collapsed widths) or a fixed top-right badge on mobile (mirroring the hamburger button's
    top-left placement). Renders nothing at all while no session is running. Every view is just a
    link back to the tool page — no controls here, so this stays a glimpse, not a second copy of
    the running-timer UI. */
export default function PracticeTimerWidget({
  collapsed,
  mobile,
}: {
  collapsed?: boolean;
  mobile?: boolean;
}) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!state) return null;

  const remaining = (
    <RemainingLabel
      startedAt={state.startedAt}
      durationMs={state.durationMs}
      paused={state.paused}
      remainingMsAtPause={state.remainingMsAtPause}
    />
  );

  if (mobile) {
    return (
      <Link
        href="/practice-timer"
        aria-label={`Practice Timer running: ${state.current.title}`}
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex max-w-[55vw] items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 lg:hidden"
      >
        <StopwatchIcon className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{state.current.title}</span>
        {remaining}
      </Link>
    );
  }

  if (collapsed) {
    return (
      <Link
        href="/practice-timer"
        title={`${state.current.title}${state.next ? ` — next: ${state.next.title}` : ""}`}
        className="flex items-center justify-center rounded-lg py-2 text-accent transition-colors hover:bg-surface-hover"
      >
        <StopwatchIcon className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      href="/practice-timer"
      className="flex flex-col gap-0.5 rounded-lg bg-background px-3 py-2 text-xs transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <StopwatchIcon className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{state.current.title}</span>
        <span className="ml-auto text-muted">{remaining}</span>
      </div>
      {state.next && (
        <div className="truncate pl-6 text-muted">Next: {state.next.title}</div>
      )}
    </Link>
  );
}
