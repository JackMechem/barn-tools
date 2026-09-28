"use client";

import { useEffect, useRef, useState } from "react";
import { CUSTOM_INSTRUMENT_ID, INSTRUMENTS } from "@/lib/instruments";
import SwitchRow from "@/components/SwitchRow";
import InputTest from "@/components/InputTest";
import ToolLayout from "@/components/ToolLayout";
import KeyHint from "@/components/KeyHint";
import PanelsToggle from "@/components/PanelsToggle";
import Disclosure from "@/components/Disclosure";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import Select from "@/components/Select";
import {
  MicIcon,
  NoteIcon,
  SlidersIcon,
  StopwatchIcon,
} from "@/components/tools";
import {
  AudioInput,
  InputDevice,
  SENSITIVITY,
  listAudioInputs,
  startAudioInput,
} from "@/lib/audioInput";
import {
  Grade,
  describePitch,
  frequencyToMidi,
  gradePitch,
  scoreOf,
} from "@/lib/noteGrade";
import {
  midiToNote,
  parseNote,
  parseRange,
  randomNoteInRange,
} from "@/lib/noteRange";
import { usePersistedSettings } from "@/lib/usePersistedSettings";
import { useSpaceToggle } from "@/lib/useSpaceToggle";
import { DEFAULT_TONE_ID, TONES, playNote } from "@/lib/tones";

const MIN_INTERVAL_SECONDS = 0.5;
const MAX_INTERVAL_SECONDS = 10;
const DEFAULT_INTERVAL_SECONDS = 3;

const NOTE_DURATION_SECONDS = 1;

const MIN_NOTE_COUNT = 5;
const MAX_NOTE_COUNT = 50;
const FRAME_MS = 30;

/** With octave ignored, every note is graded by letter name alone, so the pool is just these 12. */
const IGNORE_OCTAVE_RANGE = "C4-B4";

type AccidentalStyle = "sharp" | "flat" | "random" | "both";
const ACCIDENTAL_STYLES: { value: AccidentalStyle; label: string }[] = [
  { value: "sharp", label: "Sharps (C#)" },
  { value: "flat", label: "Flats (D♭)" },
  { value: "random", label: "Random, either" },
  { value: "both", label: "Both (C#/D♭)" },
];

const SHARP_TO_FLAT: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

/** A stable pseudo-random bit for a seed, so a note's spelling doesn't flicker while it's still
    on screen (a real Math.random() call would re-roll on every re-render). */
function seededBool(seed: number): boolean {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x) < 0.5;
}

/** Folds the note's own text into the seed so two different notes shown at once (the current
    note and the next-note preview) don't always get the same coin flip. */
function accidentalSeed(note: string, seq: number): number {
  let h = seq;
  for (let i = 0; i < note.length; i++) h = h * 31 + note.charCodeAt(i);
  return h;
}

