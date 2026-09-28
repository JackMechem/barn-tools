"use client";

import type { BeatLevel } from "@/lib/clickEngine";

const LEVEL_LABEL: Record<BeatLevel, string> = {
  2: "accent",
  1: "normal",
  0: "muted",
};

/** The row of beat circles shared by the Metronome and Jam Practice pages. */
export default function BeatIndicator({
  accents,
  currentBeat,
  onCycle,
  size = "md",
}: {
  accents: BeatLevel[];
  currentBeat: number | null;
  /** When given, beats are buttons that cycle accent / normal / muted. */
  onCycle?: (index: number) => void;
  /** "sm" shrinks the whole thing (numbers included) — for a smaller reference metronome. */
  size?: "md" | "sm";
}) {
  const small = size === "sm";
  const dim = small ? "h-7 w-7 text-xs" : "h-11 w-11 text-sm";
  const gap = small ? "gap-1" : "gap-2";
  // The ring-offset look needs more breathing room than these tight, small circles have, so
  // the small size just gets a plain ring instead — offsetting it looked clipped/warped.
  const ring = small
    ? "scale-110 ring-2 ring-accent"
    : "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-background";

  return (
    <div
      className={`flex flex-wrap justify-center ${gap}`}
      role="group"
      aria-label="Beats in bar"
    >
      {accents.map((level, i) => {
        const className = `flex ${dim} items-center justify-center rounded-full font-semibold tabular-nums transition-transform ${
          level === 2
            ? "bg-accent text-accent-foreground"
            : level === 1
              ? "bg-surface text-foreground"
              : "bg-surface text-muted line-through opacity-60"
        } ${currentBeat === i ? ring : ""}`;
        const label = `Beat ${i + 1}: ${LEVEL_LABEL[level]}`;
        return onCycle ? (
          <button
            key={i}
            type="button"
            onClick={() => onCycle(i)}
            aria-label={`${label}. Click to change.`}
            title={label}
            className={className}
          >
            {i + 1}
          </button>
        ) : (
          <div key={i} title={label} className={className}>
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
