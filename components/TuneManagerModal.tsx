"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { csvToTunes, tunesToCsv } from "@/lib/csv";
import { getServerSnapshot, getSnapshot, setTunes, subscribe } from "@/lib/tunesStore";
import { DEFAULT_TIME_SIGNATURE, Tune, makeId } from "@/lib/types";

const BAR_OPTIONS = [1, 2, 4, 8, 16];
const TABS = ["Tunes", "Add Tune", "Import / Export", "Metronome"] as const;
type Tab = (typeof TABS)[number];

function emptyTune(): Tune {
  return {
    id: makeId(),
    name: "",
    tempos: [],
    keys: [],
    timeSignature: DEFAULT_TIME_SIGNATURE,
    notes: "",
  };
}

type Props = {
  onClose: () => void;
  onDeleteTune: (id: string) => void;
  countOffBars: number;
  setCountOffBars: (n: number) => void;
  accentFirstBeat: boolean;
  setAccentFirstBeat: (b: boolean) => void;
  keepGoingIndefinitely: boolean;
  setKeepGoingIndefinitely: (b: boolean) => void;
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-black/15 transition-colors peer-checked:bg-accent dark:bg-white/15" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
    </span>
  );
}

export default function TuneManagerModal({
  onClose,
  onDeleteTune,
  countOffBars,
  setCountOffBars,
  accentFirstBeat,
  setAccentFirstBeat,
  keepGoingIndefinitely,
  setKeepGoingIndefinitely,
}: Props) {
  const tunes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [tab, setTab] = useState<Tab>("Tunes");
  const [draft, setDraft] = useState<Tune>(emptyTune());
  const [tempoInput, setTempoInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addTempo() {
    const value = Number(tempoInput);
    if (!tempoInput.trim() || Number.isNaN(value) || value <= 0) return;
    setDraft((d) => ({
      ...d,
      tempos: [...d.tempos, { id: makeId(), value, enabled: true }],
    }));
    setTempoInput("");
  }

  function addKey() {
    const value = keyInput.trim();
    if (!value) return;
    setDraft((d) => ({
      ...d,
      keys: [...d.keys, { id: makeId(), value, enabled: true }],
    }));
    setKeyInput("");
  }

  function removeTempo(id: string) {
    setDraft((d) => ({ ...d, tempos: d.tempos.filter((t) => t.id !== id) }));
  }

  function removeKey(id: string) {
    setDraft((d) => ({ ...d, keys: d.keys.filter((k) => k.id !== id) }));
  }

  function saveDraft() {
    if (!draft.name.trim()) return;
    if (editingId) {
      setTunes((prev) => prev.map((t) => (t.id === editingId ? draft : t)));
    } else {
      setTunes((prev) => [...prev, draft]);
    }
    setDraft(emptyTune());
    setEditingId(null);
    setTempoInput("");
    setKeyInput("");
    setTab("Tunes");
  }

  function editTune(tune: Tune) {
    setDraft(tune);
    setEditingId(tune.id);
    setTab("Add Tune");
  }

  function cancelEdit() {
    setDraft(emptyTune());
    setEditingId(null);
    setTempoInput("");
    setKeyInput("");
  }

  function toggleTempoEnabled(tuneId: string, tempoId: string) {
    setTunes((prev) =>
      prev.map((t) =>
        t.id === tuneId
          ? {
              ...t,
              tempos: t.tempos.map((tp) =>
                tp.id === tempoId ? { ...tp, enabled: !tp.enabled } : tp
              ),
            }
          : t
      )
    );
  }

  function toggleKeyEnabled(tuneId: string, keyId: string) {
    setTunes((prev) =>
      prev.map((t) =>
        t.id === tuneId
          ? {
              ...t,
              keys: t.keys.map((k) =>
                k.id === keyId ? { ...k, enabled: !k.enabled } : k
              ),
            }
          : t
      )
    );
  }

  function exportCsv() {
    const csv = tunesToCsv(tunes);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jam-practice-tunes.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const imported = csvToTunes(text);
      setTunes((prev) => [...prev, ...imported]);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-overlay p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-5 sm:px-6">
          <h2 className="text-lg font-semibold">Tunes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full hover:bg-surface-hover sm:h-8 sm:w-8"
          >
            ✕
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pt-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-surface-hover"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {tab === "Tunes" && (
            <div className="flex flex-col gap-3">
              {tunes.length === 0 && (
                <p className="text-sm text-muted">
                  No tunes yet. Add one from the &quot;Add Tune&quot; tab.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {tunes.map((tune) => (
                  <li
                    key={tune.id}
                    className="flex flex-col gap-2 rounded-xl bg-background p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {tune.name}{" "}
                        <span className="font-normal text-muted">
                          ({tune.timeSignature})
                        </span>
                      </span>
                      <div className="-mr-2 flex shrink-0 gap-1">
                        <button
                          onClick={() => editTune(tune)}
                          type="button"
                          className="touch-manipulation rounded-lg px-2 py-1.5 text-sm text-muted hover:text-foreground"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteTune(tune.id)}
                          type="button"
                          className="touch-manipulation rounded-lg px-2 py-1.5 text-sm text-danger hover:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {tune.tempos.length === 0 && (
                        <span className="text-muted">no tempos</span>
                      )}
                      {tune.tempos.map((t) => (
                        <label
                          key={t.id}
                          className={`flex touch-manipulation cursor-pointer items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 ${
                            t.enabled ? "" : "opacity-40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={t.enabled}
                            onChange={() => toggleTempoEnabled(tune.id, t.id)}
                            className="h-3 w-3"
                          />
                          {t.value} BPM
                        </label>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {tune.keys.length === 0 && (
                        <span className="text-muted">no keys</span>
                      )}
                      {tune.keys.map((k) => (
                        <label
                          key={k.id}
                          className={`flex touch-manipulation cursor-pointer items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 ${
                            k.enabled ? "" : "opacity-40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={k.enabled}
                            onChange={() => toggleKeyEnabled(tune.id, k.id)}
                            className="h-3 w-3"
                          />
                          {k.value}
                        </label>
                      ))}
                    </div>

                    {tune.notes && (
                      <p className="whitespace-pre-wrap text-sm text-muted">
                        {tune.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "Add Tune" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Name</label>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g. Autumn Leaves"
                  className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Time Signature</label>
                <input
                  value={draft.timeSignature}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, timeSignature: e.target.value }))
                  }
                  placeholder="e.g. 4/4"
                  list="time-signature-options"
                  className="w-32 rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                />
                <datalist id="time-signature-options">
                  <option value="4/4" />
                  <option value="3/4" />
                  <option value="2/4" />
                  <option value="6/8" />
                  <option value="5/4" />
                  <option value="7/4" />
                </datalist>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tempos (BPM)</label>
                <div className="flex gap-2">
                  <input
                    value={tempoInput}
                    onChange={(e) => setTempoInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addTempo())
                    }
                    type="number"
                    placeholder="e.g. 120"
                    className="w-32 rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={addTempo}
                    type="button"
                    className="rounded-lg bg-background px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    Add tempo
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.tempos.map((t) => (
                    <span
                      key={t.id}
                      className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-sm"
                    >
                      {t.value} BPM
                      <button
                        type="button"
                        onClick={() => removeTempo(t.id)}
                        className="text-danger hover:opacity-80"
                        aria-label={`Remove tempo ${t.value}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Keys</label>
                <div className="flex gap-2">
                  <input
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addKey())
                    }
                    placeholder="e.g. Bb"
                    className="w-32 rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    onClick={addKey}
                    type="button"
                    className="rounded-lg bg-background px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    Add key
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.keys.map((k) => (
                    <span
                      key={k.id}
                      className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-sm"
                    >
                      {k.value}
                      <button
                        type="button"
                        onClick={() => removeKey(k.id)}
                        className="text-danger hover:opacity-80"
                        aria-label={`Remove key ${k.value}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  placeholder="e.g. watch the bridge modulation"
                  rows={3}
                  className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveDraft}
                  disabled={!draft.name.trim()}
                  className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingId ? "Save changes" : "Add tune"}
                </button>
                {editingId && (
                  <button
                    onClick={cancelEdit}
                    type="button"
                    className="rounded-lg bg-background px-4 py-2 hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "Import / Export" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Export your tune list as a CSV file, or import one to add
                tunes in bulk.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportCsv}
                  type="button"
                  className="rounded-lg bg-background px-4 py-2 text-sm hover:bg-surface-hover"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  className="rounded-lg bg-background px-4 py-2 text-sm hover:bg-surface-hover"
                >
                  Import CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {tab === "Metronome" && (
            <div className="flex flex-col gap-5">
              <label className="flex items-center justify-between text-sm font-medium">
                Count-off bars
                <select
                  value={countOffBars}
                  onChange={(e) => setCountOffBars(Number(e.target.value))}
                  className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                >
                  {BAR_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center justify-between text-sm font-medium">
                Accent beat 1
                <Toggle checked={accentFirstBeat} onChange={setAccentFirstBeat} />
              </label>

              <label className="flex cursor-pointer items-center justify-between text-sm font-medium">
                Keep metronome going after count-off
                <Toggle
                  checked={keepGoingIndefinitely}
                  onChange={setKeepGoingIndefinitely}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
