"use client";

import { useEffect, useRef, useState } from "react";
import BeatIndicator from "@/components/BeatIndicator";
import PanelsToggle from "@/components/PanelsToggle";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import Hint from "@/components/Hint";
import Select from "@/components/Select";
import SwitchRow from "@/components/SwitchRow";
import {
  MeterOptions,
  SOUND_OPTIONS,
  SoundOptions,
  SteppedField,
  TempoHero,
} from "@/components/MeterFields";
import { MeterIcon, ShuffleIcon, SpeakerIcon } from "@/components/tools";
import ToolLayout from "@/components/ToolLayout";
import KeyHint from "@/components/KeyHint";
import {
  BeatLevel,
  ClickEngine,
  DEFAULT_CLICK_SOUND_ID,
  startClickEngine,
} from "@/lib/clickEngine";
import { MAX_BEATS } from "@/lib/meters";
import {
  NEXT_LEVEL,
  accentsFromGroups,
  clampBpm,
  defaultAccents,
  defaultSubAccents,
  nearestNoteValue,
  useTapTempo,
} from "@/lib/meterControls";
import { MODULATIONS, Phase, planModulation } from "@/lib/metricModulation";
import { useSyncedSettings } from "@/lib/useSyncedSettings";
import { useSpaceToggle } from "@/lib/useSpaceToggle";

const DEFAULT_BPM = 100;
const MIN_BARS_PER_MODULATION = 1;
const MAX_BARS_PER_MODULATION = 32;

type LogEntry = { id: number; from: number; to: number; label: string };

/** The "3:2 polyrhythm" part of a "3:2 polyrhythm — quarter = dotted quarter" label. */
function ratioPart(label: string) {
  return label.split(" — ")[0];
}

/** Just "3:2", for compact spots (toggle chips, log rows) that don't have room to spell it out. */
function shortRatio(label: string) {
  return label.split(" ")[0];
}

const PANEL_IDS = ["meter", "modulation", "reference", "metronome-sound"];
const SETTINGS_KEY = "jam-practice-metric-modulation";
const DEFAULT_SETTINGS = {
  bpm: DEFAULT_BPM,
  beatsPerBar: 4,
  beatUnit: 4,
  accents: [2, 1, 1, 1] as BeatLevel[],
  subdivision: 1,
  subAccents: [] as BeatLevel[],
  volume: 0.8,
  soundId: DEFAULT_CLICK_SOUND_ID,
  minBarsPerModulation: 4,
  matchToRealignment: false,
  enabledRatios: MODULATIONS.map((m) => m.id),
  avoidRepeat: true,
  returnToOriginal: false,
  playOriginalTempo: false,
  referenceMuted: false,
  // A different tone than the main click by default, so the two are easy to tell apart.
  referenceSoundId: "wood",
};

