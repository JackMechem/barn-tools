"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ThemeToggle from "./ThemeToggle";
import TuneManagerModal from "./TuneManagerModal";
import { CountOff, playCountOff } from "@/lib/metronome";
import { getServerSnapshot, getSnapshot, setTunes, subscribe } from "@/lib/tunesStore";
import { Key, Tempo, Tune } from "@/lib/types";

type PickResult = {
  tune: Tune;
  tempo: Tempo | null;
  key: Key | null;
};

export default function JamPractice() {
  const tunes = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pick, setPick] = useState<PickResult | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [countOffBars, setCountOffBars] = useState(8);
  const [accentFirstBeat, setAccentFirstBeat] = useState(false);
  const [keepGoingIndefinitely, setKeepGoingIndefinitely] = useState(false);

  const countOffRef = useRef<CountOff | null>(null);
  const countOffTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      countOffRef.current?.stop();
      if (countOffTimeoutRef.current) clearTimeout(countOffTimeoutRef.current);
    };
  }, []);

  function stopCountOff() {
    countOffRef.current?.stop();
    countOffRef.current = null;
    if (countOffTimeoutRef.current) {
      clearTimeout(countOffTimeoutRef.current);
      countOffTimeoutRef.current = null;
    }
    setIsCounting(false);
  }

  function pickRandom() {
    if (isModalOpen) return;
    stopCountOff();

    if (tunes.length === 0) {
      setPickError("Add at least one tune to get started.");
      setPick(null);
      return;
    }
    const tune = tunes[Math.floor(Math.random() * tunes.length)];
    const enabledTempos = tune.tempos.filter((t) => t.enabled);
    const enabledKeys = tune.keys.filter((k) => k.enabled);
    const tempo =
      enabledTempos.length > 0
        ? enabledTempos[Math.floor(Math.random() * enabledTempos.length)]
        : null;
    const key =
      enabledKeys.length > 0
        ? enabledKeys[Math.floor(Math.random() * enabledKeys.length)]
        : null;
    setPick({ tune, tempo, key });
    setPickError(null);

    if (tempo) {
      const countOff = playCountOff(
        tempo.value,
        tune.timeSignature,
        countOffBars,
        accentFirstBeat,
        keepGoingIndefinitely
      );
      countOffRef.current = countOff;
      setIsCounting(true);
      if (!keepGoingIndefinitely) {
        countOffTimeoutRef.current = setTimeout(() => {
          countOffRef.current = null;
          countOffTimeoutRef.current = null;
          setIsCounting(false);
        }, countOff.durationMs);
      }
    }
  }

  function handleDeleteTune(id: string) {
    setTunes((prev) => prev.filter((t) => t.id !== id));
    if (pick?.tune.id === id) {
      setPick(null);
      stopCountOff();
    }
  }

  return (
    <div
      className="relative min-h-dvh cursor-pointer touch-manipulation select-none bg-background text-foreground [-webkit-tap-highlight-color:transparent]"
      onClick={pickRandom}
    >
      <header
        className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="cursor-default text-base font-semibold tracking-tight sm:text-lg">
          Jam Practice
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Tunes
          </button>
        </div>
      </header>

      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
        {tunes.length === 0 && !pickError ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl font-semibold">No tunes yet</p>
            <p className="text-muted">
              Open Tunes to add your first one, then click anywhere to pick.
            </p>
          </div>
        ) : pick ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium uppercase tracking-widest text-muted">
              Now practicing
            </p>
            <h1 className="break-words text-4xl font-bold sm:text-5xl">
              {pick.tune.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base text-muted sm:gap-x-6 sm:text-lg">
              <span>
                {pick.tempo ? `${pick.tempo.value} BPM` : "no enabled tempo"}
              </span>
              <span>{pick.key ? pick.key.value : "no enabled key"}</span>
              <span>{pick.tune.timeSignature}</span>
            </div>
            {pick.tune.notes && (
              <p className="max-w-md whitespace-pre-wrap text-sm text-muted">
                {pick.tune.notes}
              </p>
            )}
            {isCounting && (
              <div
                className="mt-4 flex flex-wrap cursor-default items-center justify-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-medium text-accent">
                  {keepGoingIndefinitely
                    ? "Metronome running…"
                    : `Counting off ${countOffBars} bar${countOffBars === 1 ? "" : "s"}…`}
                </span>
                <button
                  type="button"
                  onClick={stopCountOff}
                  className="rounded-full bg-surface px-4 py-2 text-sm hover:bg-surface-hover"
                >
                  Stop
                </button>
              </div>
            )}
            <p className="mt-6 text-sm text-muted">Click anywhere to pick again</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl font-semibold">Click anywhere</p>
            <p className="text-muted">to pick a random tune</p>
          </div>
        )}
        {pickError && <p className="text-sm text-danger">{pickError}</p>}
      </main>

      {isModalOpen && (
        <TuneManagerModal
          onClose={() => setIsModalOpen(false)}
          onDeleteTune={handleDeleteTune}
          countOffBars={countOffBars}
          setCountOffBars={setCountOffBars}
          accentFirstBeat={accentFirstBeat}
          setAccentFirstBeat={setAccentFirstBeat}
          keepGoingIndefinitely={keepGoingIndefinitely}
          setKeepGoingIndefinitely={setKeepGoingIndefinitely}
        />
      )}
    </div>
  );
}
