"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChordChart from "@/components/ChordChart";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import Hint from "@/components/Hint";
import Select from "@/components/Select";
import ToolLayout from "@/components/ToolLayout";
import {
  BookIcon,
  ListIcon,
  SearchIcon,
  SlidersIcon,
  TrashIcon,
} from "@/components/tools";
import {
  formatComposer,
  parseIrealPlaylist,
  type IRealSong,
} from "@/lib/iRealPro";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { useSyncedSettings } from "@/lib/useSyncedSettings";

type StoredSong = IRealSong & { id: string };

const LIBRARY_KEY = "jam-practice-chord-charts-library";
const LIBRARY_DEFAULTS: { songs: StoredSong[] } = { songs: [] };

const VIEW_KEY = "jam-practice-chord-charts-view";
const VIEW_DEFAULTS = { selectedId: "", barsPerRow: 4 };

const BARS_PER_ROW_OPTIONS = [2, 3, 4, 6, 8];

function songKey(song: IRealSong) {
  return `${song.title.toLowerCase()}__${song.composer.toLowerCase()}__${song.key.toLowerCase()}`;
}

export default function ChordCharts() {
  // Imported songs are this tool's real data, so they sync to the account when signed in
  // (useSyncedSettings). barsPerRow/selectedId are a device-local display preference, not
  // meaningfully "saved data" to follow across devices, so they stay on plain usePersistedSettings
  // — unaffected by sign-in state, matching the same cosmetic-vs-data split this file already
  // drew between these two keys before sync existed at all.
  const [{ songs }, updateLibrary] = useSyncedSettings(LIBRARY_KEY, LIBRARY_DEFAULTS);
  const [{ selectedId, barsPerRow }, updateView] = usePersistedSettings(
    VIEW_KEY,
    VIEW_DEFAULTS,
  );

  const [linkText, setLinkText] = useState("");
  const [status, setStatus] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = songs.find((s) => s.id === selectedId) ?? null;
  const sorted = useMemo(
    () => [...songs].sort((a, b) => a.title.localeCompare(b.title)),
    [songs],
  );

  function importText(text: string) {
    let playlist;
    try {
      playlist = parseIrealPlaylist(text);
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Couldn't read that link.",
      });
      return;
    }
    const existingKeys = new Set(songs.map(songKey));
    const additions: StoredSong[] = [];
    for (const song of playlist.songs) {
      const key = songKey(song);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      additions.push({
        ...song,
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : key,
      });
    }
    updateLibrary({ songs: [...songs, ...additions] });
    const skipped = playlist.songs.length - additions.length;
    setStatus({
      kind: "ok",
      message:
        `Imported ${additions.length} song${additions.length === 1 ? "" : "s"} from "${playlist.name}".` +
        (skipped > 0 ? ` (${skipped} already in your library.)` : ""),
    });
    setLinkText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") importText(reader.result);
    };
    reader.onerror = () =>
      setStatus({ kind: "error", message: "Couldn't read that file." });
    reader.readAsText(file);
  }

  function deleteSong(id: string) {
    updateLibrary({ songs: songs.filter((s) => s.id !== id) });
    if (selectedId === id) updateView({ selectedId: "" });
  }

  return (
    <ToolLayout title="Chord Charts" layout="stacked" topAligned options={null}>
      <div className="flex w-full flex-1 flex-col gap-4 overflow-x-hidden xl:min-h-[calc(100vh-10rem)] xl:flex-row xl:items-center">
        <div className="flex w-full min-w-0 flex-col gap-3 xl:w-80 xl:shrink-0">
          <CollapsiblePanel
            id="chord-charts-tunes"
            title={`Tunes${songs.length ? ` (${songs.length})` : ""}`}
            icon={ListIcon}
            action={
              <>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={songs.length === 0}
                  aria-label="Clear all tunes"
                  title="Clear all tunes"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted hover:text-danger disabled:opacity-40"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  disabled={songs.length === 0}
                  aria-label="Search tunes"
                  title="Search tunes"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
                >
                  <SearchIcon className="h-4 w-4" />
                </button>
              </>
            }
          >
            {songs.length === 0 ? (
              <p className="text-sm text-muted">
                No tunes yet. Import a playlist below to get started.
              </p>
            ) : (
              <ul className="flex max-h-[24rem] flex-col gap-0.5 overflow-y-auto pr-1">
                {sorted.map((song) => (
                  <li key={song.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateView({ selectedId: song.id })}
                      className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        song.id === selectedId
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-background"
                      }`}
                    >
                      <span className="block truncate font-medium">
                        {song.title}
                      </span>
                      {song.composer && (
                        <span
                          className={`block truncate text-xs ${
                            song.id === selectedId
                              ? "text-accent-foreground/80"
                              : "text-muted"
                          }`}
                        >
                          {formatComposer(song.composer)}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSong(song.id)}
                      aria-label={`Remove ${song.title}`}
                      title="Remove"
                      className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-danger group-hover:flex"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel
            id="chord-charts-import"
            title="Import a playlist"
            icon={BookIcon}
          >
            <Hint>
              On iRealPro.com, open a playlist from the forums and copy its link
              (it starts with{" "}
              <code className="rounded bg-background px-1">irealb://</code>).
              Paste it below, or choose a text file it was saved to.
            </Hint>
            <textarea
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="irealb://..."
              rows={4}
              className="w-full resize-y rounded-lg bg-background p-2 text-left font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => linkText.trim() && importText(linkText)}
                disabled={!linkText.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                Import
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
              >
                Choose file…
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.html,text/plain,text/html"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
            </div>
            {status && (
              <p
                className={`text-left text-xs ${status.kind === "error" ? "text-danger" : "text-muted"}`}
              >
                {status.message}
              </p>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel
            id="chord-charts-display"
            title="Display"
            icon={SlidersIcon}
          >
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-muted">Bars per row</span>
              <Select
                value={barsPerRow}
                onChange={(v) => updateView({ barsPerRow: v })}
                options={BARS_PER_ROW_OPTIONS.map((n) => ({
                  value: n,
                  label: String(n),
                }))}
                className="min-w-20"
              />
            </label>
            <Hint>How many bars are shown per line before wrapping to the next.</Hint>
          </CollapsiblePanel>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center rounded-2xl bg-background p-4 sm:p-6">
          {selected ? (
            // `container-type: inline-size` turns this box into the reference width the chart's
            // own cqw-based chord sizing measures against, so chords scale to whatever room is
            // actually available here (not the viewport) and never need to force a scrollbar.
            // `overflow-x-auto` stays on as a last-resort safety net for extreme bars-per-row /
            // narrow-screen combinations the sizing clamp can't fully absorb.
            <div
              className="w-full max-w-full overflow-x-auto"
              style={{ containerType: "inline-size" }}
            >
              <ChordChart song={selected} barsPerRow={barsPerRow} />
            </div>
          ) : (
            <p className="text-center text-sm text-muted">
              {songs.length === 0
                ? "Import a playlist to see your first chart here."
                : "Press the search icon to find a tune."}
            </p>
          )}
        </div>
      </div>

      {searchOpen && (
        <TuneSearchPopup
          songs={sorted}
          onSelect={(id) => {
            updateView({ selectedId: id });
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear all tunes?"
          message="This removes every imported chart from this browser. You can re-import a playlist any time."
          confirmLabel="Clear all"
          onConfirm={() => {
            updateLibrary({ songs: [] });
            updateView({ selectedId: "" });
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </ToolLayout>
  );
}

/** A full-screen searchable picker for the imported library, styled and behaving like
    `StandardsPicker` (Jam Practice's "add a tune" popup) — search box up top, arrow keys +
    Enter to jump around and pick, click a row to select it and close. */
function TuneSearchPopup({
  songs,
  onSelect,
  onClose,
}: {
  songs: StoredSong[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.composer.toLowerCase().includes(q),
    );
  }, [songs, query]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(results.length - 1, activeIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) onSelect(target.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-overlay px-4 pt-[10vh] sm:pt-[14vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Search your tunes"
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-surface text-left text-foreground shadow-2xl shadow-black/30 ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-4 border-b border-surface-hover px-5 py-4 sm:px-6 sm:py-5">
          <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={`Search ${songs.length} tunes…`}
            aria-label="Search your tunes"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
          >
            Done
          </button>
        </div>

        <ul
          ref={listRef}
          role="listbox"
          className="max-h-[50dvh] overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <li className="px-4 py-3 text-muted">No tunes match “{query}”</li>
          )}
          {results.map((song, i) => (
            <li
              key={song.id}
              role="option"
              aria-selected={i === activeIndex}
              data-index={i}
              onPointerMove={() => setActive(i)}
              onClick={() => onSelect(song.id)}
              className={`flex cursor-pointer items-center gap-4 rounded-xl px-4 py-3 ${
                i === activeIndex ? "bg-surface-hover" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{song.title}</div>
                <div className="truncate text-xs text-muted">
                  {formatComposer(song.composer)} · {song.key} · {song.style}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
