"use client";

import { useState } from "react";
import Hint from "@/components/Hint";
import NumberField from "@/components/NumberField";
import Select from "@/components/Select";
import type { BeatLevel } from "@/lib/clickEngine";
import { CLICK_SOUNDS } from "@/lib/clickEngine";
import { MAX_BEATS, SIGNATURE_PRESETS } from "@/lib/meters";
import {
  MAX_BPM,
  MIN_BPM,
  NOTE_VALUES,
  SLIDER_STEPS,
  SUBDIVISIONS,
  bpmFromSlider,
  groupsFromAccents,
  nearestNoteValue,
  parseGroups,
  sliderFromBpm,
  splitTenths,
} from "@/lib/meterControls";

// Shared UI atoms for the Metronome and Polyrhythm Metric Modulation Metronome tools'
// meter/tempo controls.

export const CIRCLE_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-full bg-background text-lg font-semibold leading-none text-foreground hover:bg-surface-hover disabled:opacity-40";
export const CIRCLE_INPUT =
  "h-14 w-14 rounded-full bg-background text-center text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent";

export const SOUND_OPTIONS = CLICK_SOUNDS.map((c) => ({
  value: c.id,
  label: c.label,
}));

export function StepButton({
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

/**
 * A round number field with plus/minus circles for quick adjusting. `layout="stack"` (default)
 * puts them above and below the number; `"row"` puts them on either side of it instead.
 */
export function SteppedField({
  label,
  showLabel = true,
  value,
  min,
  max,
  disabled,
  layout = "stack",
  hint,
  onChange,
}: {
  label: string;
  /** The visible title above the control — off leaves just the +/number/− control itself, still
      using `label` for the individual buttons'/field's own accessible names (via aria-label). */
  showLabel?: boolean;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  layout?: "stack" | "row";
  hint?: string;
  onChange: (value: number) => void;
}) {
  const increase = (
    <button
      type="button"
      aria-label={`Increase ${label}`}
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      className={CIRCLE_BUTTON}
    >
      +
    </button>
  );
  const decrease = (
    <button
      type="button"
      aria-label={`Decrease ${label}`}
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={disabled || value <= min}
      className={CIRCLE_BUTTON}
    >
      −
    </button>
  );
  const field = (
    <NumberField
      label={label}
      value={value}
      min={min}
      max={max}
      onChange={onChange}
      className={CIRCLE_INPUT}
    />
  );

  return (
    <div className="flex flex-col items-center gap-1.5 text-sm">
      {showLabel && <span className="font-medium text-muted">{label}</span>}
      {layout === "row" ? (
        <div className="flex items-center gap-2">
          {decrease}
          {field}
          {increase}
        </div>
      ) : (
        <>
          {increase}
          {field}
          {decrease}
        </>
      )}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

/**
 * Beat unit picker: only steps through actual note values (1, 2, 4, 8...). Typing a non-note
 * number snaps to the nearest one.
 */
export function BeatUnitField({
  value,
  showLabel = true,
  layout = "stack",
  hint,
  onChange,
}: {
  value: number;
  /** Same meaning as `SteppedField`'s own `showLabel` — off hides just the visible "Beat unit"
      title, the field itself keeps its aria-label regardless. */
  showLabel?: boolean;
  /** Mirrors `SteppedField`'s own layout option: `"stack"` (default) puts +/− above and below
      the number; `"row"` puts them on either side of it instead. */
  layout?: "stack" | "row";
  hint?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const index = NOTE_VALUES.indexOf(value);

  function step(delta: number) {
    const from =
      index === -1 ? NOTE_VALUES.indexOf(nearestNoteValue(value)) : index;
    const next = Math.min(NOTE_VALUES.length - 1, Math.max(0, from + delta));
    onChange(NOTE_VALUES[next]);
  }

  function commit(text: string) {
    const n = Number(text);
    if (Number.isFinite(n) && n > 0) onChange(nearestNoteValue(n));
    setDraft(null);
  }

  const increase = (
    <button
      type="button"
      aria-label="Larger beat unit"
      onClick={() => step(1)}
      disabled={index >= NOTE_VALUES.length - 1}
      className={CIRCLE_BUTTON}
    >
      +
    </button>
  );
  const decrease = (
    <button
      type="button"
      aria-label="Smaller beat unit"
      onClick={() => step(-1)}
      disabled={index <= 0}
      className={CIRCLE_BUTTON}
    >
      −
    </button>
  );
  const field = (
    <input
      type="text"
      inputMode="numeric"
      value={shown}
      aria-label="Beat unit"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") setDraft(null);
        else if (e.key === "ArrowUp") {
          e.preventDefault();
          step(1);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          step(-1);
        }
      }}
      className={CIRCLE_INPUT}
    />
  );

  return (
    <div className="flex flex-col items-center gap-1.5 text-sm">
      {showLabel && <span className="font-medium text-muted">Beat unit</span>}
      {layout === "row" ? (
        <div className="flex items-center gap-2">
          {decrease}
          {field}
          {increase}
        </div>
      ) : (
        <>
          {increase}
          {field}
          {decrease}
        </>
      )}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export function GroupsField({
  value,
  onApply,
}: {
  value: string;
  onApply: (groups: number[]) => void;
}) {
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

/** Engraved notes for a beat split into `count` parts (beamed, with a tuplet number when odd). */
export function SubdivisionIcon({ count }: { count: number }) {
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
          <ellipse
            cx={x}
            cy={23}
            rx={3.2}
            ry={2.4}
            transform={`rotate(-20 ${x} 23)`}
          />
          <rect x={x + 2.4} y={stemTop} width={1.2} height={14} />
        </g>
      ))}
      {beams >= 1 && (
        <rect
          x={xs[0] + 2.4}
          y={stemTop}
          width={xs[count - 1] - xs[0] + 1.2}
          height={2.2}
        />
      )}
      {beams >= 2 && (
        <rect
          x={xs[0] + 2.4}
          y={stemTop + 3.6}
          width={xs[count - 1] - xs[0] + 1.2}
          height={2.2}
        />
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

/** The big BPM number, its +/- steppers, the log-scaled quick-adjust slider and tap tempo. */
export function TempoHero({
  bpm,
  setBpm,
  beatsPerBar,
  beatUnit,
  onTap,
  locked = false,
  precise,
}: {
  bpm: number;
  setBpm: (bpm: number) => void;
  beatsPerBar: number;
  beatUnit: number;
  onTap: () => void;
  /** While true (e.g. a tool that changes tempo on its own while running), the tempo can't be
      touched here: no +/- steppers, no slider, no tap tempo, and the number is plain text. */
  locked?: boolean;
  /** The exact (possibly fractional) tempo, if it can differ from the rounded `bpm` shown/edited
      here — e.g. mid-run, between modulations. Only used while `locked`; a nonzero tenths digit
      is shown right after the whole number, in smaller, dimmer text. */
  precise?: number;
}) {
  const { whole, tenths } = splitTenths(precise ?? bpm);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        {!locked && (
          <StepButton label="Decrease tempo" onClick={() => setBpm(bpm - 1)}>
            −
          </StepButton>
        )}
        <div className="flex w-40 flex-col items-center">
          {locked ? (
            <span className="w-full text-center text-6xl font-bold tabular-nums sm:text-7xl">
              {whole}
              {tenths !== null && (
                <span className="text-2xl text-muted">.{tenths}</span>
              )}
            </span>
          ) : (
            <NumberField
              label="Tempo in BPM"
              value={bpm}
              min={MIN_BPM}
              max={MAX_BPM}
              onChange={setBpm}
              className="w-full rounded-lg bg-transparent text-center text-6xl font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-7xl"
            />
          )}
          <span className="text-sm font-medium text-muted">
            BPM · {beatsPerBar}/{beatUnit}
          </span>
        </div>
        {!locked && (
          <StepButton label="Increase tempo" onClick={() => setBpm(bpm + 1)}>
            +
          </StepButton>
        )}
      </div>

      {!locked && (
        <div className="flex w-full flex-col gap-2">
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={sliderFromBpm(bpm)}
            onChange={(e) => setBpm(bpmFromSlider(Number(e.target.value)))}
            aria-label="Tempo (drag to adjust quickly)"
            style={
              {
                "--progress": `${(sliderFromBpm(bpm) / SLIDER_STEPS) * 100}%`,
              } as React.CSSProperties
            }
            className="slider h-6 w-full cursor-pointer"
          />
          <button
            type="button"
            onClick={onTap}
            className="rounded-lg bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Tap tempo
          </button>
        </div>
      )}
    </div>
  );
}

/** The presets + beats/unit steppers + accent grouping + subdivision picker, as one group. */
export function MeterOptions({
  beatsPerBar,
  beatUnit,
  accents,
  subdivision,
  disabled,
  onChangeBeats,
  onApplySignature,
  onSetBeatUnit,
  onSetSubdivision,
  onApplyGroups,
}: {
  beatsPerBar: number;
  beatUnit: number;
  accents: BeatLevel[];
  subdivision: number;
  disabled?: boolean;
  onChangeBeats: (n: number) => void;
  onApplySignature: (beats: number, unit: number, groups: number[]) => void;
  onSetBeatUnit: (unit: number) => void;
  onSetSubdivision: (n: number) => void;
  onApplyGroups: (groups: number[]) => void;
}) {
  const groupsText = groupsFromAccents(accents).join("+");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {SIGNATURE_PRESETS.map(({ beats, unit, groups }) => (
          <button
            key={`${beats}/${unit}`}
            type="button"
            onClick={() => onApplySignature(beats, unit, groups)}
            disabled={disabled}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors disabled:opacity-50 ${
              beats === beatsPerBar && unit === beatUnit
                ? "bg-accent text-accent-foreground"
                : "bg-background hover:bg-surface-hover"
            }`}
          >
            {beats}/{unit}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <SteppedField
          label="Beats per bar"
          showLabel={false}
          value={beatsPerBar}
          min={1}
          max={MAX_BEATS}
          layout="row"
          onChange={onChangeBeats}
          hint="How many beats make up one bar."
        />
        <div className="border-t border-surface-hover" />
        <BeatUnitField
          value={beatUnit}
          showLabel={false}
          layout="row"
          onChange={onSetBeatUnit}
          hint="Which note value counts as one beat, e.g. 4 for quarter notes, 8 for eighths."
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-muted">Accent grouping</span>
        <GroupsField
          key={groupsText}
          value={groupsText}
          onApply={onApplyGroups}
        />
      </label>
      <Hint>
        How the bar is split into accented groups, e.g. 3+2+2 for a bar that feels like three
        uneven groups. Must add up to the number of beats per bar.
      </Hint>

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
                onClick={() => onSetSubdivision(value)}
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
        <Hint>Splits each beat into extra clicks, e.g. straight eighths or triplets.</Hint>
      </div>
    </>
  );
}

/** Tone + volume, the metronome click's sound options. */
export function SoundOptions({
  soundId,
  setSoundId,
  volume,
  setVolume,
}: {
  soundId: string;
  setSoundId: (id: string) => void;
  volume: number;
  setVolume: (volume: number) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-muted">Tone</span>
        <Select value={soundId} onChange={setSoundId} options={SOUND_OPTIONS} />
      </label>
      <Hint>Which click sound the metronome plays.</Hint>

      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center justify-between font-medium text-muted">
          Volume
          <span className="tabular-nums text-foreground">
            {Math.round(volume * 100)}%
          </span>
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
      <Hint>How loud the click plays.</Hint>
    </>
  );
}
