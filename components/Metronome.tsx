"use client";

import { useEffect, useRef, useState } from "react";
import BeatIndicator from "@/components/BeatIndicator";
import PanelsToggle from "@/components/PanelsToggle";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import {
  MeterOptions,
  NoteValueIcon,
  SoundOptions,
  TempoHero,
} from "@/components/MeterFields";
import Select from "@/components/Select";
import StructureEditor from "@/components/StructureEditor";
import SwitchRow from "@/components/SwitchRow";
import { MeterIcon, SpeakerIcon } from "@/components/tools";
import ToolLayout from "@/components/ToolLayout";
import KeyHint from "@/components/KeyHint";
import {
  BeatLevel,
  ClickEngine,
  ClickSettings,
  DEFAULT_CLICK_SOUND_ID,
  startClickEngine,
} from "@/lib/clickEngine";
import { MAX_BEATS } from "@/lib/meters";
import {
  NEXT_LEVEL,
  NOTE_VALUES,
  NOTE_VALUE_NAMES,
  accentsFromGroups,
  clampBpm,
  convertTempo,
  defaultAccents,
  defaultSubAccents,
  nearestNoteValue,
  useTapTempo,
} from "@/lib/meterControls";
import {
  EMPTY_STRUCTURE,
  type Structure,
  cycleSectionAccent,
  cycleSectionSubAccent,
  sectionAt,
} from "@/lib/structure";
import { useSyncedSettings } from "@/lib/useSyncedSettings";
import { useSpaceToggle } from "@/lib/useSpaceToggle";

const DEFAULT_BPM = 100;

// `0` isn't a real note value, so it's a safe sentinel for "match beat unit" (persisted as `null`
// — see DEFAULT_SETTINGS' own comment) in the Select below, which needs a real value either way.
const TEMPO_NOTE_MATCH = 0;
// Short labels for the compact "tempo note value" picker sitting right next to the BPM digits —
// `NOTE_VALUE_NAMES`' own full names ("Quarter note") are used for the longer readout sentence
// below it instead, where there's room to spell it out.
const SHORT_NOTE_NAME: Record<number, string> = {
  1: "Whole",
  2: "Half",
  4: "Quarter",
  8: "Eighth",
  16: "16th",
  32: "32nd",
  64: "64th",
};
const TEMPO_NOTE_OPTIONS = [
  { value: TEMPO_NOTE_MATCH, label: "Beat unit" },
  ...NOTE_VALUES.map((v) => ({
    value: v,
    label: SHORT_NOTE_NAME[v] ?? `1/${v}`,
    icon: <NoteValueIcon value={v} className="h-5 w-2.5" />,
  })),
];

const PANEL_IDS = ["meter", "metronome-sound"];
const SETTINGS_KEY = "jam-practice-metronome";
const DEFAULT_SETTINGS = {
  bpm: DEFAULT_BPM,
  beatsPerBar: 4,
  beatUnit: 4,
  accents: [2, 1, 1, 1] as BeatLevel[],
  subdivision: 1,
  subAccents: [] as BeatLevel[],
  volume: 0.8,
  soundId: DEFAULT_CLICK_SOUND_ID,
  // A "structure" chains bars of *different* meters in a fixed, looping sequence (e.g. 2 bars of
  // 11/8, then a bar of 12/8, then a bar of 15/8) instead of one fixed meter for the whole run —
  // see lib/structure.ts. Off by default; every field above this point keeps behaving exactly as
  // it always has while it's off.
  useStructure: false,
  structure: EMPTY_STRUCTURE as Structure,
  // `null` means "BPM means the meter's own beat unit" (today's behavior, unchanged) — the
  // explicit, persisted override lets the tempo number instead refer to a *different* note value
  // than the beat unit, e.g. "quarter note = 275" while the meter itself is in 4/8 (so the engine
  // actually clicks eighth notes at 550). See `convertTempo` in lib/meterControls.ts.
  tempoNoteValue: null as number | null,
};

