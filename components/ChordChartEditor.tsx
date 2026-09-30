"use client";

import { useEffect, useState } from "react";
import ChordChart from "@/components/ChordChart";
import NumberField from "@/components/NumberField";
import { PlusIcon, TrashIcon } from "@/components/tools";
import { encodeChartString } from "@/lib/chartString";
import { parseBarSlots, type IRealSong } from "@/lib/iRealPro";

const STARTING_BARS = 4;

/** A from-scratch chord chart builder — deliberately simple (a flat list of bars, no repeats,
    endings, sections, or directives the way a pasted iReal chart can have) rather than a full
    editor for every notation feature `ChordChart.tsx` can render. Each bar is typed as plain
    text in the exact iReal-style shorthand this app already uses everywhere else (Guess the
    Chord's chord bank, every pasted chart) — `lib/iRealPro.ts`'s `parseBarSlots`, not a separate
    per-field chord picker — so there's one notation to learn, not two, and the live preview here
    is the same `ChordChart` renderer used everywhere else in this tool, not a separate
    approximation of it. A song built here can be saved straight into the library (the same
    `importSongs` "Import a playlist" itself calls, in a playlist named after the chart's own
    title) or exported as a `jackshed://` chart link (`lib/chartString.ts`) to share or re-import
    elsewhere — the only two ways a chart leaves this modal. */
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
  function removeBar(index: number) {
    setBars((prev) => prev.filter((_, i) => i !== index));
  }
  function addBar() {
    setBars((prev) => [...prev, ""]);
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

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">Bars</h3>
            <p className="text-xs text-muted">
              Type each bar&apos;s chords like <code>C^7</code>, <code>F-7</code>,{" "}
              <code>Bb7#5/D</code>, or <code>NC</code> for no chord — leave a bar blank for empty
              space. Two chords in one bar: separate with a space, like <code>C^7 A7</code>.
            </p>
            <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
              {bars.map((text, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <input
                    value={text}
                    onChange={(e) => updateBar(i, e.target.value)}
                    placeholder="C^7"
                    className="min-w-0 flex-1 rounded-lg bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <button
                    type="button"
                    aria-label={`Remove bar ${i + 1}`}
                    onClick={() => removeBar(i)}
                    disabled={bars.length <= 1}
                    className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-danger disabled:opacity-30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBar}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-background px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <PlusIcon className="h-4 w-4" />
              Add bar
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Preview</h3>
            <div className="rounded-2xl bg-background p-3">
              <ChordChart song={song} barsPerRow={4} />
            </div>
          </div>
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
