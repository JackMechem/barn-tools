"use client";

import { useEffect, useRef, useState } from "react";
import { CUSTOM_INSTRUMENT_ID, INSTRUMENTS } from "@/lib/instruments";
import { parseRange, randomNoteInRange } from "@/lib/noteRange";

const MIN_INTERVAL_SECONDS = 0.5;
const DEFAULT_INTERVAL_SECONDS = 3;

export default function NoteTrainer() {
  const [instrumentId, setInstrumentId] = useState(INSTRUMENTS[0].id);
  const [customRange, setCustomRange] = useState("A1-A6");
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCustom = instrumentId === CUSTOM_INSTRUMENT_ID;
  const rangeInput = isCustom
    ? customRange
    : (INSTRUMENTS.find((i) => i.id === instrumentId)?.range ?? "");

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }

  function start() {
    const range = parseRange(rangeInput);
    if (!range) {
      setError('Enter a valid range like "A1-A6".');
      return;
    }
    setError(null);
    if (intervalRef.current) clearInterval(intervalRef.current);

    setNote(randomNoteInRange(range));
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setNote(randomNoteInRange(range));
    }, Math.max(MIN_INTERVAL_SECONDS, intervalSeconds) * 1000);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center sm:px-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted">
            Note Trainer
          </p>
          <h1 className="text-6xl font-bold tabular-nums sm:text-7xl">
            {note ?? "—"}
          </h1>
        </div>

        <div className="flex w-full flex-col gap-4 rounded-2xl bg-surface p-4 text-left sm:p-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Instrument</span>
            <select
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              disabled={running}
              className="rounded-lg bg-background px-3 py-2 text-foreground disabled:opacity-60"
            >
              {INSTRUMENTS.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.label} ({instrument.range})
                </option>
              ))}
              <option value={CUSTOM_INSTRUMENT_ID}>Custom range…</option>
            </select>
          </label>

          {isCustom && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Custom range</span>
              <input
                type="text"
                value={customRange}
                onChange={(e) => setCustomRange(e.target.value)}
                disabled={running}
                placeholder="A1-A6"
                className="rounded-lg bg-background px-3 py-2 text-foreground disabled:opacity-60"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Interval (seconds)</span>
            <input
              type="number"
              min={MIN_INTERVAL_SECONDS}
              step={0.5}
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              disabled={running}
              className="rounded-lg bg-background px-3 py-2 text-foreground disabled:opacity-60"
            />
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={running ? stop : start}
          className={`rounded-full px-8 py-3 text-base font-semibold transition-colors ${
            running
              ? "bg-surface hover:bg-surface-hover"
              : "bg-accent text-accent-foreground hover:bg-accent-hover"
          }`}
        >
          {running ? "Stop" : "Start"}
        </button>
      </main>
    </div>
  );
}
