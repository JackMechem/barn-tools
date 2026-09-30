import { stepAt } from "@/lib/practiceTimer";
import type { PracticeSession, RunSegment } from "@/lib/practiceTimer";
import { playNote } from "@/lib/tones";

export type EngineState = {
  /** A snapshot of the session being run, not a live reference — editing or deleting the saved
      session mid-run doesn't affect (or crash) the run already in progress. */
  session: PracticeSession;
  index: number;
  current: RunSegment;
  next: RunSegment | null;
  /** Wall-clock ms (Date.now(), not performance.now()) the current step started counting from —
      deliberately wall-clock, not the page-load-relative clock every other timer/ring component
      in this app uses, since this one (uniquely) needs to keep counting correctly across an
      actual page reload, not just across a re-render. Consumers that want to feed this into the
      existing `CountdownRing`/`CountdownLabel` (which read `performance.now()`) convert via
      `performance.timeOrigin` — see `components/PracticeTimerRing.tsx` — rather than this file
      reaching into those components' assumptions. */
  startedAt: number;
  durationMs: number;
  paused: boolean;
  /** Snapshotted remaining time at the moment of pausing, so resuming can recompute a correct
      `startedAt` (as if the step had started that much earlier) instead of losing track of
      progress. `null` whenever not paused. */
  remainingMsAtPause: number | null;
  soundEnabled: boolean;
  toneId: string;
};

const STORAGE_KEY = "jam-practice-timer-running";

let state: EngineState | null = null;
let initialized = false;
const listeners = new Set<() => void>();
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}

function clearScheduled() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

function scheduleAdvance(ms: number) {
  clearScheduled();
  // A negative/zero delay still fires on the next tick, which is exactly right for "this step's
  // time had already run out" (e.g. right after restoring from a reload).
  timeoutId = setTimeout(advance, Math.max(0, ms));
}

function playTransitionChime(toneId: string) {
  playNote("C5", 0.3, toneId);
  setTimeout(() => playNote("G5", 0.4, toneId), 150);
}

/** Loads the step at `index` as the new current step, or ends the run if the session is over.
    `chime` is false only for the one internal case (restoring after time fully elapsed while the
    tab was closed) where playing a sound the instant a page loads would be surprising — and
    browsers would very likely block an unprompted autoplay there anyway. */
function loadStep(
  session: PracticeSession,
  index: number,
  soundEnabled: boolean,
  toneId: string,
  chime: boolean,
) {
  const current = stepAt(session, index);
  if (!current) {
    stop();
    return;
  }
  const next = stepAt(session, index + 1);
  const durationMs = Math.max(1, Math.round(current.minutes * 60 * 1000));
  state = {
    session,
    index,
    current,
    next,
    startedAt: Date.now(),
    durationMs,
    paused: false,
    remainingMsAtPause: null,
    soundEnabled,
    toneId,
  };
  notify();
  persist();
  scheduleAdvance(durationMs);
  if (soundEnabled && chime) playTransitionChime(toneId);
}

function advance() {
  if (!state) return;
  loadStep(state.session, state.index + 1, state.soundEnabled, state.toneId, true);
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as EngineState;
    const current = stepAt(saved.session, saved.index);
    if (!current) return; // the saved run had already ended
    if (saved.paused) {
      state = { ...saved, current, next: stepAt(saved.session, saved.index + 1) };
      // Paused: nothing to schedule, just restore the frozen state as-is.
      return;
    }
    const remaining = saved.durationMs - (Date.now() - saved.startedAt);
    if (remaining <= 0) {
      // Enough real time passed while the tab was closed that this step is already over — move
      // on to the next one, starting fresh, rather than trying to simulate every step that might
      // have silently elapsed in between (could be a lot, for a long-closed tab and a short
      // segment) or a chime firing the instant the page loads.
      loadStep(saved.session, saved.index + 1, saved.soundEnabled, saved.toneId, false);
    } else {
      state = { ...saved, current, next: stepAt(saved.session, saved.index + 1) };
      scheduleAdvance(remaining);
    }
  } catch {
    // ignore unreadable/corrupt storage
  }
}

export function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): EngineState | null {
  ensureInitialized();
  return state;
}

export function getServerSnapshot(): EngineState | null {
  return null;
}

/** Starts a fresh run of `session` from its first step. Silently does nothing for a session with
    no steps at all (an empty custom segment list) — nothing meaningful to run. */
export function start(session: PracticeSession, soundEnabled: boolean, toneId: string) {
  clearScheduled();
  loadStep(session, 0, soundEnabled, toneId, true);
}

export function pause() {
  if (!state || state.paused) return;
  const remaining = state.durationMs - (Date.now() - state.startedAt);
  clearScheduled();
  state = { ...state, paused: true, remainingMsAtPause: Math.max(0, remaining) };
  notify();
  persist();
}

export function resume() {
  if (!state || !state.paused || state.remainingMsAtPause === null) return;
  const remaining = state.remainingMsAtPause;
  state = {
    ...state,
    paused: false,
    // Backdate startedAt by however much of this step had already elapsed, so the existing
    // "elapsed = now - startedAt" math (CountdownRing, etc.) keeps working unchanged.
    startedAt: Date.now() - (state.durationMs - remaining),
    remainingMsAtPause: null,
  };
  notify();
  persist();
  scheduleAdvance(remaining);
}

/** Skips straight to the next step, same as if the current one's time had just run out. */
export function skip() {
  if (!state) return;
  loadStep(state.session, state.index + 1, state.soundEnabled, state.toneId, true);
}

/** Ends the run entirely. */
export function stop() {
  clearScheduled();
  state = null;
  notify();
  persist();
}
