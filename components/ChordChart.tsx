"use client";

import { Oswald } from "next/font/google";
import {
  formatComposer,
  type Bar,
  type ChordSlot,
  type IRealSong,
} from "@/lib/iRealPro";

// iReal Pro sets its chord symbols in a tall, narrow face so a big chord (with extensions and a
// bass note) still fits a measure without crowding it — Oswald is a decent free stand-in for
// that look. Loaded here (not the site-wide font list in app/fonts.ts) since it's specific to
// this one chart display, not something to offer as a general site font.
const chordFont = Oswald({ subsets: ["latin"], weight: ["400", "500"] });

// Every size below is a function of one CSS variable, `--col`: the width of a single bar column,
// which is itself `100cqw / --bars` (a container-query width, not a viewport width, divided by
// however many bars are packed into a row). Bar columns are laid out as equal `1fr` shares of
// whatever width the chart's container actually has, so a row can never be wider than its
// container — there's nothing to overflow. As that container (or the bars-per-row setting)
// shrinks, `--col` shrinks, and every clamp() below rides it down, so text shrinks to keep fitting
// its column instead of forcing a scrollbar. The min/max in each clamp just keeps things from
// going illegibly small or comically large at the extremes.
function colSize(factor: number, min: string, max: string) {
  return `clamp(${min}, calc(var(--col) * ${factor}), ${max})`;
}

const ROOT_SIZE = colSize(0.22, "1.5rem", "3.5rem");
const ROOT_ACCIDENTAL_SIZE = colSize(0.11, "0.9rem", "1.75rem");
const QUALITY_SIZE = colSize(0.18, "1.2rem", "2.75rem");
const BASS_SIZE = colSize(0.11, "0.9rem", "1.75rem");
const REPEAT_SIZE = colSize(0.2, "1.3rem", "3rem");
const SYMBOL_SIZE = colSize(0.1, "1rem", "1.75rem");
const SMALL_LABEL_SIZE = colSize(0.055, "0.65rem", "0.95rem");
const BADGE_SIZE = colSize(0.05, "0.6rem", "0.85rem");
const MIN_BAR_HEIGHT = colSize(0.68, "5.5rem", "9.5rem");

/** Renders one song's chord chart, iReal-Pro style: a bordered grid of bars, grouped into rows
    (breaking at each section and every `barsPerRow` bars), with boxed section letters, repeat
    barlines, numbered-ending brackets and printed directions ("Fine", "D.C. al Coda", ...).

    The chart's own container must have `container-type: inline-size` set on it (or an ancestor)
    for the `cqw`-based sizing above to have something to measure against — see ChordCharts.tsx. */
