"use client";

import { useEffect, useRef, useState } from "react";
import {
  BAR_HEIGHT,
  chordFont,
  ChordLabel,
  COL_WIDTH,
  FitChordRow,
  QUALITY_SIZE,
  TimeSignatureGlyph,
} from "@/components/ChordChart";
import ChordSymbolKeypad from "@/components/ChordSymbolKeypad";
import NumberField from "@/components/NumberField";
import { PlusIcon, TrashIcon } from "@/components/tools";
import { encodeChartString } from "@/lib/chartString";
import { parseBarSlots, type IRealSong } from "@/lib/iRealPro";

const STARTING_BARS = 4;

/** A from-scratch chord chart builder — deliberately simple (a flat list of bars, no repeats,
    endings, sections, or directives the way a pasted iReal chart can have) rather than a full
    editor for every notation feature `ChordChart.tsx` can render. Typing happens directly on the
    chart itself, the same way a maximized chart looks: bars sit in the same fixed-size,
    barlined grid `ChordChart.tsx` renders (`COL_WIDTH`/`BAR_HEIGHT`, the same Petaluma font,
    the same `ChordLabel`/`FitChordRow`/`TimeSignatureGlyph` those exports are), so there's no
    separate "preview" pane mirroring a plain form — the bars *are* the preview, live, the moment
    you click away from one. Each bar is typed in the exact iReal-style shorthand this app already
    uses everywhere else (Guess the Chord's chord bank, every pasted chart) — `parseBarSlots`, not
    a separate per-field chord picker — plus a small symbol keypad (`ChordSymbolKeypad`, shared
    with Guess the Chord's own answer field) for the marks that aren't obvious to type by hand. A
    song built here can be saved straight into the library (the same `importSongs` "Import a
    playlist" itself calls, in a playlist named after the chart's own title) or exported as a
    `jackshed://` chart link (`lib/chartString.ts`) to share or re-import elsewhere — the only two
    ways a chart leaves this modal. */
