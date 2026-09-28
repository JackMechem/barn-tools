"use client";

import { useEffect, useRef, useState } from "react";
import BeatIndicator from "@/components/BeatIndicator";
import PanelsToggle from "@/components/PanelsToggle";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import {
  MeterOptions,
  SoundOptions,
  TempoHero,
} from "@/components/MeterFields";
import { MeterIcon, SpeakerIcon } from "@/components/tools";
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
  nearestNoteValue,
  useTapTempo,
} from "@/lib/meterControls";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { useSpaceToggle } from "@/lib/useSpaceToggle";

const DEFAULT_BPM = 100;

const PANEL_IDS = ["meter", "metronome-sound"];
const SETTINGS_KEY = "jam-practice-metronome";
const DEFAULT_SETTINGS = {
  bpm: DEFAULT_BPM,
  beatsPerBar: 4,
  beatUnit: 4,
  accents: [2, 1, 1, 1] as BeatLevel[],
  subdivision: 1,
  volume: 0.8,
  soundId: DEFAULT_CLICK_SOUND_ID,
};

export default function Metronome() {
  const [settings, updateSettings] = usePersistedSettings(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  );
  const bpm = clampBpm(settings.bpm);
  const beatsPerBar = Math.min(
    MAX_BEATS,
    Math.max(1, Math.round(settings.beatsPerBar)),
  );
  const beatUnit = nearestNoteValue(settings.beatUnit);
  const { subdivision, volume, soundId } = settings;
  const accents = defaultAccents(beatsPerBar, settings.accents);
  const setBpm = (value: number) => updateSettings({ bpm: clampBpm(value) });
  const setBeatUnit = (beatUnit: number) => updateSettings({ beatUnit });
  const setSubdivision = (subdivision: number) =>
    updateSettings({ subdivision });
  const setVolume = (volume: number) => updateSettings({ volume });
  const setSoundId = (soundId: string) => updateSettings({ soundId });
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<number | null>(null);

  const engineRef = useRef<ClickEngine | null>(null);
  const settingsRef = useRef({
    bpm,
    beatsPerBar,
    accents,
    subdivision,
    volume,
    soundId,
  });

  useEffect(() => {
    settingsRef.current = {
      bpm,
      beatsPerBar,
      accents,
      subdivision,
      volume,
      soundId,
    };
  }, [bpm, beatsPerBar, accents, subdivision, volume, soundId]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  function start() {
    engineRef.current?.stop();
    engineRef.current = startClickEngine([
      { getSettings: () => settingsRef.current, onBeat: setCurrentBeat },
    ]);
    setRunning(true);
  }

  function stop() {
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
    setCurrentBeat(null);
  }

  useSpaceToggle(running ? stop : start);
  const tap = useTapTempo(setBpm);

  function changeBeats(n: number) {
    updateSettings({ beatsPerBar: n, accents: defaultAccents(n, accents) });
  }

  function applySignature(beats: number, unit: number, groups: number[]) {
    updateSettings({
      beatsPerBar: beats,
      beatUnit: unit,
      accents: accentsFromGroups(groups),
    });
  }

  function cycleBeat(index: number) {
    updateSettings({
      accents: accents.map((level, i) =>
        i === index ? NEXT_LEVEL[level] : level,
      ),
    });
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
            <MeterOptions
              beatsPerBar={beatsPerBar}
              beatUnit={beatUnit}
              accents={accents}
              subdivision={subdivision}
              onChangeBeats={changeBeats}
              onApplySignature={applySignature}
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
          beatsPerBar={beatsPerBar}
          beatUnit={beatUnit}
          onTap={tap}
        />
        <BeatIndicator
          accents={accents}
          currentBeat={running ? currentBeat : null}
          onCycle={cycleBeat}
        />
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