export default function Metronome() {
  const [settings, updateSettings] = useSyncedSettings(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  );
  const bpm = clampBpm(settings.bpm);
  const beatsPerBar = Math.min(
    MAX_BEATS,
    Math.max(1, Math.round(settings.beatsPerBar)),
  );
  const beatUnit = nearestNoteValue(settings.beatUnit);
  const { subdivision, volume, soundId, useStructure, structure, tempoNoteValue } = settings;
  const accents = defaultAccents(beatsPerBar, settings.accents);
  const subAccents = defaultSubAccents(beatsPerBar, subdivision, settings.subAccents);
  const setBpm = (value: number) => updateSettings({ bpm: clampBpm(value) });
  const setBeatUnit = (beatUnit: number) => updateSettings({ beatUnit });
  const setSubdivision = (subdivision: number) =>
    updateSettings({ subdivision });
  const setVolume = (volume: number) => updateSettings({ volume });
  const setSoundId = (soundId: string) => updateSettings({ soundId });
  const setUseStructure = (useStructure: boolean) => updateSettings({ useStructure });
  const setStructure = (structure: Structure) => updateSettings({ structure });
  const setTempoNoteValue = (tempoNoteValue: number | null) => updateSettings({ tempoNoteValue });
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);
  const [currentSub, setCurrentSub] = useState(0);
  // Which form entry (and how far into its bars) the structure is currently on — kept separate
  // from `currentBeat`/`currentSub` since those reset to a neutral state on every stop, but a
  // structure's position should also be *editable* (which section's accents you're looking at)
  // while stopped, defaulting to the first form entry (`?? 0` wherever this is read).
  const [structPlayback, setStructPlayback] = useState<{
    formIndex: number;
    barInSection: number;
  } | null>(null);

  const engineRef = useRef<ClickEngine | null>(null);
  // Note: `bpm` here is the *raw, displayed* tempo — whatever note value it actually refers to
  // (the meter's own beat unit, or `tempoNoteValue`'s override) is only resolved down to an actual
  // engine click rate inside `getSettings`, using whichever beat unit is active at that moment
  // (this `beatUnit`, or — in structure mode — the current section's own, which can differ bar to
  // bar). That resolution can't happen here: this ref's `beatUnit` is always the plain meter's.
  const settingsRef = useRef({
    bpm,
    beatsPerBar,
    beatUnit,
    accents,
    subdivision,
    subAccents,
    volume,
    soundId,
    tempoNoteValue,
  });
  // Mutable mirror of the structure-mode settings, read from inside `getSettings` below (which
  // runs off the click engine's own scheduler tick, not a render) — same reason `settingsRef`
  // exists instead of closing over the plain state values directly.
  const structureRef = useRef({ useStructure, structure });
  const structFormIndexRef = useRef(0);
  const structBarsIntoRef = useRef(0);
  const structSeenFirstRef = useRef(false);

  useEffect(() => {
    settingsRef.current = {
      bpm,
      beatsPerBar,
      beatUnit,
      accents,
      subdivision,
      subAccents,
      volume,
      soundId,
      tempoNoteValue,
    };
  }, [bpm, beatsPerBar, beatUnit, accents, subdivision, subAccents, volume, soundId, tempoNoteValue]);

  useEffect(() => {
    structureRef.current = { useStructure, structure };
  }, [useStructure, structure]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  /**
   * Called by the click engine right as it schedules each tick. Off (or with an empty form), this
   * is just `settingsRef.current`'s plain single meter, converted from the displayed tempo to an
   * actual click rate via `tempoNoteValue` (see that field's own comment above). With a structure
   * running, `beat === 0 && sub === 0` (the instant a new bar starts) is when it decides whether
   * the *current* form entry has finished its bar count and, if so, advances to the next one
   * (looping back to the start past the end) — the same "detect a bar boundary inside
   * getSettings, before it computes the gap to the next beat" trick
   * `RandomMetricModulation.tsx` uses to land a tempo change exactly on the bar line, just
   * switching the whole meter instead of the tempo.
   */
  function getSettings(beat: number, sub: number): ClickSettings {
    const base = settingsRef.current;
    const { useStructure: active, structure: struct } = structureRef.current;

    if (!active || struct.form.length === 0) {
      return {
        bpm: base.tempoNoteValue ? convertTempo(base.bpm, base.tempoNoteValue, base.beatUnit) : base.bpm,
        beatsPerBar: base.beatsPerBar,
        accents: base.accents,
        subdivision: base.subdivision,
        subAccents: base.subAccents,
        volume: base.volume,
        soundId: base.soundId,
      };
    }

    if (beat === 0 && sub === 0) {
      if (!structSeenFirstRef.current) {
        // The first beat of the run starts form entry 1 — it doesn't complete one.
        structSeenFirstRef.current = true;
      } else {
        const current = sectionAt(struct, structFormIndexRef.current);
        const barsInSection = current?.bars ?? 1;
        const barsElapsed = structBarsIntoRef.current + 1;
        if (barsElapsed < barsInSection) {
          structBarsIntoRef.current = barsElapsed;
        } else {
          structBarsIntoRef.current = 0;
          structFormIndexRef.current = (structFormIndexRef.current + 1) % struct.form.length;
        }
        setStructPlayback({
          formIndex: structFormIndexRef.current,
          barInSection: structBarsIntoRef.current,
        });
      }
    }

    const section = sectionAt(struct, structFormIndexRef.current);
    if (!section) {
      return {
        bpm: base.tempoNoteValue ? convertTempo(base.bpm, base.tempoNoteValue, base.beatUnit) : base.bpm,
        beatsPerBar: base.beatsPerBar,
        accents: base.accents,
        subdivision: base.subdivision,
        subAccents: base.subAccents,
        volume: base.volume,
        soundId: base.soundId,
      };
    }
    return {
      // Converted using *this section's own* beat unit, not the plain meter's — a structure can
      // (and usually does) move through several different beat units, so "quarter note = 275"
      // yields a different actual click rate in each one.
      bpm: base.tempoNoteValue ? convertTempo(base.bpm, base.tempoNoteValue, section.beatUnit) : base.bpm,
      beatsPerBar: section.beatsPerBar,
      accents: defaultAccents(section.beatsPerBar, section.accents),
      subdivision: section.subdivision,
      subAccents: defaultSubAccents(section.beatsPerBar, section.subdivision, section.subAccents),
      volume: base.volume,
      soundId: base.soundId,
    };
  }

  const canStart = !useStructure || structure.form.length > 0;

  function start() {
    if (!canStart) return;
    engineRef.current?.stop();
    structFormIndexRef.current = 0;
    structBarsIntoRef.current = 0;
    structSeenFirstRef.current = false;
    setStructPlayback({ formIndex: 0, barInSection: 0 });
    engineRef.current = startClickEngine([
      {
        getSettings,
        onBeat: (beat, sub) => {
          setCurrentBeat(beat);
          setCurrentSub(sub);
        },
      },
    ]);
    setRunning(true);
  }

  function stop() {
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
    setCurrentBeat(null);
    setCurrentSub(0);
    setStructPlayback(null);
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

  // While a structure is active and has at least one form entry, the main beat display/edit
  // controls below track whichever section is currently (or was last) playing instead of the
  // plain top-level meter — `?? 0` so there's always something to show/edit even before Start
  // has ever been pressed.
  const activeSection =
    useStructure && structure.form.length > 0
      ? sectionAt(structure, structPlayback?.formIndex ?? 0)
      : null;
  const displayAccents = activeSection
    ? defaultAccents(activeSection.beatsPerBar, activeSection.accents)
    : accents;
  const displaySubdivision = activeSection ? activeSection.subdivision : subdivision;
  const displaySubAccents = activeSection
    ? defaultSubAccents(activeSection.beatsPerBar, activeSection.subdivision, activeSection.subAccents)
    : subAccents;
  // Which beat unit `tempoNoteValue` is currently being converted against — the active section's
  // own in structure mode (it can differ bar to bar), otherwise the plain meter's.
  const effectiveBeatUnit = activeSection?.beatUnit ?? beatUnit;

  function handleCycleBeat(index: number) {
    if (activeSection) {
      setStructure(cycleSectionAccent(structure, activeSection.id, index));
      return;
    }
    cycleBeat(index);
  }

  function handleCycleSub(beatIndex: number, subIndex: number) {
    if (activeSection) {
      setStructure(cycleSectionSubAccent(structure, activeSection.id, beatIndex, subIndex));
      return;
    }
    cycleSub(beatIndex, subIndex);
  }

  return (
    <ToolLayout
      title="Metronome"
      options={
        <>
          <PanelsToggle ids={PANEL_IDS} />

          <CollapsiblePanel
            id="meter"
            title="Meter & subdivision"
            icon={MeterIcon}
          >
            <SwitchRow
              label="Use a structure"
              checked={useStructure}
              onChange={setUseStructure}
              hint="Chain bars of different time signatures in a fixed, looping sequence — e.g. 2 bars of 11/8, then a bar of 12/8, then a bar of 15/8 — instead of one meter for the whole run."
            />
            {useStructure ? (
              <StructureEditor
                structure={structure}
                onChange={setStructure}
                running={running}
                activeFormIndex={structPlayback?.formIndex ?? null}
                playingBeat={currentBeat}
                playingSub={currentSub}
              />
            ) : (
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
            )}
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
        <TempoHero
          bpm={bpm}
          setBpm={setBpm}
          beatsPerBar={activeSection?.beatsPerBar ?? beatsPerBar}
          beatUnit={activeSection?.beatUnit ?? beatUnit}
          onTap={tap}
          aboveNumber={
            <div className="flex items-center gap-1.5">
              <Select
                value={tempoNoteValue ?? TEMPO_NOTE_MATCH}
                onChange={(v) => setTempoNoteValue(v === TEMPO_NOTE_MATCH ? null : v)}
                options={TEMPO_NOTE_OPTIONS}
              />
              <span className="text-lg font-semibold text-muted">=</span>
            </div>
          }
        />
        {tempoNoteValue !== null && tempoNoteValue !== effectiveBeatUnit && (
          <p className="-mt-2 text-xs text-muted">
            = {Math.round(convertTempo(bpm, tempoNoteValue, effectiveBeatUnit))} BPM at{" "}
            {(NOTE_VALUE_NAMES[effectiveBeatUnit] ?? `1/${effectiveBeatUnit} note`).toLowerCase()}{" "}
            clicks
          </p>
        )}
        {useStructure && activeSection && (
          <p className="text-sm font-medium text-muted">
            Section <span className="text-foreground">{activeSection.name}</span> · bar{" "}
            {(structPlayback?.barInSection ?? 0) + 1} of {activeSection.bars}
          </p>
        )}
        {useStructure && !activeSection ? (
          <p className="rounded-xl bg-surface px-4 py-3 text-center text-sm text-muted">
            Add sections and arrange a form below to see beats here.
          </p>
        ) : (
          <BeatIndicator
            accents={displayAccents}
            currentBeat={running ? currentBeat : null}
            onCycle={handleCycleBeat}
            subdivision={displaySubdivision}
            subAccents={displaySubAccents}
            currentSub={currentSub}
            onCycleSub={handleCycleSub}
          />
        )}
      </div>

      <button
        type="button"
        onClick={running ? stop : start}
        disabled={!running && !canStart}
        title={!running && !canStart ? "Add sections and a form first" : undefined}
        className={`rounded-full px-8 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
