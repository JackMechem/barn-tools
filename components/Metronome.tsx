"use client";

import { useEffect, useRef, useState } from "react";
import BeatIndicator from "@/components/BeatIndicator";
import PanelsToggle from "@/components/PanelsToggle";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import { MeterIcon, SpeakerIcon, StopwatchIcon } from "@/components/tools";
import ToolLayout from "@/components/ToolLayout";
import KeyHint from "@/components/KeyHint";
import NumberField from "@/components/NumberField";
import Select from "@/components/Select";
import {
  BeatLevel,
  CLICK_SOUNDS,
  ClickEngine,
  DEFAULT_CLICK_SOUND_ID,
  startClickEngine,
} from "@/lib/clickEngine";
import { MAX_BEATS, MAX_BEAT_UNIT, SIGNATURE_PRESETS } from "@/lib/meters";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { useSpaceToggle } from "@/lib/useSpaceToggle";

const MIN_BPM = 20;
const MAX_BPM = 300;
const DEFAULT_BPM = 100;

function accentsFromGroups(groups: number[]): BeatLevel[] {
  return groups.flatMap((size) =>
    Array.from({ length: size }, (_, i): BeatLevel => (i === 0 ? 2 : 1)),
  );
}

/** Lengths of the runs that each start on an accented beat, e.g. accents on 1, 4, 6 of 7 -> [3, 2, 2]. */
function groupsFromAccents(accents: BeatLevel[]): number[] {
  const starts = accents.flatMap((level, i) => (level === 2 ? [i] : []));
  if (starts.length === 0) return [];
  if (starts[0] !== 0) starts.unshift(0);
  return starts.map((start, i) => (starts[i + 1] ?? accents.length) - start);
}

function parseGroups(text: string): number[] | null {
  if (!/^\s*\d+(?:\s*[+,\s]\s*\d+)*\s*$/.test(text)) return null;
  const groups = text
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(Number);
  const total = groups.reduce((a, b) => a + b, 0);
  return groups.every((g) => g >= 1) && total >= 1 && total <= MAX_BEATS ? groups : null;
}

function GroupsField({ value, onApply }: { value: string; onApply: (groups: number[]) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const valid = draft === null || parseGroups(draft) !== null;

  function commit() {
    const groups = draft === null ? null : parseGroups(draft);
    if (groups) onApply(groups);
    setDraft(null);
  }

  return (
    <input
      type="text"
      value={shown}
      placeholder="e.g. 3+2+2"
      aria-label="Accent grouping"
      aria-invalid={!valid}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") setDraft(null);
      }}
      className={`w-full rounded-lg bg-background px-3 py-2 tabular-nums outline-none focus:ring-2 focus:ring-accent ${
        valid ? "" : "text-danger"
      }`}
    />
  );
}
const SOUND_OPTIONS = CLICK_SOUNDS.map((c) => ({ value: c.id, label: c.label }));
const SUBDIVISIONS = [
  { value: 1, label: "Quarter notes (no subdivision)" },
  { value: 2, label: "Eighth notes" },
  { value: 3, label: "Eighth-note triplets" },
  { value: 4, label: "Sixteenth notes" },
  { value: 5, label: "Sixteenth-note quintuplets" },
  { value: 6, label: "Sixteenth-note sextuplets" },
];