export default function ChordChart({
  song,
  barsPerRow = 4,
}: {
  song: IRealSong;
  barsPerRow?: number;
}) {
  const rows = groupRows(song.bars, barsPerRow);

  return (
    <div
      className="w-full text-left"
      style={
        {
          "--bars": barsPerRow,
          "--col": "calc(100cqw / var(--bars))",
        } as React.CSSProperties
      }
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-background pb-3">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            {song.title}
          </h2>
          <p className="text-sm text-muted sm:text-base">
            {song.style}
            {song.style && " · "}
            {song.key} · {song.timeSignature.top}/{song.timeSignature.bottom}
          </p>
        </div>
        {song.composer && (
          <p className="shrink-0 text-sm text-muted sm:text-base">
            {formatComposer(song.composer)}
          </p>
        )}
      </div>

      {song.bars.length === 0 ? (
        <p className="text-sm text-muted">No chords found in this chart.</p>
      ) : (
        <div className="flex flex-col gap-5 sm:gap-6">
          {rows.map((row, i) => (
            <Row key={i} bars={row} isLastRow={i === rows.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function groupRows(bars: Bar[], barsPerRow: number): Bar[][] {
  const rows: Bar[][] = [];
  let current: Bar[] = [];
  for (const bar of bars) {
    if (current.length > 0 && (bar.newRow || current.length >= barsPerRow)) {
      rows.push(current);
      current = [];
    }
    current.push(bar);
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

/** Contiguous runs of bars sharing the same numbered ending, within one row. */
function endingSpans(
  bars: Bar[],
): { label: string; start: number; span: number }[] {
  const spans: { label: string; start: number; span: number }[] = [];
  let i = 0;
  while (i < bars.length) {
    const label = bars[i].endingLabel;
    if (!label) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < bars.length && bars[j].endingLabel === label) j += 1;
    spans.push({ label, start: i, span: j - i });
    i = j;
  }
  return spans;
}

function Row({ bars, isLastRow }: { bars: Bar[]; isLastRow: boolean }) {
  // The section letter (A, B, ...) is drawn inside the row's first bar rather than in a gutter
  // column of its own — that gutter used to eat into the width available to the bars themselves,
  // which is exactly what's tight on a narrow screen.
  const section = bars[0]?.section;
  const spans = endingSpans(bars);
  const hasEndings = spans.length > 0;

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`,
        gridTemplateRows: hasEndings ? "1.5rem auto" : "auto",
      }}
    >
      {spans.map((s) => (
        <div
          key={s.start}
          className="relative mb-1 border-t-2 border-foreground/70 pl-1 font-semibold text-muted"
          style={{
            gridColumn: `${s.start + 1} / span ${s.span}`,
            gridRow: 1,
            fontSize: SMALL_LABEL_SIZE,
          }}
        >
          {s.label}.
        </div>
      ))}
      {bars.map((bar, i) => (
        <BarCell
          key={i}
          bar={bar}
          section={i === 0 ? section : undefined}
          column={i + 1}
          row={hasEndings ? 2 : 1}
          isFirst={i === 0}
          isLast={i === bars.length - 1}
          isLastOfChart={isLastRow && i === bars.length - 1}
        />
      ))}
    </div>
  );
}

function BarCell({
  bar,
  section,
  column,
  row,
  isFirst,
  isLast,
  isLastOfChart,
}: {
  bar: Bar;
  section?: string;
  column: number;
  row: number;
  isFirst: boolean;
  isLast: boolean;
  isLastOfChart: boolean;
}) {
  const leftStyle = bar.startRepeat
    ? "border-l-4 border-foreground"
    : isFirst
      ? "border-l border-muted/40"
      : "";
  const rightStyle = bar.endRepeat
    ? "border-r-4 border-foreground"
    : isLast
      ? isLastOfChart
        ? "border-r-4 border-foreground"
        : "border-r border-muted/40"
      : "border-r border-muted/40";

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-0.5 px-0.5 py-2 sm:py-3 ${leftStyle} ${rightStyle}`}
      style={{ gridColumn: column, gridRow: row, minHeight: MIN_BAR_HEIGHT }}
    >
      {bar.startRepeat && <RepeatDots side="left" />}
      {bar.endRepeat && <RepeatDots side="right" />}
      {section && (
        <span
          className="absolute left-0.5 top-0.5 flex items-center justify-center rounded bg-accent font-bold text-accent-foreground"
          style={{ fontSize: BADGE_SIZE, width: "1.7em", height: "1.7em" }}
        >
          {section}
        </span>
      )}
      {(bar.segno || bar.coda) && (
        <span
          className="absolute right-0.5 top-0.5 text-accent"
          style={{ fontSize: SYMBOL_SIZE }}
          aria-hidden
        >
          {bar.segno ? "𝄋" : "⊕"}
        </span>
      )}
      <BarContent bar={bar} />
      {bar.directive && (
        <span
          className="absolute -bottom-5 right-0 whitespace-nowrap italic text-muted"
          style={{ fontSize: SMALL_LABEL_SIZE }}
        >
          {bar.directive}
        </span>
      )}
    </div>
  );
}

function RepeatDots({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-1 ${
        side === "left" ? "left-1.5" : "right-1.5"
      }`}
    >
      <span className="h-1 w-1 rounded-full bg-foreground" />
      <span className="h-1 w-1 rounded-full bg-foreground" />
    </span>
  );
}

function BarContent({ bar }: { bar: Bar }) {
  if (bar.content.kind === "repeat") {
    return (
      <span className="text-muted" style={{ fontSize: REPEAT_SIZE }}>
        %
      </span>
    );
  }
  const { slots } = bar.content;
  if (slots.length === 0) {
    return <span className="text-muted">&nbsp;</span>;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
      {slots.map((slot, i) => (
        <ChordLabel key={i} slot={slot} />
      ))}
    </div>
  );
}

const ACCIDENTAL_GLYPH: Record<"b" | "#", string> = { b: "♭", "#": "♯" };

function prettyQuality(quality: string): string {
  return quality
    .replace(/\^/g, "Δ")
    .replace(/h/g, "ø")
    .replace(/o/g, "°")
    .replace(/#/g, "♯")
    .replace(/b/g, "♭");
}

// Every part of a chord symbol below (root, its accidental, the quality/extension, the slash
// bass) is sized with an explicit font-size driven by the `--col`-based clamp()s above, not a
// relative `em` value. `quality` and `bass` sit as *siblings* of the root `<span>`, not children
// of it, so an `em` on them would resolve against whatever font-size this label happens to
// inherit from its bar cell — not against the root's own (much larger) size — which is exactly
// why they used to stay illegibly small no matter how big that `em` value got. Explicit,
// independently-computed sizes sidestep that entirely.
function ChordLabel({ slot }: { slot: ChordSlot }) {
  if (slot.kind === "nc") {
    return (
      <span
        className={`font-medium text-muted ${chordFont.className}`}
        style={{ fontSize: QUALITY_SIZE }}
      >
        N.C.
      </span>
    );
  }
  if (slot.kind === "slash") {
    return (
      <span
        className={`text-muted ${chordFont.className}`}
        style={{ fontSize: QUALITY_SIZE }}
        aria-hidden
      >
        /
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-baseline leading-none ${chordFont.className}`}
    >
      <span
        className="font-medium text-foreground"
        style={{ fontSize: ROOT_SIZE }}
      >
        {slot.letter}
        {slot.accidental && (
          <sup style={{ fontSize: ROOT_ACCIDENTAL_SIZE }}>
            {ACCIDENTAL_GLYPH[slot.accidental]}
          </sup>
        )}
      </span>
      {slot.quality && (
        <sup
          className="ml-1 align-top font-medium text-foreground"
          style={{ fontSize: QUALITY_SIZE }}
        >
          {prettyQuality(slot.quality)}
        </sup>
      )}
      {slot.bass && (
        <span className="ml-1.5 text-muted" style={{ fontSize: BASS_SIZE }}>
          /{slot.bass.letter}
          {slot.bass.accidental && ACCIDENTAL_GLYPH[slot.bass.accidental]}
        </span>
      )}
    </span>
  );
}