export default function ChordChartEditor({
  onSave,
  onClose,
}: {
  onSave: (song: IRealSong) => Promise<unknown>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [composer, setComposer] = useState("");
  const [style, setStyle] = useState("");
  const [key, setKey] = useState("");
  const [top, setTop] = useState(4);
  const [bottom, setBottom] = useState(4);
  const [bars, setBars] = useState<string[]>(() => Array(STARTING_BARS).fill(""));

  // Which bar is currently "open" — shown as a plain-text input (raw shorthand) instead of its
  // rendered chord symbols, and where the keypad inserts. Persists once set (clicking elsewhere
  // on the page, e.g. the Title field, doesn't quietly revert it) — only clicking a *different*
  // bar, adding one, or stepping to the next with Enter ever moves it. Always a valid index, never
  // `null`: there's always exactly one "current" bar, the same way a text cursor always sits
  // somewhere, so the keypad always has somewhere to insert into.
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Set right before a bar is added or a different one is clicked into; a `useEffect` (below)
  // focuses that bar's <input> once it's actually rendered as one (it doesn't exist in the DOM
  // yet the same tick `setActiveIndex` is called), then clears this.
  const focusIndexRef = useRef<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const i = focusIndexRef.current;
    if (i === null) return;
    focusIndexRef.current = null;
    inputRefs.current[i]?.focus();
  }, [activeIndex, bars.length]);

  const song: IRealSong = {
    title: title.trim(),
    composer: composer.trim(),
    style: style.trim(),
    key: key.trim(),
    timeSignature: { top, bottom },
    bars: bars.map((text) => ({ content: { kind: "chords", slots: parseBarSlots(text) } })),
  };

  function updateBar(index: number, text: string) {
    setBars((prev) => prev.map((t, i) => (i === index ? text : t)));
  }

  function activateBar(index: number) {
    focusIndexRef.current = index;
    setActiveIndex(index);
  }

  function addBar() {
    const newIndex = bars.length;
    focusIndexRef.current = newIndex;
    setActiveIndex(newIndex);
    setBars((prev) => [...prev, ""]);
  }

  function removeBar(index: number) {
    if (bars.length <= 1) return;
    const next = bars.filter((_, i) => i !== index);
    setBars(next);
    setActiveIndex((i) => Math.min(i, next.length - 1));
  }

  /** Pressing Enter in the last bar adds a new one and jumps straight into it, so typing a whole
      chart can stay a straight line of "type, Enter, type, Enter..." without reaching for the "Add
      bar" button each time. In any other bar, Enter just jumps to the next one. Escape, deliberately,
      does *not* bubble up to this modal's own Escape-closes-everything handler here (`stopPropagation`)
      — it only blurs the current bar, since losing the whole chart because Escape was meant to back
      out of one bar's edit would be a bad trade. */
  function handleBarKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === bars.length - 1) addBar();
      else activateBar(index + 1);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      e.currentTarget.blur();
    }
  }

  /** Inserts a keypad key's text at the active bar's current cursor position — identical logic to
      Guess the Chord's own `insertSymbol`, just targeting whichever bar is currently active instead
      of a single fixed answer field. */
  function insertSymbol(text: string) {
    const el = inputRefs.current[activeIndex];
    const current = bars[activeIndex] ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    updateBar(activeIndex, next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  async function handleSave() {
    if (!song.title) {
      setError("Give this chord chart a title.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(song);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that chord chart.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    if (!song.title) {
      setError("Give this chord chart a title first.");
      return;
    }
    setError(null);
    setCopied(false);
    setExported(encodeChartString({ name: song.title, songs: [song] }));
  }

  async function handleCopy() {
    if (!exported) return;
    try {
      await navigator.clipboard.writeText(exported);
      setCopied(true);
    } catch {
      // Clipboard permission denied or unavailable — the text is still visible and selectable
      // by hand in the textarea below, so this isn't a dead end, just a smaller convenience lost.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Create a chord chart"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 text-left text-foreground shadow-2xl shadow-black/20 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Create a chord chart</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tune name"
              className="rounded-lg bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Composer</span>
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Optional"
              className="rounded-lg bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Style</span>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Optional — e.g. Medium Swing"
              className="rounded-lg bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Key &amp; time signature</span>
            <div className="flex items-center gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Key — e.g. Bb"
                className="min-w-0 flex-1 rounded-lg bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <NumberField
                label="Beats per bar"
                value={top}
                min={1}
                max={32}
                onChange={setTop}
                className="w-14 rounded-lg bg-background px-2 py-2 text-center tabular-nums outline-none focus:ring-2 focus:ring-accent"
              />
              <span className="text-muted">/</span>
              <NumberField
                label="Beat unit"
                value={bottom}
                min={1}
                max={32}
                onChange={setBottom}
                className="w-14 rounded-lg bg-background px-2 py-2 text-center tabular-nums outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            Click a bar to type its chords — <code>C^7</code>, <code>F-7</code>,{" "}
            <code>Bb7#5/D</code>, <code>NC</code> for no chord, or two chords separated by a
            space. Press Enter to move to the next bar.
          </p>
          <div className="overflow-x-auto rounded-2xl bg-background p-3">
            <div className="flex w-max flex-wrap">
              {bars.map((text, i) => (
                <BarCellEditor
                  key={i}
                  index={i}
                  text={text}
                  isActive={activeIndex === i}
                  isFirst={i === 0}
                  isLast={i === bars.length - 1}
                  canRemove={bars.length > 1}
                  timeSignature={i === 0 ? { top, bottom } : undefined}
                  onActivate={() => activateBar(i)}
                  onChange={(t) => updateBar(i, t)}
                  onRemove={() => removeBar(i)}
                  onKeyDown={(e) => handleBarKeyDown(i, e)}
                  inputRef={(el) => {
                    inputRefs.current[i] = el;
                  }}
                />
              ))}
              <button
                type="button"
                onClick={addBar}
                aria-label="Add bar"
                title="Add bar"
                className="flex shrink-0 items-center justify-center text-muted hover:bg-surface-hover hover:text-foreground"
                style={{ width: "3.5rem", height: BAR_HEIGHT }}
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <ChordSymbolKeypad onInsert={insertSymbol} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {exported && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted">Chart link</span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-lg bg-surface px-3 py-1 text-xs font-medium hover:bg-surface-hover"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              value={exported}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full resize-y rounded-lg bg-surface p-2 text-left font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-background pt-4">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Export as chart link
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save to library"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One bar, styled and sized exactly like `ChordChart.tsx`'s own `BarCell` (the same `COL_WIDTH`/
    `BAR_HEIGHT`/barline treatment), so the grid this builds reads as "the chart," not a form. Not
    active: shows its chords rendered through the real `ChordLabel`/`FitChordRow` — the same
    components the actual chart uses — or a faint dot if it's still blank. Active: a plain-text
    `<input>` showing the raw shorthand, so what's actually being typed is visible while you type
    it (auto-converting it live into the pretty symbols mid-keystroke would fight the cursor). */
function BarCellEditor({
  index,
  text,
  isActive,
  isFirst,
  isLast,
  canRemove,
  timeSignature,
  onActivate,
  onChange,
  onRemove,
  onKeyDown,
  inputRef,
}: {
  index: number;
  text: string;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  timeSignature?: { top: number; bottom: number };
  onActivate: () => void;
  onChange: (text: string) => void;
  onRemove: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const leftBorder = isFirst ? "border-l-4 border-foreground" : "border-l border-muted/40";
  const rightBorder = isLast ? "border-r-4 border-foreground" : "border-r border-muted/40";
  const slots = parseBarSlots(text);

  return (
    <div
      className={`group relative flex shrink-0 items-center justify-center gap-1 px-0.5 ${leftBorder} ${rightBorder}`}
      style={{ width: COL_WIDTH, height: BAR_HEIGHT }}
    >
      <span className="pointer-events-none absolute left-1 top-1 text-[0.6rem] tabular-nums text-muted/50">
        {index + 1}
      </span>
      {canRemove && (
        <button
          type="button"
          aria-label={`Remove bar ${index + 1}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-muted opacity-0 hover:bg-surface-hover hover:text-danger group-hover:opacity-100"
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      )}
      {timeSignature && <TimeSignatureGlyph timeSignature={timeSignature} />}
      {isActive ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="C^7"
          className={`w-full min-w-0 bg-transparent text-center outline-none ${chordFont.className}`}
          style={{ fontSize: QUALITY_SIZE }}
        />
      ) : (
        <button
          type="button"
          onClick={onActivate}
          className="flex h-full w-full min-w-0 items-center justify-center"
        >
          {slots.length > 0 ? (
            <FitChordRow>
              {slots.map((slot, i) => (
                <ChordLabel key={i} slot={slot} />
              ))}
            </FitChordRow>
          ) : (
            <span className="text-muted/40">·</span>
          )}
        </button>
      )}
    </div>
  );
}