/** Engraved notes for a beat split into `count` parts (beamed, with a tuplet number when odd). */
function SubdivisionIcon({ count }: { count: number }) {
  const spacing = 9;
  const width = count === 1 ? 12 : (count - 1) * spacing + 12;
  const beams = count <= 1 ? 0 : count === 2 || count === 3 ? 1 : 2;
  const xs = Array.from({ length: count }, (_, i) => 4 + i * spacing);
  const stemTop = 9;
  const showTuplet = count === 3 || count >= 5;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 28`}
      className="h-7 w-auto"
      style={{ width }}
      fill="currentColor"
    >
      {xs.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={23} rx={3.2} ry={2.4} transform={`rotate(-20 ${x} 23)`} />
          <rect x={x + 2.4} y={stemTop} width={1.2} height={14} />
        </g>
      ))}
      {beams >= 1 && (
        <rect x={xs[0] + 2.4} y={stemTop} width={xs[count - 1] - xs[0] + 1.2} height={2.2} />
      )}
      {beams >= 2 && (
        <rect x={xs[0] + 2.4} y={stemTop + 3.6} width={xs[count - 1] - xs[0] + 1.2} height={2.2} />
      )}
      {showTuplet && (
        <text
          x={(xs[0] + xs[count - 1] + 3.6) / 2}
          y={6.5}
          fontSize={7}
          fontWeight={700}
          textAnchor="middle"
        >
          {count}
        </text>
      )}
    </svg>
  );
}

const TAP_RESET_MS = 2000;
const TAP_HISTORY = 5;

function clampBpm(n: number) {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
}

function defaultAccents(beats: number, previous: BeatLevel[] = []): BeatLevel[] {
  return Array.from({ length: beats }, (_, i) => previous[i] ?? (i === 0 ? 2 : 1));
}

const NEXT_LEVEL: Record<BeatLevel, BeatLevel> = { 2: 1, 1: 0, 0: 2 };

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-xl font-medium hover:bg-surface-hover"
    >
      {children}
    </button>
  );
}

const CUSTOM_METER_DEFAULTS = { open: false };

/** Folded-away advanced meter controls, so the presets are what you see first. */
function CustomMeter({ children }: { children: React.ReactNode }) {
  const [{ open }, update] = usePersistedSettings(
    "jam-practice-custom-meter",
    CUSTOM_METER_DEFAULTS,
  );
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => update({ open: !open })}
        aria-expanded={open}
        aria-controls="custom-meter"
        className="flex items-center gap-1 self-start rounded-lg py-1 text-sm font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        Custom meter
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div
        id="custom-meter"
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 px-1 pb-1 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

const PANEL_IDS = ["tempo", "meter", "metronome-sound"];
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
  const [settings, updateSettings] = usePersistedSettings(SETTINGS_KEY, DEFAULT_SETTINGS);
  const bpm = clampBpm(settings.bpm);
  const beatsPerBar = Math.min(MAX_BEATS, Math.max(1, Math.round(settings.beatsPerBar)));
  const { beatUnit, subdivision, volume, soundId } = settings;
  const accents = defaultAccents(beatsPerBar, settings.accents);
  const setBpm = (value: number) => updateSettings({ bpm: clampBpm(value) });
  const setBeatUnit = (beatUnit: number) => updateSettings({ beatUnit });
  const setSubdivision = (subdivision: number) => updateSettings({ subdivision });
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
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    settingsRef.current = { bpm, beatsPerBar, accents, subdivision, volume, soundId };
  }, [bpm, beatsPerBar, accents, subdivision, volume, soundId]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  function start() {
    engineRef.current?.stop();
    engineRef.current = startClickEngine(() => settingsRef.current, setCurrentBeat);
    setRunning(true);
  }

  function stop() {
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
    setCurrentBeat(null);
  }

  useSpaceToggle(running ? stop : start);

  function changeBeats(n: number) {
    updateSettings({ beatsPerBar: n, accents: defaultAccents(n, accents) });
  }

  function applySignature(beats: number, unit: number, groups: number[]) {
    updateSettings({ beatsPerBar: beats, beatUnit: unit, accents: accentsFromGroups(groups) });
  }

  function cycleBeat(index: number) {
    updateSettings({
      accents: accents.map((level, i) => (i === index ? NEXT_LEVEL[level] : level)),
    });
  }

  function tap() {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length && now - taps[taps.length - 1] > TAP_RESET_MS) taps.length = 0;
    taps.push(now);
    if (taps.length > TAP_HISTORY + 1) taps.shift();
    if (taps.length < 2) return;
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    setBpm(60000 / avg);
  }

  return (
    <ToolLayout
      title="Metronome"
      options={
        <>
          <PanelsToggle ids={PANEL_IDS} />
          <CollapsiblePanel id="tempo" title="Tempo" icon={StopwatchIcon}>
            <label className="flex flex-col gap-2 text-sm">
              <span className="flex items-center justify-between font-medium text-muted">
                Tempo
                <span className="tabular-nums text-foreground">{bpm} BPM</span>
              </span>
              <input
                type="range"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                style={
                  {
                    "--progress": `${((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100}%`,
                  } as React.CSSProperties
                }
                className="slider h-6 w-full cursor-pointer"
              />
            </label>

            <button
              type="button"
              onClick={tap}
              className="rounded-lg bg-background px-3 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Tap tempo
            </button>
          </CollapsiblePanel>

          <CollapsiblePanel id="meter" title="Meter & subdivision" icon={MeterIcon}>
            <div className="flex flex-wrap gap-2">
              {SIGNATURE_PRESETS.map(({ beats, unit, groups }) => (
                <button
                  key={`${beats}/${unit}`}
                  type="button"
                  onClick={() => applySignature(beats, unit, groups)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                    beats === beatsPerBar && unit === beatUnit
                      ? "bg-accent text-accent-foreground"
                      : "bg-background hover:bg-surface-hover"
                  }`}
                >
                  {beats}/{unit}
                </button>
              ))}
            </div>

            <CustomMeter>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Beats per bar</span>
                  <NumberField
                    label="Beats per bar"
                    value={beatsPerBar}
                    min={1}
                    max={MAX_BEATS}
                    onChange={changeBeats}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Beat unit</span>
                  <NumberField
                    label="Beat unit"
                    value={beatUnit}
                    min={1}
                    max={MAX_BEAT_UNIT}
                    onChange={setBeatUnit}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Accent grouping</span>
                <GroupsField
                  key={groupsFromAccents(accents).join("+")}
                  value={groupsFromAccents(accents).join("+")}
                  onApply={(groups) =>
                    updateSettings({
                      beatsPerBar: groups.reduce((a, b) => a + b, 0),
                      accents: accentsFromGroups(groups),
                    })
                  }
                />
              </label>
            </CustomMeter>

            <div className="flex flex-col gap-2 text-sm">
              <span id="subdivision-label" className="font-medium text-muted">
                Subdivision
              </span>
              <div
                role="radiogroup"
                aria-labelledby="subdivision-label"
                className="flex flex-wrap gap-2"
              >
                {SUBDIVISIONS.map(({ value, label }) => {
                  const selected = subdivision === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => setSubdivision(value)}
                      className={`flex h-11 items-center justify-center rounded-lg px-3 transition-colors ${
                        selected
                          ? "bg-accent text-accent-foreground"
                          : "bg-background text-foreground hover:bg-surface-hover"
                      }`}
                    >
                      <SubdivisionIcon count={value} />
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel id="metronome-sound" title="Sound" icon={SpeakerIcon}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Tone</span>
              <Select value={soundId} onChange={setSoundId} options={SOUND_OPTIONS} />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="flex items-center justify-between font-medium text-muted">
                Volume
                <span className="tabular-nums text-foreground">{Math.round(volume * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ "--progress": `${volume * 100}%` } as React.CSSProperties}
                className="slider h-6 w-full cursor-pointer"
              />
            </label>
          </CollapsiblePanel>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-4">
          <StepButton label="Decrease tempo" onClick={() => setBpm(bpm - 1)}>
            −
          </StepButton>
          <div className="flex w-40 flex-col items-center">
            <span className="text-6xl font-bold tabular-nums sm:text-7xl">{bpm}</span>
            <span className="text-sm font-medium text-muted">
              BPM · {beatsPerBar}/{beatUnit}
            </span>
          </div>
          <StepButton label="Increase tempo" onClick={() => setBpm(bpm + 1)}>
            +
          </StepButton>
        </div>

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