export default function RandomMetricModulation() {
  const [settings, updateSettings] = useSyncedSettings(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  );
  const bpm = clampBpm(settings.bpm);
  // The exact (unrounded) tempo used for scheduling and for chaining modulation math — `bpm`
  // above is the rounded, persisted, displayed value. Keeping the real one at full precision
  // stops rounding error from compounding across a run's worth of modulations and pulling the
  // reference click out of sync with what the ratios actually predict.
  const preciseBpmRef = useRef(bpm);
  const beatsPerBar = Math.min(
    MAX_BEATS,
    Math.max(1, Math.round(settings.beatsPerBar)),
  );
  const beatUnit = nearestNoteValue(settings.beatUnit);
  const {
    subdivision,
    volume,
    soundId,
    avoidRepeat,
    returnToOriginal,
    playOriginalTempo,
    referenceMuted,
    referenceSoundId,
    matchToRealignment,
  } = settings;
  const accents = defaultAccents(beatsPerBar, settings.accents);
  const subAccents = defaultSubAccents(beatsPerBar, subdivision, settings.subAccents);
  const minBarsPerModulation = Math.min(
    MAX_BARS_PER_MODULATION,
    Math.max(
      MIN_BARS_PER_MODULATION,
      Math.round(settings.minBarsPerModulation),
    ),
  );
  const enabledRatios = settings.enabledRatios.filter((id) =>
    MODULATIONS.some((m) => m.id === id),
  );

  const setBpm = (value: number) => {
    const clamped = clampBpm(value);
    // A manual tempo change always resets to a clean integer, same as the persisted value.
    preciseBpmRef.current = clamped;
    setPreciseBpmDisplay(clamped);
    updateSettings({ bpm: clamped });
  };
  const setBeatUnit = (beatUnit: number) => updateSettings({ beatUnit });
  const setSubdivision = (subdivision: number) =>
    updateSettings({ subdivision });
  const setVolume = (volume: number) => updateSettings({ volume });
  const setSoundId = (soundId: string) => updateSettings({ soundId });
  const setMinBarsPerModulation = (minBarsPerModulation: number) =>
    updateSettings({ minBarsPerModulation });
  const setMatchToRealignment = (matchToRealignment: boolean) =>
    updateSettings({ matchToRealignment });
  const setAvoidRepeat = (avoidRepeat: boolean) =>
    updateSettings({ avoidRepeat });
  const setReturnToOriginal = (returnToOriginal: boolean) =>
    updateSettings({ returnToOriginal });
  // Turning the previous-tempo click on also forces "Play until tempos realign" on — that's what
  // guarantees the reference click's predicted realignment (see the comment further down, near
  // where that's computed) actually stays true rather than drifting out of sync with the main
  // click, so the two toggles aren't independently choosable while this one's on. Turning it back
  // off just lifts that restriction — matchToRealignment stays however it was left, not reset.
  const setPlayOriginalTempo = (playOriginalTempo: boolean) =>
    updateSettings(
      playOriginalTempo ? { playOriginalTempo, matchToRealignment: true } : { playOriginalTempo },
    );
  const setReferenceMuted = (referenceMuted: boolean) =>
    updateSettings({ referenceMuted });
  const setReferenceSoundId = (referenceSoundId: string) =>
    updateSettings({ referenceSoundId });
  const toggleRatio = (id: string) =>
    updateSettings({
      enabledRatios: enabledRatios.includes(id)
        ? enabledRatios.filter((r) => r !== id)
        : [...enabledRatios, id],
    });

  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [currentSub, setCurrentSub] = useState(0);
  const [referenceBeat, setReferenceBeat] = useState<number | null>(null);
  const [referenceBpmDisplay, setReferenceBpmDisplay] = useState(bpm);
  // Mirrors preciseBpmRef for the render-time read in TempoHero; the ref itself is only read
  // from the click engine's callback, which runs outside render.
  const [preciseBpmDisplay, setPreciseBpmDisplay] = useState(bpm);
  const [barsIntoInterval, setBarsIntoInterval] = useState(0);
  const [effectiveBars, setEffectiveBars] = useState(minBarsPerModulation);
  const [lastModulation, setLastModulation] = useState<LogEntry | null>(null);
  const [nextPreview, setNextPreview] = useState<{
    toBpm: number;
    label: string;
    barsToRealign: number | null;
    quarterEquivalent: string | null;
  } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const engineRef = useRef<ClickEngine | null>(null);
  const settingsRef = useRef({
    bpm,
    beatsPerBar,
    accents,
    subdivision,
    subAccents,
    volume,
    soundId,
  });
  // A second click track that runs alongside the main one (off the same engine, see `start()`),
  // keeping a reference pulse going the whole time (see `referenceBpmRef` below for what tempo
  // it actually tracks), so you can hear it against whatever the main click has modulated to.
  // Always locked to `subdivision: 1` (see the `setSubdivision`/`SUBDIVISIONS` options, which only
  // ever apply to the main click), so it never has any subdivision dots/accents of its own.
  const referenceSettingsRef = useRef({
    bpm,
    beatsPerBar,
    accents,
    subdivision: 1,
    subAccents: [] as BeatLevel[],
    volume: referenceMuted ? 0 : volume,
    soundId: referenceSoundId,
  });
  // A new bar is detected inside `getSettings`, right as the engine schedules its first beat —
  // these track where we are in the current modulation interval without their own scheduler.
  const barsSinceModRef = useRef(0);
  // How many bars the *current* interval lasts: the fixed setting, or (with "match to
  // realignment" on) however many bars it takes the new tempo to land back on a downbeat with
  // the reference tempo — never fewer than the minimum, even then.
  const effectiveBarsRef = useRef(minBarsPerModulation);
  const seenFirstBeatRef = useRef(false);
  const lastRatioIdRef = useRef<string | null>(null);
  // The tempo this run started at, so "return to original" has something to return to.
  const originalBpmRef = useRef(bpm);
  // What the reference click is currently ticking at: pinned to the original tempo when
  // "return to original" is on, or the tempo just left behind (updated on every modulation)
  // when it's off, so it's always one step behind the main click instead of stuck at the start.
  const referenceBpmRef = useRef(bpm);
  const phaseRef = useRef<Phase>("home");
  // The modulation that's queued up to happen at the next bar boundary, precomputed one step
  // ahead so it can be shown before it happens.
  const upcomingRef = useRef<ReturnType<typeof planModulation> | null>(null);
  const logIdRef = useRef(0);

  useEffect(() => {
    settingsRef.current = {
      bpm: preciseBpmRef.current,
      beatsPerBar,
      accents,
      subdivision,
      subAccents,
      volume,
      soundId,
    };
  }, [bpm, beatsPerBar, accents, subdivision, subAccents, volume, soundId]);

  useEffect(() => {
    // The reference click's tempo itself comes from `referenceBpmRef` (updated on modulation,
    // not by React state); everything else about it can still change live, same as the main click.
    referenceSettingsRef.current = {
      bpm: referenceBpmRef.current,
      beatsPerBar,
      accents,
      subdivision: 1,
      subAccents: [],
      volume: referenceMuted ? 0 : volume,
      soundId: referenceSoundId,
    };
  }, [beatsPerBar, accents, volume, referenceMuted, referenceSoundId]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  /** Precomputes the modulation for the bar after next, and mirrors it to state for display. */
  function queueNext(fromBpm: number) {
    const plan = planModulation(
      fromBpm,
      originalBpmRef.current,
      returnToOriginal,
      phaseRef.current,
      enabledRatios,
      avoidRepeat ? lastRatioIdRef.current : null,
    );
    upcomingRef.current = plan;
    setNextPreview({
      toBpm: plan.toBpm,
      label: plan.label,
      barsToRealign: plan.barsToRealign,
      quarterEquivalent: plan.quarterEquivalent,
    });
  }

  /**
   * Called by the click engine right as it schedules each beat — including, crucially, before it
   * computes the gap to the *next* beat. Applying the modulation here (rather than reacting to
   * `onBeat`, which only fires once a beat is actually heard) means the very first interval after
   * the bar line already reflects the new tempo instead of lagging a beat behind.
   */
  function getSettings(beat: number, sub: number) {
    if (beat === 0 && sub === 0) {
      if (!seenFirstBeatRef.current) {
        // The first beat of the run starts bar 1 — it doesn't complete one.
        seenFirstBeatRef.current = true;
      } else {
        const barsElapsed = barsSinceModRef.current + 1;
        if (barsElapsed < effectiveBarsRef.current) {
          barsSinceModRef.current = barsElapsed;
          setBarsIntoInterval(barsElapsed);
        } else {
          barsSinceModRef.current = 0;
          setBarsIntoInterval(0);
          const plan =
            upcomingRef.current ??
            planModulation(
              settingsRef.current.bpm,
              originalBpmRef.current,
              returnToOriginal,
              phaseRef.current,
              enabledRatios,
              avoidRepeat ? lastRatioIdRef.current : null,
            );
          const fromBpm = settingsRef.current.bpm;
          // Keep the exact tempo for scheduling/chaining, and only round what gets displayed
          // and persisted — rounding the real value here would compound over a run's worth of
          // modulations and pull the reference click's predicted realignment out of true.
          preciseBpmRef.current = plan.toBpm;
          setPreciseBpmDisplay(plan.toBpm);
          settingsRef.current = { ...settingsRef.current, bpm: plan.toBpm };
          updateSettings({ bpm: Math.round(plan.toBpm) });
          if (plan.modulationId) lastRatioIdRef.current = plan.modulationId;
          phaseRef.current = plan.nextPhase;
          const nextBars =
            matchToRealignment && plan.barsToRealign !== null
              ? Math.max(plan.barsToRealign, minBarsPerModulation)
              : minBarsPerModulation;
          effectiveBarsRef.current = nextBars;
          setEffectiveBars(nextBars);
          // Outside "return to original" mode, the reference click follows one step behind the
          // main one — always the tempo just left, not the very first tempo of the run.
          if (!returnToOriginal) {
            referenceBpmRef.current = fromBpm;
            referenceSettingsRef.current = {
              ...referenceSettingsRef.current,
              bpm: fromBpm,
            };
            setReferenceBpmDisplay(fromBpm);
          }
          logIdRef.current++;
          const entry: LogEntry = {
            id: logIdRef.current,
            from: fromBpm,
            to: plan.toBpm,
            label: plan.label,
          };
          setLastModulation(entry);
          setLog((prev) => [...prev, entry].slice(-50));
          queueNext(plan.toBpm);
        }
      }
    }
    return settingsRef.current;
  }

  function start() {
    engineRef.current?.stop();
    barsSinceModRef.current = 0;
    seenFirstBeatRef.current = false;
    lastRatioIdRef.current = null;
    preciseBpmRef.current = bpm;
    setPreciseBpmDisplay(bpm);
    originalBpmRef.current = bpm;
    referenceBpmRef.current = bpm;
    setReferenceBpmDisplay(bpm);
    phaseRef.current = "home";
    effectiveBarsRef.current = minBarsPerModulation;
    setEffectiveBars(minBarsPerModulation);
    setBarsIntoInterval(0);
    setLastModulation(null);
    setLog([]);
    queueNext(bpm);
    // Both tracks run off the same scheduler tick (see `startClickEngine`), so the reference
    // click can only drift from the main one by its own intentional tempo difference — never
    // from browser timer jitter nudging one track's schedule but not the other's.
    const tracks = [
      {
        getSettings,
        onBeat: (beat: number, sub: number) => {
          setCurrentBeat(beat);
          setCurrentSub(sub);
        },
      },
    ];
    if (playOriginalTempo) {
      referenceSettingsRef.current = {
        bpm,
        beatsPerBar,
        accents,
        subdivision: 1,
        subAccents: [],
        volume: referenceMuted ? 0 : volume,
        soundId: referenceSoundId,
      };
      tracks.push({
        getSettings: () => referenceSettingsRef.current,
        onBeat: setReferenceBeat,
      });
    }
    engineRef.current = startClickEngine(tracks);
    setRunning(true);
  }

  function stop() {
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
    setCurrentBeat(null);
    setCurrentSub(0);
    setReferenceBeat(null);
  }

  useSpaceToggle(running ? stop : start);
  const tap = useTapTempo(setBpm);

  function changeBeats(n: number) {
    updateSettings({ beatsPerBar: n, accents: defaultAccents(n, accents) });
  }

  function cycleBeat(index: number) {
    updateSettings({
      accents: accents.map((level, i) =>
        i === index ? NEXT_LEVEL[level] : level,
      ),
    });
  }

  function cycleSub(beatIndex: number, subIndex: number) {
    const dotCount = Math.max(0, Math.round(subdivision) - 1);
    const flatIndex = beatIndex * dotCount + subIndex;
    updateSettings({
      subAccents: subAccents.map((level, i) =>
        i === flatIndex ? NEXT_LEVEL[level] : level,
      ),
    });
  }

  return (
    <ToolLayout
      title="Polyrhythm Metric Modulation Metronome"
      credit="Idea by Rob Moreno"
      sidePanelLabel="Modulations"
      sidePanel={
        log.length > 0 && (
          <CollapsiblePanel
            id="modulation-log"
            title="Modulations"
            icon={ShuffleIcon}
          >
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {[...log].reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 border-b border-background/70 py-2 text-sm last:border-b-0"
                >
                  <span className="text-xs text-muted">
                    {shortRatio(entry.label)}
                  </span>
                  <span className="tabular-nums font-medium">
                    {Math.round(entry.from)} → {Math.round(entry.to)}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLog([])}
              className="self-start text-sm font-medium text-muted hover:text-danger"
            >
              Clear log
            </button>
          </CollapsiblePanel>
        )
      }
      options={
        <>
          <PanelsToggle ids={PANEL_IDS} />

          <CollapsiblePanel
            id="meter"
            title="Meter & subdivision"
            icon={MeterIcon}
          >
            <MeterOptions
              beatsPerBar={beatsPerBar}
              beatUnit={beatUnit}
              accents={accents}
              subdivision={subdivision}
              onChangeBeats={changeBeats}
              onSetBeatUnit={setBeatUnit}
              onSetSubdivision={setSubdivision}
              onApplyGroups={(groups) =>
                updateSettings({
                  beatsPerBar: groups.reduce((a, b) => a + b, 0),
                  accents: accentsFromGroups(groups),
                })
              }
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="modulation"
            title="Modulation"
            icon={ShuffleIcon}
          >
            <SteppedField
              label={
                matchToRealignment
                  ? "Minimum bars between modulations"
                  : "Bars between modulations"
              }
              value={minBarsPerModulation}
              min={MIN_BARS_PER_MODULATION}
              max={MAX_BARS_PER_MODULATION}
              disabled={running}
              layout="row"
              onChange={setMinBarsPerModulation}
              hint={
                matchToRealignment
                  ? "The interval is stretched to at least this many bars if realigning takes longer."
                  : "How many bars play at a tempo before it jumps to the next."
              }
            />

            <SwitchRow
              label="Play until tempos realign"
              checked={matchToRealignment}
              onChange={setMatchToRealignment}
              disabled={running || playOriginalTempo}
              hint={
                playOriginalTempo
                  ? "Extends each interval to however many bars it takes the new tempo to land back on a downbeat with the reference tempo. Required — and locked on — while the previous tempo click is on, so the two stay in sync; turn that off first to change this."
                  : "Extends each interval to however many bars it takes the new tempo to land back on a downbeat with the reference tempo."
              }
            />

            <SwitchRow
              label="Return to original tempo"
              checked={returnToOriginal}
              onChange={setReturnToOriginal}
              disabled={running}
              hint="Alternates modulating away from and back to the tempo you started at, instead of drifting freely to a new one each time."
            />

            <SwitchRow
              label="Avoid repeating the same polyrhythm"
              checked={avoidRepeat}
              onChange={setAvoidRepeat}
              disabled={running}
              hint="Won't pick the same ratio twice in a row."
            />

            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-muted">
                Polyrhythms in the mix
              </span>
              <Hint>Which ratios can be picked for a modulation.</Hint>
              <div className="flex flex-wrap gap-2">
                {MODULATIONS.map((m) => {
                  const on = enabledRatios.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      title={m.label}
                      onClick={() => toggleRatio(m.id)}
                      disabled={running}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors disabled:opacity-50 ${
                        on
                          ? "bg-accent text-accent-foreground"
                          : "bg-background text-muted hover:bg-surface-hover"
                      }`}
                    >
                      {shortRatio(m.label)}
                    </button>
                  );
                })}
              </div>
              {enabledRatios.length === 0 && (
                <p className="text-xs text-muted">
                  None selected — picking from all of them instead.
                </p>
              )}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            id="reference"
            title="Previous tempo click"
            icon={SpeakerIcon}
            toggle={{
              checked: playOriginalTempo,
              onChange: setPlayOriginalTempo,
              disabled: running,
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Tone</span>
              <Select
                value={referenceSoundId}
                onChange={setReferenceSoundId}
                disabled={!playOriginalTempo}
                options={SOUND_OPTIONS}
              />
            </label>
            <Hint>
              A different click sound than the main one, so the two are easy to tell apart.
            </Hint>

            <SwitchRow
              label="Mute"
              checked={referenceMuted}
              onChange={setReferenceMuted}
              disabled={!playOriginalTempo}
              hint="Keeps this second click running silently, still shown and counted, just not heard."
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="metronome-sound"
            title="Sound"
            icon={SpeakerIcon}
          >
            <SoundOptions
              soundId={soundId}
              setSoundId={setSoundId}
              volume={volume}
              setVolume={setVolume}
            />
          </CollapsiblePanel>
        </>
      }
    >
      <div className="flex w-full flex-col items-center gap-4">
        {running && playOriginalTempo && (
          <div className="flex flex-col items-center gap-2 opacity-80">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tabular-nums">
                {Math.round(referenceBpmDisplay)}
              </span>
              <span className="text-xs font-medium text-muted">
                {returnToOriginal ? "Original" : "Previous"} · {beatsPerBar}/
                {beatUnit}
              </span>
            </div>
            <BeatIndicator
              accents={accents}
              currentBeat={referenceBeat}
              size="sm"
            />
          </div>
        )}

        <TempoHero
          bpm={bpm}
          setBpm={setBpm}
          beatsPerBar={beatsPerBar}
          beatUnit={beatUnit}
          onTap={tap}
          locked={running}
          precise={preciseBpmDisplay}
        />
        <BeatIndicator
          accents={accents}
          currentBeat={running ? currentBeat : null}
          onCycle={cycleBeat}
          subdivision={subdivision}
          subAccents={subAccents}
          currentSub={currentSub}
          onCycleSub={cycleSub}
        />

        {running && (
          <p className="text-sm text-muted tabular-nums">
            Bar {barsIntoInterval + 1} of {effectiveBars}
          </p>
        )}

        {running && nextPreview && (
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface px-6 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Next modulation
            </span>
            <span className="text-3xl font-bold tabular-nums text-accent">
              {shortRatio(nextPreview.label)}
            </span>
            <span className="text-sm font-medium tabular-nums">
              {Math.round(nextPreview.toBpm)} BPM
            </span>
          </div>
        )}

        {lastModulation && (
          <p className="text-sm font-medium tabular-nums">
            Modulated {ratioPart(lastModulation.label)}:{" "}
            {Math.round(lastModulation.from)} → {Math.round(lastModulation.to)}{" "}
            BPM
          </p>
        )}
      </div>

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
      <KeyHint>
        Press <KeyHint.Key>Space</KeyHint.Key> to start or stop
      </KeyHint>
    </ToolLayout>
  );
}
