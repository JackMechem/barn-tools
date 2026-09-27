"use client";

import type { BeatLevel } from "@/lib/clickEngine";

const LEVEL_LABEL: Record<BeatLevel, string> = { 2: "accent", 1: "normal", 0: "muted" };

/** The row of beat circles shared by the Metronome and Jam Practice pages. */
export default function BeatIndicator({
  accents,
  currentBeat,
  onCycle,
}: {
  accents: BeatLevel[];
  currentBeat: number | null;
  /** When given, beats are buttons that cycle accent / normal / muted. */
  onCycle?: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Beats in bar">
      {accents.map((level, i) => {
        const className = `flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-transform ${
          level === 2
            ? "bg-accent text-accent-foreground"
            : level === 1
              ? "bg-surface text-foreground"
              : "bg-surface text-muted line-through opacity-60"
        } ${
          currentBeat === i
            ? "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-background"
            : ""
        }`;
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