/** Respells a note (e.g. "C#4") per the accidental style; naturals are untouched either way. */
function spellNote(
  note: string,
  style: AccidentalStyle,
  seq: number,
  stripOctave: boolean,
): string {
  const match = /^([A-G]#?)(\d+)$/.exec(note);
  if (!match) return note;
  const [, base, octave] = match;
  const withOctave = (name: string) =>
    stripOctave ? name : `${name}${octave}`;
  const flat = SHARP_TO_FLAT[base];
  if (!flat) return withOctave(base);
  switch (style) {
    case "flat":
      return withOctave(flat);
    case "both":
      return `${withOctave(base)}/${withOctave(flat)}`;
    case "random":
      return withOctave(seededBool(accidentalSeed(note, seq)) ? flat : base);
    case "sharp":
    default:
      return withOctave(base);
  }
}

const GRADE_COLOR: Record<Grade, string> = {
  correct: "#22c55e",
  partial: "#f59e0b",
  incorrect: "#ef4444",
};
const GRADE_LABEL: Record<Grade, string> = {
  correct: "Correct",
  partial: "Partial",
  incorrect: "Incorrect",
};

type Session = {
  total: number;
  index: number;
  target: string | null;
  best: Grade | null;
  /** A stable wrong note was played during this note. */
  wrongPlayed: boolean;
  results: Grade[];
  notes: string[];
  stable: number;
  last: number | null;
  /** The previous note's pitch, so its tail ringing into this note isn't graded against it. */
  previousMidi: number | null;
  /** False until the previous note has stopped (silence or a genuinely new pitch). */
  settled: boolean;
  /** Drill mode only: notes left to play, popped from the front; a full miss goes back on the end. */
  queue: string[];
};

type Summary = { results: Grade[]; notes: string[] };

/** Everything that affects what notes are drawn, how they're timed, and how they're graded —
    two attempts only get compared against each other if all of this matches. */
type HistoryConfig = {
  rangeInput: string;
  ignoreOctave: boolean;
  drillMode: boolean;
  requeuePartials: boolean;
  noteCount: number;
  accidentalStyle: AccidentalStyle;
  intervalSeconds: number;
  toleranceCents: number;
  holdMs: number;
  advanceDelayMs: number;
  refA: number;
  partialCredit: boolean;
  sensitivity: string;
};

function sameConfig(a: HistoryConfig, b: HistoryConfig): boolean {
  return (Object.keys(a) as (keyof HistoryConfig)[]).every(
    (key) => a[key] === b[key],
  );
}

type HistoryEntry = {
  at: number;
  elapsedMs: number;
  score: number;
  total: number;
  config: HistoryConfig;
};

/** e.g. 1234ms -> "1:14.7" (a tenth of a second is precise enough for a practice drill). */
function formatDuration(ms: number): string {
  const tenths = Math.round(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

/** Fisher-Yates, for handing out a drill-mode queue in a random order. */
function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const PANEL_IDS = ["notes", "note-listen", "note-sound"];
const SETTINGS_KEY = "jam-practice-note-trainer";
const DEFAULT_SETTINGS = {
  instrumentId: INSTRUMENTS[0].id,
  customRange: "A1-A6",
  intervalSeconds: DEFAULT_INTERVAL_SECONDS,
  ignoreOctave: false,
  toleranceCents: 50,
  holdMs: 120,
  advanceDelayMs: 600,
  refA: 440,
  sensitivity: "normal",
  partialCredit: true,
  playSound: false,
  showNext: false,
  toneId: DEFAULT_TONE_ID,
  listenMode: false,
  noteCount: 10,
  drillMode: false,
  requeuePartials: false,
  history: [] as HistoryEntry[],
  accidentalStyle: "sharp" as AccidentalStyle,
  inputDeviceId: "",
};

function AdvancedSlider({
  label,
  value,
  unit,
  min,
  max,
  step,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="flex items-center justify-between font-medium text-muted">
        {label}
        <span className="tabular-nums text-foreground">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        className="slider h-6 w-full cursor-pointer disabled:cursor-default disabled:opacity-60"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** A ring around the note that drains as the interval for the current note runs out. */
function CountdownRing({
  active,
  timerRef,
}: {
  active: boolean;
  timerRef: React.RefObject<{ startedAt: number; durationMs: number }>;
  // (useRef always returns a non-null current here, so RefObject is fine as the prop type)
}) {
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const { startedAt, durationMs } = timerRef.current;
      const fraction = Math.min(
        1,
        Math.max(0, (performance.now() - startedAt) / durationMs),
      );
      circleRef.current?.style.setProperty(
        "stroke-dashoffset",
        String(RING_CIRCUMFERENCE * fraction),
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, timerRef]);

  if (!active) return null;

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
    >
      <circle
        cx="50"
        cy="50"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="4"
        className="stroke-surface-hover"
      />
      <circle
        ref={circleRef}
        cx="50"
        cy="50"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-accent"
        style={{
          strokeDasharray: RING_CIRCUMFERENCE,
          strokeDashoffset: 0,
          transition: "stroke-dashoffset 0.1s linear",
        }}
      />
    </svg>
  );
}

/** A ticking "0:07.3" readout while a session runs. Writes straight to the DOM via rAF, like
    the countdown ring above, so it doesn't force the whole page to re-render every frame. */
function ElapsedTimer({
  active,
  startRef,
}: {
  active: boolean;
  startRef: React.RefObject<number | null>;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const startedAt = startRef.current;
      if (startedAt !== null && spanRef.current) {
        spanRef.current.textContent = formatDuration(
          performance.now() - startedAt,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, startRef]);

  if (!active) return null;

  return <span className="tabular-nums" ref={spanRef} />;
}

export default function NoteTrainer() {
  const [settings, updateSettings] = usePersistedSettings(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
  );
  const {
    customRange,
    intervalSeconds,
    playSound,
    showNext,
    toneId,
    listenMode,
    ignoreOctave,
    toleranceCents,
    holdMs,
    advanceDelayMs,
    refA,
    partialCredit,
    drillMode,
    requeuePartials,
  } = settings;
  // Drop any entries saved before "config" existed (or otherwise malformed) rather than
  // crashing on them.
  const history = settings.history.filter(
    (h): h is HistoryEntry =>
      !!h && typeof h.config === "object" && h.config !== null,
  );
  const accidentalStyle = ACCIDENTAL_STYLES.some(
    (s) => s.value === settings.accidentalStyle,
  )
    ? settings.accidentalStyle
    : "sharp";
  const sensitivity =
    settings.sensitivity in SENSITIVITY ? settings.sensitivity : "normal";
  const noteCount = Math.min(
    MAX_NOTE_COUNT,
    Math.max(MIN_NOTE_COUNT, Math.round(settings.noteCount)),
  );
  const instrumentId =
    settings.instrumentId === CUSTOM_INSTRUMENT_ID ||
    INSTRUMENTS.some((i) => i.id === settings.instrumentId)
      ? settings.instrumentId
      : INSTRUMENTS[0].id;
  const setInstrumentId = (instrumentId: string) =>
    updateSettings({ instrumentId });
  const setCustomRange = (customRange: string) =>
    updateSettings({ customRange });
  const setIntervalSeconds = (intervalSeconds: number) =>
    updateSettings({ intervalSeconds });
  const setPlaySound = (playSound: boolean) => updateSettings({ playSound });
  const setShowNext = (showNext: boolean) => updateSettings({ showNext });
  const setToneId = (toneId: string) => updateSettings({ toneId });
  const setListenMode = (listenMode: boolean) => updateSettings({ listenMode });
  const setNoteCount = (noteCount: number) => updateSettings({ noteCount });
  const setDrillMode = (drillMode: boolean) => updateSettings({ drillMode });
  const setRequeuePartials = (requeuePartials: boolean) =>
    updateSettings({ requeuePartials });
  const setAccidentalStyle = (accidentalStyle: AccidentalStyle) =>
    updateSettings({ accidentalStyle });
  const setInputDeviceId = (inputDeviceId: string) =>
    updateSettings({ inputDeviceId });
  const [note, setNote] = useState<string | null>(null);
  const [nextNote, setNextNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<InputDevice[]>([]);
  const [status, setStatus] = useState<Grade | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    index: number;
    total: number;
  } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastElapsedMs, setLastElapsedMs] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  // Mirrors noteSeedRef for the render-time reads (noteLabel in JSX); the ref itself is only
  // read from the audio callback, which runs outside render.
  const [noteSeed, setNoteSeed] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noteTimerRef = useRef({ startedAt: 0, durationMs: 1000 });
  const upcomingRef = useRef<string | null>(null);
  // Bumped every time a new target note is chosen, so "random" accidental spelling stays put
  // for as long as that note's on screen instead of re-rolling on every re-render.
  const noteSeedRef = useRef(0);
  // When the current listen-mode session started, for the "your time" shown when it finishes.
  const sessionStartRef = useRef<number | null>(null);
  const playSoundRef = useRef(playSound);
  const toneIdRef = useRef(toneId);
  const inputRef = useRef<AudioInput | null>(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef<Session | null>(null);
  const listenCfg = useRef({
    ignoreOctave,
    accidentalStyle,
    toleranceCents,
    holdFrames: 4,
    advanceDelayMs,
    refA,
    partialCredit,
    silenceRms: SENSITIVITY.normal.rms,
  });
  const skipRef = useRef<(() => void) | null>(null);
  const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    playSoundRef.current = playSound;
    toneIdRef.current = toneId;
    listenCfg.current = {
      ignoreOctave,
      accidentalStyle,
      toleranceCents,
      holdFrames: Math.max(1, Math.round(holdMs / FRAME_MS)),
      advanceDelayMs,
      refA,
      partialCredit,
      silenceRms: SENSITIVITY[sensitivity].rms,
    };
  }, [
    playSound,
    toneId,
    ignoreOctave,
    accidentalStyle,
    toleranceCents,
    holdMs,
    advanceDelayMs,
    refA,
    partialCredit,
    sensitivity,
  ]);

  const isCustom = instrumentId === CUSTOM_INSTRUMENT_ID;
  // Ignoring octave means only the letter name is graded, so the instrument's range doesn't
  // matter — the note pool collapses to one octave's worth (12 notes).
  const rangeInput = ignoreOctave
    ? IGNORE_OCTAVE_RANGE
    : isCustom
      ? customRange
      : (INSTRUMENTS.find((i) => i.id === instrumentId)?.range ?? "");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      inputRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void listAudioInputs()
        .then((devices) => {
          if (!cancelled) setInputs(devices);
        })
        .catch(() => {});
    };
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, []);

  const inputDeviceId = inputs.some((d) => d.id === settings.inputDeviceId)
    ? settings.inputDeviceId
    : "";

  function endSession() {
    if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
    skipTimeoutRef.current = null;
    skipRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    inputRef.current?.stop();
    inputRef.current = null;
    sessionRef.current = null;
    setRunning(false);
    setStatus(null);
    setHeard(null);
    setProgress(null);
    setWaiting(false);
  }

  function stop() {
    endSession();
  }

  /** Called ~30 times a second with whatever pitch the input is hearing. */
  function handleFrame(freq: number | null) {
    const session = sessionRef.current;
    if (!session || session.target === null) return;
    if (freq === null) {
      session.stable = 0;
      session.last = null;
      // Silence means whatever was ringing has stopped, so grading can resume.
      session.settled = true;
      setHeard(null);
      return;
    }
    const cfg = listenCfg.current;
    const { note: heardNote, cents } = describePitch(freq, cfg.refA);
    // Reuses the current target's seed so a "random" spelling doesn't flicker every frame.
    const shownNote = spellNote(
      heardNote,
      cfg.accidentalStyle,
      noteSeedRef.current,
      cfg.ignoreOctave,
    );
    setHeard(`${shownNote} (${cents > 0 ? "+" : ""}${cents}¢)`);

    const nearest = Math.round(frequencyToMidi(freq, cfg.refA));
    if (nearest === session.last) session.stable++;
    else {
      session.last = nearest;
      session.stable = 1;
    }
    if (session.stable < cfg.holdFrames) return;

    // The tail of the previous note ringing on shouldn't be graded as an attempt at this one;
    // wait until it's stopped or a genuinely different pitch is heard.
    if (!session.settled) {
      if (nearest === session.previousMidi) return;
      session.settled = true;
    }

    // Once the note has been played right (cleanly or after a slip), later notes don't change it.
    if (session.best === "correct" || session.best === "partial") return;

    const played = gradePitch(freq, session.target, {
      ignoreOctave: cfg.ignoreOctave,
      toleranceCents: cfg.toleranceCents,
      refA: cfg.refA,
    });
    if (played === "incorrect") {
      session.wrongPlayed = true;
      if (session.best !== "incorrect") {
        session.best = "incorrect";
        setStatus("incorrect");
      }
    } else {
      // A wrong note before the right one only earns partial credit.
      const result: Grade =
        session.wrongPlayed && cfg.partialCredit ? "partial" : "correct";
      session.best = result;
      setStatus(result);
      if (!skipTimeoutRef.current) {
        // Let the green glow show briefly, then move on to the next note.
        const index = session.index;
        skipTimeoutRef.current = setTimeout(() => {
          skipTimeoutRef.current = null;
          if (sessionRef.current?.index === index) skipRef.current?.();
        }, cfg.advanceDelayMs);
      }
    }
  }

  async function start() {
    const range = parseRange(rangeInput);
    if (!range) {
      setError('Enter a valid range like "A1-A6".');
      return;
    }
    setError(null);
    setSummary(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    inputRef.current?.stop();
    inputRef.current = null;

    const listening = listenMode;
    const drilling = listening && drillMode;
    if (listening) {
      try {
        const input = await startAudioInput(
          inputDeviceId,
          (frame) => handleFrame(frame.freq),
          () => listenCfg.current.silenceRms,
        );
        if (!mountedRef.current) {
          input.stop();
          return;
        }
        inputRef.current = input;
        // Device labels only become available once permission is granted.
        void listAudioInputs().then(setInputs);
      } catch {
        setError(
          "Couldn't open the audio input. Check the browser's microphone permission.",
        );
        return;
      }
      // Drill mode plays every note in the range once (in a random order); anything else
      // still just draws `noteCount` random notes with replacement.
      const queue = drilling
        ? shuffled(
            Array.from({ length: range.highMidi - range.lowMidi + 1 }, (_, i) =>
              midiToNote(range.lowMidi + i),
            ),
          )
        : [];
      sessionRef.current = {
        total: drilling ? queue.length : noteCount,
        index: 0,
        target: null,
        best: null,
        wrongPlayed: false,
        results: [],
        notes: [],
        stable: 0,
        last: null,
        previousMidi: null,
        settled: true,
        queue,
      };
      sessionStartRef.current = performance.now();
    } else {
      sessionRef.current = null;
    }

    const seconds = Math.max(MIN_INTERVAL_SECONDS, intervalSeconds);
    upcomingRef.current = null;
    const advance = () => {
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
        skipTimeoutRef.current = null;
      }
      const session = sessionRef.current;
      if (session) {
        // Lock in the note that just finished; silence counts as a miss.
        const finishedGrade = session.best ?? "incorrect";
        if (session.target !== null) {
          session.results.push(finishedGrade);
          session.notes.push(session.target);
          // Drill mode: a full miss goes back on the end of the queue, and optionally so
          // does a partial.
          if (
            drilling &&
            (finishedGrade === "incorrect" ||
              (finishedGrade === "partial" && requeuePartials))
          ) {
            session.queue.push(session.target);
          }
        }
        const done = drilling
          ? session.queue.length === 0
          : session.index >= session.total;
        if (done) {
          const elapsedMs = sessionStartRef.current
            ? performance.now() - sessionStartRef.current
            : 0;
          sessionStartRef.current = null;
          const config: HistoryConfig = {
            rangeInput,
            ignoreOctave,
            drillMode,
            requeuePartials,
            noteCount,
            accidentalStyle,
            intervalSeconds,
            toleranceCents,
            holdMs,
            advanceDelayMs,
            refA,
            partialCredit,
            sensitivity,
          };
          // Compare against times recorded before this one, so tying/beating an empty
          // history (a first attempt) still counts as a new best.
          const previousBest = history
            .filter((h) => sameConfig(h.config, config))
            .reduce((min, h) => Math.min(min, h.elapsedMs), Infinity);
          const entry: HistoryEntry = {
            at: Date.now(),
            elapsedMs,
            score: scoreOf(session.results),
            total: session.results.length,
            config,
          };
          updateSettings({ history: [...history, entry].slice(-50) });
          setLastElapsedMs(elapsedMs);
          setIsNewBest(elapsedMs < previousBest);
          setSummary({ results: session.results, notes: session.notes });
          setNote(null);
          setNextNote(null);
          endSession();
          return;
        }
        session.index++;
        // A held note ringing on shouldn't be graded against the next target; wait for it to
        // stop (silence, or a pitch that isn't this one) before grading resumes.
        session.previousMidi =
          session.target !== null ? parseNote(session.target) : null;
        session.settled = session.previousMidi === null;
        session.best = null;
        session.wrongPlayed = false;
        session.stable = 0;
        session.last = null;
        setStatus(null);
        setHeard(null);
        // Drill mode's total grows when a note gets requeued, so "X of Y" reflects what's
        // actually left rather than staying fixed at the range size.
        setProgress(
          drilling
            ? {
                index: session.index,
                total: session.index + session.queue.length,
              }
            : { index: session.index, total: session.total },
        );
      }

      let next: string;
      let following: string | null;
      if (drilling && session) {
        next = session.queue.shift()!;
        following = session.queue[0] ?? null;
        upcomingRef.current = null;
      } else {
        next = upcomingRef.current ?? randomNoteInRange(range);
        const isLast = session ? session.index >= session.total : false;
        following = isLast ? null : randomNoteInRange(range);
        upcomingRef.current = following;
      }
      if (session) session.target = next;
      noteSeedRef.current++;
      setNoteSeed(noteSeedRef.current);
      noteTimerRef.current = {
        startedAt: performance.now(),
        durationMs: seconds * 1000,
      };
      setNote(next);
      setNextNote(following);
      if (playSoundRef.current && !session) {
        playNote(
          next,
          Math.min(NOTE_DURATION_SECONDS, seconds),
          toneIdRef.current,
        );
      }
    };

    // Moving on early (a correct note, or the skip button) restarts the timer so the next
    // note gets its own full max time rather than continuing on the old note's schedule.
    skipRef.current = () => {
      advance();
      if (sessionRef.current) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(advance, seconds * 1000);
      }
    };

    advance();
    setWaiting(listening);
    setRunning(true);
    intervalRef.current = setInterval(advance, seconds * 1000);
  }

  useSpaceToggle(running ? stop : () => void start());

  // With "Ignore octave" on, the octave number is left out everywhere notes are shown.
  const noteLabel = (n: string, seq = 0) =>
    spellNote(n, accidentalStyle, seq, ignoreOctave);
  const mainLabel = note ? noteLabel(note, noteSeed) : "—";
  // "Both" spellings (e.g. "C#/Db") is wider than a single note name, so it needs to shrink
  // to still fit inside the circle.
  const mainLabelIsDouble = mainLabel.includes("/");
  const glow = running && status ? GRADE_COLOR[status] : null;
  // The countdown ring only makes sense while a timer is actually running down.
  // A max-time timer now always runs while a session is active, even in "next note when
  // correct" mode, so the ring can just track `running`.
  const showCountdown = running;
  const score = summary ? scoreOf(summary.results) : 0;
  const tally = (grade: Grade) =>
    summary?.results.filter((g) => g === grade).length ?? 0;
  const currentConfig: HistoryConfig = {
    rangeInput,
    ignoreOctave,
    drillMode,
    requeuePartials,
    noteCount,
    accidentalStyle,
    intervalSeconds,
    toleranceCents,
    holdMs,
    advanceDelayMs,
    refA,
    partialCredit,
    sensitivity,
  };
  const matchingHistory = history.filter((h) =>
    sameConfig(h.config, currentConfig),
  );
  const bestMs = matchingHistory.length
    ? Math.min(...matchingHistory.map((h) => h.elapsedMs))
    : null;

  return (
    <ToolLayout
      title="Note Trainer"
      sidePanelLabel="History"
      sidePanel={
        listenMode && (
          <CollapsiblePanel id="history" title="History" icon={StopwatchIcon}>
            {bestMs !== null && (
              <p className="text-sm font-semibold tabular-nums">
                Best {formatDuration(bestMs)}
              </p>
            )}
            {matchingHistory.length === 0 ? (
              <p className="text-sm text-muted">
                No attempts yet with these settings.
              </p>
            ) : (
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {[...matchingHistory]
                  .sort((a, b) => b.at - a.at)
                  .map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 border-b border-background/70 py-2 text-sm last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium tabular-nums">
                          {formatDuration(entry.elapsedMs)}
                        </span>
                        <span className="text-xs text-muted">
                          {entry.config.drillMode ? "Drill" : "Quiz"} ·{" "}
                          {new Date(entry.at).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className="tabular-nums text-muted"
                        style={
                          entry.score === entry.total
                            ? { color: GRADE_COLOR.correct }
                            : undefined
                        }
                      >
                        {entry.score % 1 === 0
                          ? entry.score
                          : entry.score.toFixed(1)}
                        /{entry.total}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {matchingHistory.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    history: history.filter(
                      (h) => !sameConfig(h.config, currentConfig),
                    ),
                  })
                }
                className="self-start text-sm font-medium text-muted hover:text-danger"
              >
                Clear these times
              </button>
            )}
          </CollapsiblePanel>
        )
      }
      options={
        <>
          <PanelsToggle ids={PANEL_IDS} />
          <CollapsiblePanel id="notes" title="Notes" icon={NoteIcon}>
            <SwitchRow
              label="Ignore octave"
              checked={ignoreOctave}
              onChange={(checked) => updateSettings({ ignoreOctave: checked })}
              disabled={running}
            />

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Accidentals</span>
              <Select
                value={accidentalStyle}
                onChange={setAccidentalStyle}
                disabled={running}
                options={ACCIDENTAL_STYLES}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Instrument</span>
              <Select
                value={instrumentId}
                onChange={setInstrumentId}
                disabled={running || ignoreOctave}
                options={[
                  ...INSTRUMENTS.map((instrument) => ({
                    value: instrument.id,
                    label: `${instrument.label} (${instrument.range})`,
                  })),
                  { value: CUSTOM_INSTRUMENT_ID, label: "Custom range…" },
                ]}
              />
            </label>

            {isCustom && !ignoreOctave && (
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

            {/* In listen mode this becomes "Max time", shown in the Listen mode section instead. */}
            {!listenMode && (
              <AdvancedSlider
                label="Interval"
                value={intervalSeconds}
                unit="s"
                min={MIN_INTERVAL_SECONDS}
                max={MAX_INTERVAL_SECONDS}
                step={0.5}
                disabled={running}
                onChange={setIntervalSeconds}
              />
            )}
          </CollapsiblePanel>

          <CollapsiblePanel
            id="note-listen"
            title="Listen mode"
            icon={MicIcon}
            toggle={{
              checked: listenMode,
              onChange: setListenMode,
              disabled: running,
            }}
          >
            <AdvancedSlider
              label="Max time"
              value={intervalSeconds}
              unit="s"
              min={MIN_INTERVAL_SECONDS}
              max={MAX_INTERVAL_SECONDS}
              step={0.5}
              disabled={running}
              onChange={setIntervalSeconds}
            />

            <SwitchRow
              label="Drill every note"
              checked={drillMode}
              onChange={setDrillMode}
              disabled={!listenMode || running}
            />

            {drillMode ? (
              <SwitchRow
                label="Revisit partials"
                checked={requeuePartials}
                onChange={setRequeuePartials}
                disabled={!listenMode || running}
              />
            ) : (
              <label className="flex flex-col gap-2 text-sm">
                <span className="flex items-center justify-between font-medium text-muted">
                  Number of notes
                  <span className="tabular-nums text-foreground">
                    {noteCount}
                  </span>
                </span>
                <input
                  type="range"
                  min={MIN_NOTE_COUNT}
                  max={MAX_NOTE_COUNT}
                  step={1}
                  value={noteCount}
                  onChange={(e) => setNoteCount(Number(e.target.value))}
                  disabled={running || !listenMode}
                  style={
                    {
                      "--progress": `${((noteCount - MIN_NOTE_COUNT) / (MAX_NOTE_COUNT - MIN_NOTE_COUNT)) * 100}%`,
                    } as React.CSSProperties
                  }
                  className="slider h-6 w-full cursor-pointer disabled:cursor-default disabled:opacity-60"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Audio input</span>
              <Select
                value={inputDeviceId}
                onChange={setInputDeviceId}
                disabled={running}
                options={[
                  { value: "", label: "Default input" },
                  ...inputs.map((d) => ({ value: d.id, label: d.label })),
                ]}
              />
            </label>

            <InputTest
              deviceId={inputDeviceId}
              disabled={running}
              silenceRms={SENSITIVITY[sensitivity].rms}
              refA={refA}
            />

            <Disclosure title="Advanced">
              <AdvancedSlider
                label="Tuning tolerance"
                value={toleranceCents}
                unit="¢"
                min={10}
                max={100}
                step={5}
                disabled={running || !listenMode}
                onChange={(v) => updateSettings({ toleranceCents: v })}
              />
              <AdvancedSlider
                label="Note hold time"
                value={holdMs}
                unit=" ms"
                min={30}
                max={300}
                step={30}
                disabled={running || !listenMode}
                onChange={(v) => updateSettings({ holdMs: v })}
              />
              <AdvancedSlider
                label="Pause before next note"
                value={advanceDelayMs}
                unit=" ms"
                min={0}
                max={2000}
                step={100}
                disabled={running || !listenMode}
                onChange={(v) => updateSettings({ advanceDelayMs: v })}
              />
              <AdvancedSlider
                label="Reference pitch (A4)"
                value={refA}
                unit=" Hz"
                min={415}
                max={466}
                step={1}
                disabled={running || !listenMode}
                onChange={(v) => updateSettings({ refA: v })}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">
                  Input sensitivity
                </span>
                <Select
                  value={sensitivity}
                  onChange={(value) => updateSettings({ sensitivity: value })}
                  disabled={running || !listenMode}
                  options={Object.entries(SENSITIVITY).map(
                    ([value, { label }]) => ({
                      value,
                      label,
                    }),
                  )}
                />
              </label>
              <SwitchRow
                label="Half credit after a wrong note"
                checked={partialCredit}
                onChange={(checked) =>
                  updateSettings({ partialCredit: checked })
                }
                disabled={running || !listenMode}
              />
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    toleranceCents: DEFAULT_SETTINGS.toleranceCents,
                    holdMs: DEFAULT_SETTINGS.holdMs,
                    advanceDelayMs: DEFAULT_SETTINGS.advanceDelayMs,
                    refA: DEFAULT_SETTINGS.refA,
                    sensitivity: DEFAULT_SETTINGS.sensitivity,
                    partialCredit: DEFAULT_SETTINGS.partialCredit,
                  })
                }
                disabled={running}
                className="self-start rounded-lg bg-background px-3 py-1.5 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
              >
                Reset advanced settings
              </button>
            </Disclosure>
          </CollapsiblePanel>

          <CollapsiblePanel
            id="note-sound"
            title="Sound & display"
            icon={SlidersIcon}
          >
            <SwitchRow
              label="Play note out loud"
              checked={playSound && !listenMode}
              onChange={setPlaySound}
              disabled={listenMode}
            />

            <SwitchRow
              label="Show next note"
              checked={showNext}
              onChange={setShowNext}
            />

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Tone</span>
              <Select
                value={toneId}
                onChange={setToneId}
                disabled={!playSound}
                options={TONES.map((tone) => ({
                  value: tone.id,
                  label: tone.label,
                }))}
              />
            </label>
          </CollapsiblePanel>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
            <CountdownRing active={showCountdown} timerRef={noteTimerRef} />
            <h1
              className={`relative z-10 font-bold tabular-nums transition-[color,text-shadow] duration-200 ${
                mainLabelIsDouble
                  ? "text-3xl sm:text-4xl"
                  : "text-6xl sm:text-7xl"
              }`}
              style={
                glow
                  ? {
                      color: glow,
                      textShadow: `0 0 12px ${glow}, 0 0 32px ${glow}, 0 0 64px ${glow}`,
                    }
                  : undefined
              }
            >
              {mainLabel}
            </h1>
          </div>
          {showNext && nextNote && running && (
            <span
              aria-label={`Next note ${noteLabel(nextNote, noteSeed + 1)}`}
              className="absolute bottom-1 left-full ml-3 text-xl font-semibold tabular-nums text-muted sm:text-2xl"
            >
              {noteLabel(nextNote, noteSeed + 1)}
            </span>
          )}
        </div>
        {running && progress && (
          <div className="flex flex-col items-center gap-0.5 text-sm text-muted">
            <span className="tabular-nums">
              Note {progress.index} of {progress.total}
              {" · "}
              <ElapsedTimer active={running} startRef={sessionStartRef} />
            </span>
            <span className="tabular-nums">
              {heard ? `Heard ${heard}` : "Listening…"}
            </span>
            {waiting && (
              <button
                type="button"
                onClick={() => skipRef.current?.()}
                className="mt-2 rounded-full bg-surface px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
              >
                Skip note
              </button>
            )}
          </div>
        )}
      </div>

      {summary && !running && (
        <section
          aria-label="Results"
          className="flex w-full flex-col gap-4 rounded-2xl bg-surface p-4 text-left sm:p-6"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">Results</p>
              <p className="text-4xl font-bold tabular-nums">
                {score % 1 === 0 ? score : score.toFixed(1)}
                <span className="text-xl font-semibold text-muted">
                  {" "}
                  / {summary.results.length}
                </span>
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-muted">
              {summary.results.length
                ? Math.round((score / summary.results.length) * 100)
                : 0}
              %
            </p>
          </div>

          {lastElapsedMs !== null && (
            <p className="text-xs text-muted tabular-nums">
              Time {formatDuration(lastElapsedMs)}
              {bestMs !== null && ` · Best ${formatDuration(bestMs)}`}
              {isNewBest && (
                <span
                  className="ml-1.5 font-semibold"
                  style={{ color: GRADE_COLOR.correct }}
                >
                  New best!
                </span>
              )}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            {(["correct", "partial", "incorrect"] as const).map((grade) => (
              <div key={grade} className="rounded-xl bg-background px-2 py-3">
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: GRADE_COLOR[grade] }}
                >
                  {tally(grade)}
                </p>
                <p className="text-xs text-muted">{GRADE_LABEL[grade]}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {summary.notes.map((n, i) => (
              <span
                key={i}
                title={GRADE_LABEL[summary.results[i]]}
                className="rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
                style={{
                  color: GRADE_COLOR[summary.results[i]],
                  background: `color-mix(in srgb, ${GRADE_COLOR[summary.results[i]]} 15%, transparent)`,
                }}
              >
                {noteLabel(n, i)}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Close
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={running ? stop : () => void start()}
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
