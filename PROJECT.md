# jackshed — project notes for AI agents

This file is for picking up work on this repo in a fresh session (including on a different
computer after a clone). It's hand-maintained, separate from the auto-generated Next.js warning
in `AGENTS.md`.

## What this is

A personal collection of browser-based music practice tools, built for Jack (a musician/dev) as a
Next.js (App Router) + Tailwind app, all client components (`"use client"`). Almost everything
still runs client-side — per-tool settings and data (tunes, projects, recordings) persist in the
browser via localStorage / IndexedDB, not on a server, and every tool works fully with no account.
As of this session there's a real backend (Convex) for one thing only: accounts (email+password
and "Sign in with Google"), so far with **nothing synced yet** — see "Backend (Convex)" below for
what exists, what's next, and the honest state of what's been verified.

- **Displayed name:** "jackshed" (all lowercase, shown as the sidebar logo text and page title).
  It's been renamed several times in development (Barn Tools → Woodshed → The Barn → Barn Tools →
  shed.io → jshed.io → jackshed) — if asked to rename again, it's a simple find/replace across
  `app/layout.tsx`, `components/Sidebar.tsx`, `components/Home.tsx`, `app/recorder/page.tsx`.
- **GitHub remote:** `git@github.com:JackMechem/jackshed.com.git` (also renamed a few times;
  the home page's GitHub link in `components/Home.tsx` should match whatever it currently is).
- Jack drives development one request at a time and reviews by screenshot, so expect iterative,
  pixel-level follow-ups rather than big up-front specs. He's comfortable with technical detail in
  replies but the built-in style here favors plain, concrete explanations over jargon.

## Tools (sidebar order)

- **Jam Practice** (`components/JamPractice.tsx`) — random tune/tempo/key picker with a
  count-off metronome. Can draw from your own tune list or a built-in library of ~630 jazz
  standards (`lib/standards.ts`).
- **Metronome** — configurable time signature (including odd/custom meters), subdivisions,
  per-beat accents, tap tempo.
- **Polyrhythm Metric Modulation Metronome** (`components/RandomMetricModulation.tsx`) — same click engine
  and meter controls as Metronome, but every N bars it randomly jumps the tempo by a musical
  ratio (3:2, 4:3, 2:1, etc. — `lib/metricModulation.ts`), bouncing to the ratio's inverse if
  that would push the tempo out of range. Configurable bars-per-modulation (or "play until tempos
  realign" — each `Modulation` carries an exact `num`/`den`, so e.g. a 3:2 jump auto-sets the
  interval to 3 bars, the point where the new and reference tempos next share a downbeat), which
  ratios are in the mix, whether to avoid repeating the same one twice, and an optional "return to
  original tempo" mode that alternates modulate-away/return-home instead of drifting freely. Shows the
  upcoming tempo ahead of time and logs each modulation for the run in a `ToolLayout` `sidePanel`
  (see below). An optional second click — the "Previous tempo click" (`playOriginalTempo`; own
  tone, own mute, own `BeatIndicator`) — runs the whole time as a second track on the _same_
  `startClickEngine` call (see below) so it can hear/see it against whatever the main click has
  modulated to — pinned to the true starting tempo in "return to original" mode, or otherwise
  always the tempo the main click just left (one modulation behind, which is what the toggle's
  name reflects — it's usually tracking the *previous* tempo, not literally the original one).
  Turning it on also forces "play until tempos realign" (`matchToRealignment`) on and locks it
  there (disabled, can't be switched off) until the previous-tempo click is turned off again —
  that's what keeps the reference click's own realignment math meaningful; letting the two vary
  independently could leave it silently out of sync with the main click. Each modulation carries
  an exact `num`/`den` (e.g. 3:2), so it also shows what the new
  tempo's quarter note is worth in the reference tempo's note values where that reduces to a
  single clean name (`describeQuarterEquivalence` in `lib/metricModulation.ts`; several ratios,
  like 4:3, genuinely don't and show nothing). The modulation itself is applied from inside
  `getSettings` (a param `startClickEngine` passes `(beat, sub)` into) rather than reacting to
  `onBeat`, so it lands exactly on the bar line instead of one beat late.
- **Tuner** — a Total-Energy-style circular note picker for a chromatic tuner + tone generator,
  with per-instrument string tunings.
- **Note Trainer** — drills random notes in an instrument's range. Has a mic-based "listen mode"
  (`lib/audioInput.ts`, `lib/pitchDetect.ts`, `lib/noteGrade.ts`) that listens through the
  microphone and grades correct/partial/incorrect, with a countdown ring and adjustable max-time
  per note. Once a note is graded, the same ring (plus a "Next note in Ns" readout,
  `components/CountdownLabel.tsx`) retargets to count down "Time between notes" instead (0–8s,
  a main Listen-mode control, not tucked in Advanced); an optional "Sound feedback" toggle adds a
  click each second of that countdown plus one the instant a note is graded, via
  `lib/clickEngine.ts`'s `scheduleClick`. Same mechanism as Scale Trainer's (see below), ported
  over afterward — `lockInResult` here is the equivalent of Scale Trainer's `lockInRound`.
  A lifetime "Struggles" side panel (`lib/struggleStats.ts`, shared with Scale Trainer — see
  below) tracks correct/partial/incorrect per note across every listen-mode session ever run
  (not reset between sessions, unlike the timed "History" list next to it), ranks them worst
  first, and a "Shed weak notes" button starts a focused session on just those — reuses the same
  queue machinery as "Drill every note" (`start()` takes a `StartRequest` —
  `{kind:"normal"|"weak"}` or `{kind:"string", stringIndex}`, all three driving the same
  `drilling`-gated code paths in `start()`/`advance()`) but sources its queue from
  `weakNotesInRange` instead of the whole range, forces listen mode on, and never writes to the
  timed History (a short focused run isn't a fair comparison against a full one). For a stringed
  instrument (`Instrument.strings` in `lib/instruments.ts` — bass4/5, guitar, ukulele, violin,
  viola, cello; mirrors the standard tuning already in `lib/tunings.ts` for the Tuner, which uses
  a separate instrument-id namespace and isn't reused directly) there's also a "Shed a string"
  button per string, same focused-session machinery again, queued from that string's own open
  note up to two octaves above it (clamped to the instrument's declared range — no fret-count
  data exists anywhere in the app, so this is a stated, adjustable assumption, not measured) —
  always shown and graded with the octave via `effectiveIgnoreOctave`, regardless of the "Ignore
  octave" toggle, since isolating one string is inherently octave-specific. That override is
  computed from `lastRequest` (which mode last ran) rather than `running`, so it also still
  applies to the results screen shown right after — but `start()` never reads it or the
  `ignoreOctave`-derived `rangeInput` directly for a string session (both are only current as of
  the last *completed* render, and `start()` needs values that are correct at the moment it's
  called, mid-render-cycle) — it recomputes both locally from the instrument's own declared range.
- **Scale Trainer** (`components/ScaleTrainer.tsx`, `lib/scales.ts`) — same shape as Note Trainer
  (shares its countdown ring, elapsed timer, advanced-slider, and note-spelling code — see shared
  conventions below), but drills scales instead of single notes: a random starting note plus a
  random mode from a selectable pool (`lib/scales.ts`'s `SCALE_MODES`, grouped into categories —
  the 7 major-scale modes, harmonic/melodic/harmonic-major, pentatonic/blues, the 7 melodic-minor
  modes, and the symmetric scales — with a sensible starter subset enabled by default). Listen
  mode expects the scale's notes in order, root to root; a wrong note fails the round (turns red)
  immediately by default. An optional "Partial credit" toggle (Listen mode → Advanced) instead
  gives each scale degree one retry — a second miss on the same degree still fails the round, but
  a degree that's missed once and then fixed lets the round finish as "partial" (amber) rather
  than "correct" (green), matching Note Trainer's correct/partial/incorrect grading
  (`GRADE_COLOR`/`GRADE_LABEL`/`Grade`/`scoreOf` now live in `lib/noteGrade.ts`, shared by both).
  The current round's note pills show progress live (matched/current-waiting-on-a-retry/failed)
  while it's running.
  "Drill every scale" plays every selected mode in all 12 keys (each with its own random octave)
  instead of a fixed count; a missed round is requeued with a freshly re-rolled octave rather than
  the identical one, so a repeated miss doesn't look like the same exact round stuck on screen. An
  "Ignore octave" toggle drops the octave number from every note shown (e.g. "C Dorian" instead of
  "C4 Dorian") **and** accepts the scale played in any octave — it's passed through to
  `gradePitch`'s own `ignoreOctave` option, not just a display flag. Once a round is graded, the
  same countdown ring (and a "Next scale in Ns" readout, `components/CountdownLabel.tsx`) retargets
  from "time left to play" to "time until the next scale", timed by the "Time between scales"
  slider (0–8s, promoted out of Advanced since it's a main control now); an optional "Sound
  feedback" toggle adds a click on every second of that countdown plus one the instant a scale is
  graded, via `lib/clickEngine.ts`'s `scheduleClick` (the same oscillator-click code the
  metronomes use) rather than a pitched note. Shares Note Trainer's lifetime "Struggles" panel
  (`lib/struggleStats.ts`) and "Shed weak scales" button, keyed by key *and* mode together (e.g.
  "F# Dorian" and "C Dorian" are tracked and shed separately, not lumped into one "Dorian"
  struggle) — the stat key folds a bare 0–11 pitch class and the mode id into one string
  (`scaleStatKey`/`parseScaleStatKey`), pitch class rather than a spelled letter so it survives an
  accidental-style change and doesn't care what octave it was played in. A weak session is one
  round per struggling key, built with `scaleRoundForPitchClass` for that exact key+mode rather
  than a random root of the mode — not the full `drillQueueForPool` 12-key-per-mode sweep "Drill
  every scale" does, so it stays quick and targeted on what's actually giving trouble.
- **Interval Trainer** (`components/IntervalTrainer.tsx`, `lib/intervals.ts`) — same shape again
  (same shared countdown ring/timer/note-spelling code), but drills the twelve intervals within an
  octave (minor 2nd through an octave, `lib/intervals.ts`'s `INTERVALS`, all enabled by default —
  a small enough set that a curated starter subset isn't worth the friction) instead of scales. A
  round is `{interval, direction, startMidi, notes: [start, target]}` — always exactly two notes,
  so `handleFrame`'s degree-by-degree grading loop is reused almost verbatim from Scale Trainer. An
  "Include descending intervals" toggle (Intervals panel) controls whether a round can ask for the
  interval *below* the starting note as well as above; off by default (ascending only). Listen mode
  has two distinct styles, both built on the existing "precompute the next round for preview" ref
  (`upcomingRef`) rather than any new state:
  1. **Fresh root each round** (default) — `randomIntervalRound` picks a brand-new random starting
     note every time, shown as e.g. "C4 ↑ Major 3rd".
  2. **Continue from previous note** (the "Continue from previous note" toggle, mutually exclusive
     with "Drill every interval") — `chainedIntervalRound` starts the next round exactly on the
     *target* note the previous round just ended on, so the interval is played relative to wherever
     the last one landed rather than a fresh root. The starting note is still always shown (e.g.
     "F#4 ↓ Perfect 4th") even though it's the same note as the previous round's target — a chain
     that hid it would leave no way to re-orient after a wrong note, since nothing on screen would
     say where you actually are. Falls back to a fresh random root if the chain runs out of range to
     continue in.
  "Drill every interval" works like Scale Trainer's "Drill every scale": every selected interval, in
  every selected direction, starting on all 12 keys, each its own random octave
  (`drillQueueForPool`); a missed round is requeued with a freshly re-rolled octave
  (`intervalRoundForPitchClass`) rather than the identical one. Shares the lifetime "Struggles"
  panel and "Shed weak intervals" button (`lib/struggleStats.ts`), but keyed by interval *and*
  direction together (`"M3:1"` = ascending Major 3rd, `"M3:-1"` = descending — `intervalStatKey`/
  `parseIntervalStatKey`), not by starting note, since an interval is the same struggle wherever
  it's started from. A weak session is one round per struggling interval+direction
  (`randomIntervalRound` with that single interval/direction forced), not the full drill sweep.
  An optional "Play interval out loud" toggle (quiz mode only, not listen mode) plays both notes in
  order, spaced out, instead of a single note like the other two trainers.
- **Guess the Interval** (`components/GuessTheInterval.tsx`, reuses `lib/intervals.ts` directly —
  no new lib file) — the first tool in its own **"Ear Training"** sidebar category (a new entry in
  `components/tools.tsx`'s `CATEGORIES`, between "Practice" and "Timing & Tuning"). Derived from
  Interval Trainer but inverted: it plays an interval (melodic or harmonic — a "Playback style"
  setting — via `lib/tones.ts`'s `playNote`) and the player picks which interval it is from a
  multiple-choice grid, instead of playing it back on an instrument through the mic. Because
  there's no audio input at all, it drops everything that only exists for pitch-listening (mic
  input, tolerance/hold-time/sensitivity, partial credit, ignore-octave, ignore-repeated-notes) but
  keeps the exact same *timing* machinery as Interval Trainer end to end — the countdown
  ring/label, "Max time to answer"/"Time between rounds" sliders, the sound-feedback countdown
  clicks, `roundCount`/"Drill every interval", and a timed "History" list keyed by a config only
  attempts with matching settings compare against — `lockInRound`/`scheduleAdvance`/`advance`'s
  finalize-then-pick-next state machine is copied over almost line for line, just with grading
  triggered by `submitGuess(id)` (a button click, immediately correct/incorrect — no partial
  credit, since there's no note-by-note sequence to retry) instead of `handleFrame`'s mic
  callback. A round is always shown as "?" until graded, then reveals the interval (e.g.
  "↑ Major 3rd", colored green/red) and, if "Reveal notes after answering" is on, the actual notes
  played (e.g. "C4 → E4"). "Include descending intervals" still exists (a round can play the
  interval below the start), but since guessing only asks "which interval", not "which direction",
  the answer grid and the lifetime "Struggles" stats (`lib/struggleStats.ts`) are keyed by interval
  alone — unlike Interval Trainer's interval-*and*-direction keying. A "Shed weak intervals"
  session's answer choices come from whatever's actually in that session's queue rather than the
  live pool selection, so a struggling interval that's since been deselected from "Intervals" still
  shows up as a valid answer instead of being an un-pickable correct answer.
  Two `react-hooks/purity` false positives (`performance.now()` inside `lockInRound`/`start`, both
  only ever reached from a button's `onClick`, never during render — the same ref-mutation timing
  pattern every other trainer uses) are suppressed with `eslint-disable-next-line` comments; the
  other trainers use the identical pattern but are large/complex enough that the React Compiler
  lint integration bails out of analyzing them before it would reach the same code, so only this
  smaller component's version gets (harmlessly) flagged.
- **Guess the Chord** (`components/GuessTheChord.tsx`, `lib/chords.ts`) — second tool in "Ear
  Training". Same timed-round shape as Guess the Interval (countdown ring, max time to
  answer/time between rounds, sound feedback, drill mode, timed History, lifetime "Struggles" +
  "Shed weak chords"), but plays a full chord instead of an interval, and grading is a typed text
  answer instead of a multiple-choice pick — there's no fixed candidate list to build (a real
  simplification vs. Guess the Interval's answer-choices bug the weak-session fix had to work
  around). `lib/chords.ts`'s `CHORD_QUALITIES` (33 qualities across 6 categories — Triads,
  Sixths, Sevenths, Altered dominants, Extensions, Sus & add, with a smaller starter subset
  enabled by default, same pattern as Scale Trainer's mode categories) is written in the *same*
  plain-text quality-suffix grammar iReal Pro itself uses (`^7`, `-7`, `h7` for half-diminished,
  `o7` for diminished, `+`, `#`/`b`, ...) — deliberately, so a chord here is typed and displayed
  exactly the way it'd appear on a Chord Charts chart. `prettyQuality` (the `^`/`h`/`o`/`#`/`b` →
  Δ/ø/°/♯/♭ substitution) moved from being a private helper in `ChordChart.tsx` to an export of
  `lib/iRealPro.ts` so both this bank and the chart renderer draw a chord the same way. Typing
  is graded, not chosen: `parseChordInput` (root letter + accidental, then a non-greedy quality
  capture, then an optional `/bass` — the same shape as `iRealPro.ts`'s own `CHORD_RE`/
  `splitMain`, just permissive about the quality text instead of a fixed char class) resolves
  freeform typed text like `maj7`, `m7`, `dim`, `sus4`, `Δ7`, `ø7`, `°7` against each quality's
  declared `aliases`, case/whitespace/punctuation-insensitively; grading
  (`chordInputMatchesRound`) then compares root pitch class + resolved quality id + slash bass
  pitch class (or both `null`) — enharmonic spelling doesn't matter, same as every other trainer
  here. Deliberately does *not* accept a bare `M7` for major 7: matching is case-insensitive, so
  there's no way to tell `M7` from `m7` apart once normalized, and `m`/`m7`/... for minor is by
  far the more universal shorthand, so that's the one bare-letter form supported — major relies
  on `maj7`/`^7` instead (documented both in a code comment on `ChordQuality.aliases` and in an
  always-visible on-page hint, since it's a real gotcha for anyone typing `M7` expecting major).
  What's typed renders live, formatted the same way (`formatChordParts` + `prettyQuality`), in
  the same spot the revealed answer appears once graded — so "proper formatted notation" is
  visible the whole time you're typing, not just after submitting. A chord's root is drawn from a
  plain register choice (Low/Mid/High/Wide MIDI ranges) rather than an instrument list — a chord
  isn't "played on an instrument" the way the other trainers' material is, so reusing the
  Instrument dropdown wouldn't mean anything here. Slash chords aren't restricted to real
  inversions: a "Chance of a slash chord" slider (0-100%) independently rolls *any* of the 12
  pitch classes as the bass, so it can land on an actual chord tone (a normal inversion) or a
  genuinely unrelated note (the "weird slash chords" the tool was asked for) with equal
  likelihood — `buildRound` voices that bass in the octave directly under the root. A round times
  out the same way an explicit answer works, not silently: `gradeAndReveal` (grades whatever's
  currently typed, or "incorrect" if empty/unrecognized) runs from *both* the "Submit"/Enter path
  and the max-time timer's `onTimeUp` callback, so running out of time still reveals the correct
  answer through the normal `lockInRound` reveal-and-countdown pause instead of just silently
  picking the next round — a deliberate departure from Interval/Scale Trainer's own timeout
  behavior (which doesn't reveal anything on a miss), made because losing an answer you were
  mid-typing without ever finding out what it was seemed like a worse loss here specifically.
  Struggle stats (`lib/struggleStats.ts`) are keyed by quality id alone (not quality-and-slash),
  matching Guess the Interval's keep-it-simple choice over Interval Trainer's fuller keying.
  A "Give the root" toggle (on by default) pre-fills the answer field with the round's root the
  instant it's shown — cursor placed right after it — so typing (and being graded on) is about
  working out the quality/slash bass by ear, not also having to name the root; switching it off
  clears the field instead, making the whole symbol, root included, something to work out.
  Leaving the prefilled root untouched and submitting reads as "just typed the root" (a bare
  major triad, the empty-quality default), which is correct only when the round genuinely is one.
  A small "keypad" of buttons sits above the answer field (visible whenever it is) for the
  symbols that are awkward to type, especially on a phone — minor `-`, major 7 `^`, diminished
  `o`, half-diminished `h`, augmented `+`, `#`/`b`, `/` (slash), `sus`, `add` — each key shows its
  `prettyQuality`-formatted glyph as the button face and inserts the plain iReal text at the
  field's current cursor position (not just appended to the end), restoring the caret right after
  it via a `requestAnimationFrame` (the DOM `<input>` doesn't have the just-set React state's
  value yet the same tick a key is clicked). Each key's `onMouseDown` prevents the browser's
  default focus-shifting-to-the-button behavior, so the answer field never visibly loses focus to
  a keypad tap at all.
- **Practice Timer** (`components/PracticeTimer.tsx`, `lib/practiceTimer.ts`,
  `lib/practiceTimerEngine.ts`) — chains named timers back to back (e.g. "10 min scales, 5 min
  break, 10 min tune"), or runs a configurable Pomodoro (work/short break/long break minutes,
  cycles before a long break, and either a fixed total number of work cycles or "keep going
  indefinitely", mirroring Jam Practice's own toggle of that name). Work cycles can each have
  their own name (`PomodoroConfig.workTitles: string[]`, editable as an ordered add/remove/
  reorder list in the editor, same shape as a custom session's segment list) — e.g.
  `["Scales", "Chords", "Improv"]` names cycle 1 "Scales", cycle 2 "Chords", cycle 3 "Improv",
  cycle 4 back to "Scales", wrapping via modulo so it works for an indefinite session too (no
  fixed cycle count to size the list to) and for any totalCycles/list-length mismatch; an empty
  list, or a blank entry in it, falls back to plain "Work" for that cycle. Breaks are deliberately
  **not** individually nameable — just the fixed "Short break"/"Long break" labels — per an
  explicit follow-up request narrowing this down from an earlier version that made all three step
  kinds nameable. `lib/practiceTimer.ts` is pure
  session-shape logic with no engine/UI concerns: a `PracticeSession` is a discriminated union
  (`type: "custom"` with a `Segment[]`, or `type: "pomodoro"` with a `PomodoroConfig`), and
  `stepAt(session, index)` is the one function both the engine and the UI call to ask "what's step
  N" — for Pomodoro this lazily expands the work/break pattern (`pomodoroStepAt`) rather than ever
  materializing a real array, since an indefinite Pomodoro has no fixed length.
  `lib/practiceTimerEngine.ts` is a self-contained, module-level-state JS engine — same shape as
  `lib/clickEngine.ts`, not tied to any component's lifecycle — exposed via a `subscribe`/
  `getSnapshot` pair so any component (the tool page, the sidebar widget, the mobile badge) can be
  an independent `useSyncExternalStore` view onto one shared running timer, none of them
  responsible for keeping it alive. It's also the first timer in this codebase built to survive an
  actual page reload, not just a re-render: `startedAt` is wall-clock (`Date.now()`), not
  `performance.now()` like every other timer/ring here, and the whole state round-trips through
  `localStorage` (`jam-practice-timer-running`) so `ensureInitialized()` can restore it on the next
  load — paused restores frozen as-is; a still-running step restores and reschedules against
  however much time is actually left; a step whose time had already fully elapsed while the tab
  was closed advances exactly one step fresh (no chime, no attempt to simulate/cascade through
  every step that might have silently elapsed for a long-closed tab). `components/
  PracticeTimerRing.tsx` is the tool page's own countdown ring + "M:SS" label — deliberately
  **not** built on the shared `CountdownRing`/`CountdownLabel` (hardcoded to `performance.now()`,
  the page-load-relative clock every other timer here uses); an earlier version of this component
  converted into `performance.now()` terms via `performance.timeOrigin` specifically to reuse
  those shared components without modifying them, but that produced a running-timer display that
  didn't match the sidebar widget's own (correct) reading of the same segment — diagnosed as a bug
  in that conversion rather than chasing it further, since this sandbox has no browser to actually
  debug a `performance.timeOrigin` mismatch in. Replaced with a small self-contained component
  that computes straight off `Date.now()` — the exact same clock `lib/practiceTimerEngine.ts`
  itself and `PracticeTimerWidget.tsx` already use — and formats via the shared `formatClock`
  (`lib/practiceTimer.ts`, "M:SS", e.g. "24:59" — not `formatMinutes`, which is for a *static*
  duration label like "10 min", not a ticking countdown), so the tool page and the sidebar/mobile
  widget literally cannot show two different numbers for the same running step anymore, and a long
  segment reads as minutes:seconds instead of a raw, hard-to-parse second count. While paused, it
  freezes at `remainingMsAtPause` instead of the live tick. `components/PracticeTimerWidget.tsx` is
  the "what's running right now" glimpse shown outside the tool itself while a session is active —
  a card in the desktop sidebar footer (both its full and collapsed widths,
  `components/Sidebar.tsx`), the same card again in the mobile menu's own footer (shares the same
  code path as the desktop one), or a fixed top-right badge on mobile mirroring the hamburger
  button's top-left placement (`app/layout.tsx`); renders nothing while nothing's running. The
  full-width card (desktop sidebar and the mobile menu, not the collapsed sidebar or the top-right
  badge — no room for controls in either of those) has its own pause/resume, skip, and stop
  buttons, real `<button>`s as siblings of the card's own `<Link>` rather than nested inside it (a
  button inside an anchor is invalid HTML and breaks click handling) — added per a direct follow-up
  request to control a running session from the sidebar, not just glance at it.

  **Alarm mode and full-screen alerts** (the `practice-timer-sound-settings` synced object's
  `alarmMode`/`fullScreenAlert`, alongside the existing `soundEnabled`/`toneId`): by default, a
  segment ending plays one transition chime and the engine auto-advances silently underneath,
  unchanged from before. With alarm mode on, the engine instead holds — `EngineState.alarming:
  true` — repeating that same chime every 1.5s (`lib/practiceTimerEngine.ts`'s
  `startAlarmSound`/`ALARM_REPEAT_MS`) until `skip()` is called (dismiss and move on — the exact
  same function as a normal manual skip) or `stop()` ends the run outright; `pause()`/`resume()`
  are no-ops while alarming, since there's nothing actively counting down to pause. Every
  Practice-Timer-aware surface reflects `alarming`: the tool page's own controls swap to
  Continue/Stop (no Pause, no plain Skip) and `PracticeTimerRing` paints fully drained and pulses
  in the danger color instead of ticking; the sidebar widget shows "Time's up!" with the same
  Continue/Stop pair; and — only while `fullScreenAlert` is also on — `components/
  PracticeTimerAlert.tsx`, mounted once in `app/layout.tsx` (so it interrupts you app-wide, not
  just on the tool page), shows a full-screen takeover with the same Continue/Stop choice,
  deliberately **not** dismissible via Escape or a backdrop click the way `ConfirmDialog` is — this
  is meant to be genuinely sticky, like a real alarm clock, until an actual choice is made.
  `fullScreenAlert` only does anything while `alarmMode` is also on (there's no "held, waiting"
  moment to interrupt for otherwise — without alarm mode the engine has already silently advanced
  by the time anything could show), so its own `SwitchRow` is disabled whenever `alarmMode` is off,
  and turning `alarmMode` off forces it back off too rather than leaving it toggled-on-but-dormant.
  Restoring from a reload (`ensureInitialized()`) treats "was already alarming" and "alarm-mode
  time elapsed while the tab was closed" as the same case — both restore straight into
  `alarming: true` on the *same* step, never silently advancing past it the way non-alarm-mode
  restores do; no sound autoplay on that restore either, same reasoning as the existing
  chime-after-restore skip (a browser would very likely block an unprompted autoplay with no user
  gesture anyway). Verified with a synthetic script driving the engine's alarm state machine
  directly (holds on `alarming` instead of auto-advancing, stays held indefinitely rather than only
  once, `skip()` dismisses and advances, `stop()` ends cleanly from an alarming state, and
  `alarmMode: false` is completely behaviorally unchanged) plus two new restore-from-storage cases
  (elapsed-while-away-with-alarm-mode-on, and already-alarming) alongside the existing ones.

  Saved sessions sync per Jack's explicit call on how sophisticated this should be: signed
  out, they live in `localStorage` via `lib/practiceSessionsStore.ts` (the same hand-rolled
  external-store shape as `lib/tunesStore.ts`); signed in, `lib/usePracticeSessions.ts` reads/
  writes the `practiceSessions` Convex table instead (`convex/practiceSessions.ts`) — **with no
  merge at all**: signing in simply stops consulting local storage, it doesn't import, offer a
  choice, or look at what's already there. Both `useConvexAuth()` and the Convex/local-store hooks
  in `usePracticeSessions` run unconditionally on every render regardless of sign-in state, per
  rules-of-hooks; only the returned `sessions`/mutators branch on it, same pattern as
  `AccountPage.tsx`.
- **Chord Charts** (`components/ChordCharts.tsx`, `components/ChordChart.tsx`,
  `lib/iRealPro.ts`) — paste an iReal Pro playlist link (the `irealb://...` links shared on the
  iReal Pro forums) and read its charts, styled to match the site. The link's chord data is
  scrambled/compressed in an undocumented way; `ireal-reader` (npm, MIT — the one non-audio
  runtime dependency in this repo) handles that part and splits the playlist into songs, but its
  own `measures` output _expands_ repeats/endings into one flattened, played-through list, which
  is right for playback but wrong for display. So `lib/iRealPro.ts` doesn't use that — it walks
  the same un-scrambled `raw` chart string itself (same token grammar: `*A` section letters,
  `{`/`}` repeat barlines, `N1`/`N2` endings, `<...>` directions like "D.C. al Coda", `XyQ` layout
  padding, a chord-token regex) to build a chart model that keeps the notation as written once,
  with repeat signs and ending brackets, instead of expanding it. Imported songs (title, composer,
  style, key, and the parsed bar list) persist in localStorage across playlists you paste in,
  de-duplicated by title/composer/key; "bars per row" is a display setting, not part of the parsed
  data. Verified by running the whole parser over a real ~1,460-song forum playlist (`node
--experimental-strip-types`, not committed) — no exceptions, no malformed chords, ~4.5MB of
  JSON for that whole playlist (comfortably under typical localStorage limits, but worth knowing
  if several large playlists get imported).
  **Every imported chart belongs to a playlist** (`lib/chordChartsLibrary.ts`'s `Library` type —
  `{songs, playlists}`, where a `Playlist` is just a name plus a list of song ids) — per a direct
  follow-up request, since the library used to be one flat list with no grouping at all. Pasting an
  iReal Pro link creates (or, re-pasting the same playlist later, merges into — matched
  case/whitespace-insensitively by name) a playlist named after that playlist's own name
  (`parseIrealPlaylist`'s `name`, e.g. "Real Book vol. 1"); importing from a Community chord-chart
  post (`CommunityChordCharts.tsx`) does the same under that post's title, whether it's "Import
  all" or a single song pulled out of a bigger post — either way it lands in a playlist named after
  the post, so charts from the same post end up grouped together rather than loose. One function,
  `mergeIntoLibrary`, is the single place this happens — both import paths call it, so there's
  exactly one playlist-assignment rule to reason about, not two that could drift. The "Tunes" panel
  shows playlists as collapsible sections (sorted alphabetically) instead of one flat list;
  expand/collapse state is plain ephemeral component state (not persisted — this is a "which
  section is open right now" UI convenience, not real settings data), and a playlist containing the
  currently selected song shows expanded by default with no explicit toggle needed, so picking a
  tune from the search popup always reveals where it lives. `resolvePlaylists` is what actually
  turns `Library` into what gets rendered — it resolves each playlist's song ids back into full
  song objects and, importantly, buckets any song that isn't in *any* playlist into a synthetic
  "Unsorted" playlist shown last. That bucket is what makes "every chart is in a playlist" true for
  a library saved *before* this feature existed too: `playlists` defaults to `[]` and
  `mergeWithDefaults` (`lib/usePersistedSettings.ts`) fills a missing field from the default rather
  than failing, so an old library with songs but no `playlists` field just loads with everything
  showing under "Unsorted" — no migration write needed, nothing to break if it's read on a device
  that hasn't picked up this change yet. Deleting a song removes it from `songs` and from whichever
  playlist(s) reference it (`removeSongFromLibrary`); a playlist left with no songs is dropped
  entirely rather than kept as an empty shell. Verified with a synthetic Node script
  (`mergeIntoLibrary` creating vs. merging into an existing playlist by name, a duplicate song
  correctly skipped in a *new* playlist too — not just the one it was already in, `resolvePlaylists`
  accounting for every song exactly once, the legacy-library-falls-into-Unsorted case, and
  deleting a song both from a solo playlist — which then disappears — and from a multi-song one,
  which doesn't) — not yet clicked through in a real browser (same "genuinely untested" caveat as
  everything else UI-shaped in this app — see that section).
  **Signed in, the library moved off `syncedSettings` onto its own dedicated tables** — the first
  real bug this app has hit from an actual user, not a sandbox-guessed risk: importing a large
  real iReal Pro playlist threw `Uncaught Error: Value is too large (4.62 MiB > maximum size 1
  MiB)` from `syncedSettings:set`, because the *whole* library (every song's full parsed bar list,
  all of it) was being written as one JSON blob in one Convex document, and Convex hard-caps a
  single document at 1 MiB. `lib/useChordChartsLibrary.ts` is the new single entry point both
  `ChordCharts.tsx` and `CommunityChordCharts.tsx` use instead of `useSyncedSettings`/
  `LIBRARY_KEY` directly: signed out, it's a thin, *unchanged* wrapper over
  `lib/chordChartsLibrary.ts`'s pure functions and the original `usePersistedSettings` blob (this
  bug is Convex-specific — localStorage has no equivalent per-key ceiling anywhere near this, so
  there was nothing to fix for a signed-out device); signed in, it's backed by three new Convex
  tables (`chordChartPlaylists`/`chordChartSongs`/`chordChartSongBars`, `convex/schema.ts`) instead
  of the generic blob mechanism, the same kind of exception `practiceSessions` and the Community
  post tables already are, just pushed one step further: a song's *metadata* (title/composer/
  style/key/time signature) is split into its own table from that same song's *bars*, so listing,
  searching or deduping a library (`convex/chordCharts.ts`'s `library`/`importSongs`) never has to
  touch `bars` at all, and `bars` is fetched only for whichever one song is actually
  displayed (`getSongBars`) or, for bundling several already-chosen songs into a Community post,
  in one bulk one-off call right before posting (`getSongsBars`, called via `useConvex().query`
  rather than a live `useQuery` subscription, since it's only ever needed once). The result: no
  single document's size grows with the size of the library, or even the size of one playlist —
  only with the size of *one song*, which in practice is nowhere near 1 MiB (the forum-playlist
  numbers cited above work out to roughly 3 KB/song on average). `migrateFromSyncedSettings` is a
  one-time, entirely server-side migration (never receives the old blob as a mutation argument —
  it's read from the database inside the mutation itself) for anyone who already had a library
  synced the old way before this fix landed, called once per sign-in from the new hook; it's
  provably safe from hitting the very limit it exists to work around, since the old blob could only
  ever have been successfully *written* in the first place if it was already under 1 MiB — the
  failure this fixes was always a rejected *write*, never a value that made it into storage
  oversized. Verified end to end against the real dev Convex deployment (not just `tsc`/
  `next build`): `npx convex dev --once` deploys the new schema/functions cleanly, and a plain
  Node script using `ConvexHttpClient` confirmed the deployed functions are correctly wired and
  behave as expected when called unauthenticated (`library` returns the empty shape rather than
  throwing, `importSongs` throws "Not signed in", `getSongsBars` returns `{}`) — this sandbox still
  can't authenticate as a real user to exercise an actual import end to end, so the one thing this
  *doesn't* prove is that a real "massive playlist" import now actually succeeds for Jack, only
  that the architecture that was silently guaranteed to fail no longer has that specific failure
  mode built into it.

  **Transpose** (per a direct follow-up request, "transpose any of the chord charts into a
  different key"): `lib/iRealPro.ts`'s `transposeSong(song, semitones)` is a pure function that
  returns a new `IRealSong` with every chord's root, slash bass, and the printed key label shifted
  by `semitones`, leaving the quality suffix (`-7`, `^7`, `sus4`, ...) untouched since none of that
  text is a note name. It wraps at the octave (`+13` behaves like `+1` — a chord symbol carries no
  octave of its own) and returns the exact same object, not a copy, for `semitones: 0`, so a call
  site can apply it unconditionally without a special case for "not transposed." Respelling uses a
  fixed table (`PREFER_FLAT`) rather than trying to preserve whatever accidentals the original
  chart happened to use: flats for every altered pitch class except F#, matching how real jazz
  lead books actually spell a transposed key (`Db7`, `Ebm7`, but `F#7` rather than `Gb7`) — getting
  this exactly right for every possible key would need genuine key-signature analysis this app
  doesn't do anywhere else, so it's a deliberate, documented approximation rather than a claim of
  always matching a real book's own spelling.

  This is purely a *display* transform, never written back into the library — the same
  "device-local display preference, not real tool data" category `ChordCharts.tsx`'s existing
  "bars per row" setting is in, just one step more ephemeral: the chosen key is plain `useState`
  (not even `usePersistedSettings`), and resets to "Original" whenever a different tune is
  selected, so a transpose left on from the last chart you looked at can never silently carry over
  and surprise you on the next one. Reset-on-selection-change is done as a render-time state
  adjustment (`if (selectedId !== lastSelectedId) { setLastSelectedId(selectedId);
  setTransposeKey(""); }`) rather than a `useEffect`, the pattern React's own docs recommend for
  "adjust state when a prop changes" — no extra render/flash, and no
  `react-hooks/set-state-in-effect` lint issue to route around (see `AccountMenu.tsx`'s own note
  elsewhere in this file for hitting that rule the effect-based way).

  The control itself is a **key dropdown** (`Select`, the same combobox every other picker in this
  app uses), not a +/- stepper — an explicit direct follow-up correcting an earlier version that
  used semitone-at-a-time −/+ buttons ("the key should be a drop down with all the keys and not a
  + - thing"). `lib/iRealPro.ts` exports `KEY_NAMES` (the 12 pitch classes' canonical names, same
  `PREFER_FLAT` spelling `transposeSong` itself uses — `C, Db, D, Eb, E, F, F#, G, Ab, A, Bb, B`)
  and `keyPitchClass(key)` (a chart's own printed key label's tonic pitch class, or `0`/C if the
  label doesn't parse). The "Display" panel's "Key" row offers "Original (<the chart's own key>)"
  plus all 12 names; picking one computes the semitone distance from the chart's *own* key to the
  chosen one (`(KEY_NAMES.indexOf(transposeKey) - keyPitchClass(selected.key) + 12) % 12`, always
  landing in 0-11 since `transposeSong` itself wraps at the octave) and feeds that into
  `transposeSong`. `ChordCharts.tsx` computes `displayed` from this once (`useMemo`) and passes
  `displayed`, not the library's own `selected`, into every `<ChordChart>` render — so the original
  song object in the library is never touched, only what's handed to the renderer for that one
  view. The earlier version also had a second, compact floating pill near the Maximize button for
  quick access without opening the Display panel; that was dropped rather than turned into a
  second dropdown, both because a full `Select` button (label text + chevron) is noticeably wider
  than the icon-only Maximize button it would have sat next to — a real collision risk against the
  chart's own left-aligned title at narrow widths that the old slim +/- pill didn't have — and
  because the dropdown already makes picking a specific key a single action, the main reason a
  quick-access shortcut existed for the old increment-by-one control in the first place.

  Verified with two synthetic Node scripts run directly against the real functions (not mocks).
  The first, against `transposeSong` alone: a real tokenized chart's `+0` returns the identical
  object; `+12` (a full octave) leaves every bar and the key completely unchanged; `+2` correctly
  shifts a chord's root and the printed key while leaving its quality suffix untouched; `-1` and
  `+1` land on the expected natural/flat-spelled names (`B`, `Db`); `+6` specifically lands on
  `F#`, not the enharmonic `Gb`, confirming the deliberate exception in `PREFER_FLAT`; a slash
  chord's bass note transposes correctly and stays a slash chord; and `-13` produces bar-for-bar
  identical output to `-1`, confirming the octave wrap. The second, against `KEY_NAMES`/
  `keyPitchClass` and the exact delta calculation `ChordCharts.tsx` now does: `KEY_NAMES` is the
  expected 12-entry list in order; `keyPitchClass` correctly reads `"C"`/`"Bb"`/`"F#-"` (a minor
  suffix doesn't throw off the tonic) and falls back to `0` for an empty or garbage key string
  rather than throwing; picking each of the 12 `KEY_NAMES` options from a chart in "Bb" computes a
  delta that lands `transposeSong` on exactly that target key, for all 12; and re-selecting the
  chart's own key (picking "Bb" from a chart already in "Bb") is a true no-op — the identical
  object back, not just equivalent content. `tsc`, `eslint`, and `next build` all pass. **Not
  verified**: how the transposed chart actually looks rendered (whether `Db`/`F#` etc. read
  clearly through `ChordLabel`'s existing accidental glyphs, which were only ever exercised
  against an original chart's own accidentals before now) or whether the dropdown itself opens/
  positions sensibly from inside the "Display" panel in a real browser — this sandbox still has no
  working browser, same caveat as everything else UI-shaped in Chord Charts.

  **jackshed's own chart-link format, and a from-scratch chart builder** (per a direct request:
  "make a custom way of representing chord charts in a string kinda like the irealpro links... if
  I paste an ireal pro playlist link into there it should still worki but I dont want it to say
  anywhere that you can do that... create a tool within the chord chart page to create chord
  charts"). Three pieces:
  - `lib/chartString.ts` — `encodeChartString`/`decodeChartString`, a `jackshed://<base64 JSON>`
    string encoding the exact same `IRealPlaylist`/`IRealSong`/`Bar` shape this app already parses
    an iReal chart into, rather than inventing a second token grammar to mimic iReal's own scrambled
    encoding — "kinda like the irealpro links" in that it's one opaque, copy-pasteable string, not
    in how it's actually encoded underneath. UTF-8-safe via `TextEncoder`/`TextDecoder` +
    `btoa`/`atob` (not the deprecated `escape`/`unescape` trick), so a title/composer with accented
    characters round-trips correctly. `decodeChartString` is tolerant of a malformed individual
    song the same way `lib/profileTunes.ts`'s `resolvePublicTunes` already is — a bad entry is
    dropped (missing/wrong-typed fields fall back to sane defaults, e.g. a missing time signature
    becomes 4/4) rather than failing the whole import — and its own error message is deliberately
    generic, never naming iReal Pro, since it's the message a normal user actually sees.
  - **"Import a playlist" now reads this format first** (`ChordCharts.tsx`'s `parsePlaylistInput`):
    `looksLikeChartString` checks for the `jackshed://` prefix, and only if that doesn't match does
    it fall through to the *existing*, completely unmodified `parseIrealPlaylist` — a real iReal
    Pro link genuinely still works, exactly as before, but that fallback is now quiet on purpose:
    the panel's hint text, its textarea placeholder, and the generic catch-all error shown when
    *neither* parser recognizes the input were all rewritten to never mention iReal Pro or
    `irealb://` anywhere a user can see them (grepped the whole user-visible surface for both
    strings afterward to check for a leak, not just the obvious spots — caught and fixed one real
    one this way: `components/tools.tsx`'s `NAV_LINKS` description for this tool, "Import iReal Pro
    playlists...", shown in the sidebar/command palette, had the exact same problem and wasn't
    something a first pass over just `ChordCharts.tsx` would have caught). Code comments inside
    `lib/iRealPro.ts`/`ChordChart.tsx` explaining *why* the parser/renderer work the way they do
    still reference iReal Pro by name, deliberately — that's maintainer-facing, not the user-facing
    surface the request was actually about.
  - **`ChordChartEditor.tsx`** — the new "Create a chord chart" panel's modal, a from-scratch
    builder reached from its own button next to "Import a playlist." Deliberately scoped down from
    everything a pasted iReal chart can represent — no repeats, numbered endings, sections, or
    directives, just a flat ordered list of bars — per the request's own "doesn't need to be crazy
    right now... no need to make it perfect as long as the functionality is there." Metadata
    (title/composer/style/key/time signature) are plain fields; each bar is typed as one line of
    plain text in the *exact* iReal-style shorthand this app already uses everywhere else
    ("`C^7`", "`F-7`", "`Bb7#5/D`", "`NC`" for no chord, space-separated for more than one chord in
    a bar) — reusing the notation rather than building a second, structured per-field chord picker,
    so there's exactly one chord grammar in this app to learn, not two. Two new exports in
    `lib/iRealPro.ts` make this possible: `parseChordToken` (one token -> a `ChordSlot`, reusing
    the same `CHORD_RE`/`splitMain` `tokenizeChart` itself already uses, just applied to a
    standalone token instead of a parsing stream, with a `normalizeChordToken` uppercase-the-letter
    convenience for hand-typed input a pasted chart never needed) and `parseBarSlots` (one bar's
    space-separated tokens -> that bar's slots, silently dropping an unrecognized token rather than
    failing the whole bar, so one typo doesn't erase everything else already typed in that bar). A
    live preview renders the chart being built through the *same* `ChordChart` component every
    other chart in this tool uses — not a separate approximation of it — which doubles as the only
    validation feedback: a typo just doesn't show up as a chord in the preview, rather than a
    separate per-token error message. Two ways a built chart leaves the modal, both reachable from
    its footer: **Save to library** (calls the same `importSongs` "Import a playlist" itself uses,
    in a playlist named after the chart's own title — "every chart is in a playlist" holds the same
    way here as for anything else added to the library) and **Export as chart link** (reveals the
    `jackshed://` string in a read-only textarea with a Copy button, `navigator.clipboard.writeText`
    with no fallback — this app's first use of the Clipboard API, and a genuine platform-only
    choice: if permission is denied or the API's unavailable, the text is still visible and
    selectable by hand in the textarea, so there's no dead end, just a smaller convenience lost).
    Both require a non-empty title first (an inline error message, same shape as every other
    required-field validation already in this app, e.g. Community's own "Give this post a title.").

  Verified with two synthetic Node scripts run directly against the real functions (not mocks).
  The first, against `parseChordToken`/`parseBarSlots`: `"C^7"` and lowercase `"c^7"` both parse to
  the identical chord (confirming the uppercase normalization); `"Bb7#5/D"` correctly splits into
  root/accidental/quality/bass; `"NC"`/`"nc"` both parse as no-chord; a bare `"W7"` (iReal's own
  mid-chart "repeat the last chord" marker, meaningless with no previous-chord context here) is
  correctly rejected rather than silently becoming a chord with an invalid `"W"` root; garbage
  input returns `null` rather than throwing; and a bad token in the middle of a multi-chord bar is
  dropped while the good tokens on either side survive. The second, against
  `encodeChartString`/`decodeChartString`: a full song (multiple bars, a two-chord bar, a blank
  bar, accented-safe title/composer/key) round-trips through encode-then-decode byte-for-byte
  identical to the original; `looksLikeChartString` correctly recognizes the app's own output and
  correctly rejects both a real iReal-style `irealb://` string and arbitrary plain text (confirming
  the two formats stay genuinely distinguishable, not just informally); a non-matching string
  throws an error that was checked, by regex, to never contain the word "ireal" anywhere in its
  message; garbage base64 after a valid `jackshed://` prefix throws instead of crashing; and a
  payload with one well-formed song alongside a titleless object and a bare number correctly keeps
  only the one valid song, with its missing time signature defaulting to 4/4 rather than throwing.
  `tsc`, `eslint`, and `next build` all pass. **Not verified**: that a real iReal Pro link *itself*
  still parses successfully through the now-wrapped fallback path — `parseIrealPlaylist`'s own
  internals are completely untouched by this change (only wrapped in a try/catch one level up), and
  that function was already extensively verified against a real ~1,460-song forum playlist in an
  earlier session (see this tool's own bullet above), so there's no new risk introduced here
  specifically — but this sandbox has no real iReal Pro link on hand to re-run that exact check
  against after the wrapping. Also unverified, the same way everything else in this tool is:
  whether the Copy button's clipboard permission prompt (if a browser shows one) interrupts the
  flow at all, and whether typing chord shorthand by hand feels as easy as the request asked for —
  "as easy to understand as possible" is a UX claim this sandbox has no way to confirm by actually
  using the tool. (`ChordChartEditor`'s original bar-list/live-preview layout described here was
  superseded by the inline-on-the-chart redesign below, two direct follow-ups later.)

  **Layout fix** (a direct follow-up with a screenshot: "not so much space between the options and
  the chart... so like the other pages where everything is in a column in the center"): the options
  sidebar + chart row's own wrapper div had `xl:min-h-[calc(100vh-10rem)] xl:items-center` and no
  width cap — forcing the row to nearly the full viewport height and then vertically centering both
  columns inside it, which is what actually produced the huge gap above everything (the options
  column's real content height is nowhere near that forced minimum), not anything about
  `ToolLayout`'s own `topAligned` prop (already `true` here, and working correctly one level out).
  The uncapped width compounded it horizontally too: `ChordChart.tsx`'s own root div already caps
  and centers the rendered chart at `max-w-2xl` (a deliberate, unrelated design choice, left alone)
  within whatever box it's given, so with no cap on the *row* itself, that box stretched to the
  full remaining viewport width on a wide monitor and centered the chart far right of the
  left-hugging sidebar — exactly the dead space in the screenshot. Fixed by dropping the forced
  min-height and `items-center` (now `xl:items-start`, both columns just take their own natural
  height) and adding `mx-auto max-w-5xl` to the row — the same width split-layout tool pages
  already use for their own two-region (options + content, no side panel) case, `ToolLayout.tsx`'s
  own `xl:max-w-5xl` — so this now matches "the other pages" literally, the same number, not just a
  similar-looking one. Not a restructure into a single vertical column
  the way `layout="stacked"`'s own built-in options-below-content shape works for Slow Downer/
  Recorder (which this tool's custom Tunes/Import/Create/Display sidebar never actually used in
  the first place — `ChordCharts.tsx` passes `options={null}` to `ToolLayout` and builds its own
  layout entirely inside `children`) — the sidebar-beside-chart arrangement itself wasn't what was
  reported as broken, just the space around it, so that's the only thing this touched. `tsc`,
  `eslint`, and `next build` all pass. **Not verified**: how much of the gap this actually closes
  once seen rendered — the reasoning above is sound (traced both the vertical and horizontal cause
  to specific classes, not guessed), but this sandbox still can't render the page to confirm it
  matches what "like the other pages" was actually asking for.

  **The builder redesigned to type directly on the chart, plus a shared symbol keypad** (a direct
  follow-up: "make it so the chart builder is like when you maximise a chart and it lets you type
  directly on the chart with an add bar button on the right of the last bar... make a little
  keypad like the one on sibelius... for all the symbols"). The original version's separate
  bar-list-on-the-left / `ChordChart`-preview-on-the-right split is gone; bars now live in one grid
  built from `ChordChart.tsx`'s own exports (`COL_WIDTH`, `BAR_HEIGHT`, `chordFont`, `ChordLabel`,
  `FitChordRow`, `TimeSignatureGlyph` — all newly `export`ed, previously private to that file) so
  the editor *is* the chart, not a second approximation of one styled to look similar. Each bar
  (`BarCellEditor`) is one of two things: **not** the active bar, it renders its parsed chords
  through the exact same `ChordLabel`/`FitChordRow` the real chart uses (a faint centered dot if
  still blank); **is** the active bar, it's a plain-text `<input>` showing the raw typed shorthand
  instead — deliberately not auto-converting `^`/`h`/`o`/`#`/`b` into their pretty glyphs live
  while typing, which would fight the text cursor mid-keystroke (the same reasoning Guess the
  Chord's own answer field already settled on, now shared). There's always exactly one active bar
  (`activeIndex`, never `null` — a text-cursor-like "there's always a current position" model, not
  a nullable "maybe nothing's selected" one), which is also where the keypad inserts. Clicking a
  different bar, or pressing Enter, moves it: Enter in the *last* bar adds a new one and jumps
  straight into it (satisfying "an add bar button on the right of the last bar" — that button
  still exists, as a plain `+` sitting in the same flex-wrap row immediately after the last bar
  cell, but Enter is the faster path once you're already typing) — in any other bar, Enter just
  steps to the next one, so typing a whole chart can stay a straight "type, Enter, type, Enter..."
  line. Escape inside a bar's input deliberately `stopPropagation`s rather than bubbling up to this
  modal's own Escape-closes-everything handler — it only blurs that one bar, since losing an entire
  typed-out chart because Escape was meant to back out of one bar would be a bad trade the metadata
  fields above don't have to worry about (a stray Escape there closing the whole modal is
  unchanged, and fine — losing an empty Title field is a much smaller loss). Focusing the
  DOM `<input>` after `activeIndex` changes (adding a bar, or clicking a different one) can't
  happen in the same tick that sets it — the input doesn't exist yet, since the *previous* active
  bar is still the one rendered as an input until the next render commits — so a `focusIndexRef`
  plus a `useEffect` watching `[activeIndex, bars.length]` focuses it exactly once the render
  reflecting the change has actually happened — the same "the DOM doesn't have this yet the same
  tick `setState` was called" timing problem the keypad's own cursor-insertion (below) runs into
  for the identical reason, just solved with a `useEffect` here instead of a bare
  `requestAnimationFrame`, since this one has to wait for a full re-render (a different element
  appearing) rather than just a value settling inside an element that already exists.

  **`components/ChordSymbolKeypad.tsx`** is new, pulled out of Guess the Chord rather than built a
  second time: that trainer already had exactly this — a small grid of buttons for `-`/`^`/`o`/`h`/
  `+`/`#`/`b`/`/`/`sus`/`add`, each showing its `prettyQuality`-formatted glyph as the button face
  and inserting the plain iReal text at the field's current cursor position — per the request
  naming Sibelius's own on-screen keypad as the visual reference, now laid out as a fixed
  `grid-cols-5` (a deliberate small palette, not a loosely wrapping button cloud, closer to what a
  real keypad panel looks like) instead of the `flex flex-wrap` it used before. The component
  itself is purely presentational (`onInsert(key.insert)`, one callback) — *where* the text actually
  gets inserted is each caller's own job, since that differs: Guess the Chord always targets its
  one answer field, the chart builder targets whichever bar is currently active, and the underlying
  "insert at cursor position, wait a frame since the DOM `<input>` doesn't have the new value yet
  the same tick `setState` is called, then restore the caret right after it" logic is otherwise
  identical in both, copied from Guess the Chord's own already-working `insertSymbol` rather than
  reinvented. Extracting this shrank `GuessTheChord.tsx` enough that two pre-existing
  `eslint-disable-next-line react-hooks/purity` comments (documented elsewhere in this file, on
  `lockInRound`/`start` — the React Compiler's lint integration bails out of analyzing a
  large/complex component before it would reach that `performance.now()` call, the same false
  positive Guess the Interval's identical pattern still gets flagged for) became genuinely unused
  — `eslint` said so directly (`Unused eslint-disable directive`), not guessed — and were removed;
  Guess the Interval's own pair, in its own separate, still-large file, are untouched and still
  needed.

  A real correctness bug was caught in self-review (not by any tooling — this is plain JS logic
  `tsc`/`eslint` have no way to reason about) and fixed before this ever got used: `removeBar`
  originally just clamped `activeIndex` to the new bar count after a deletion
  (`Math.min(activeIndex, next.length - 1)`), which is right when the removed bar came *after* the
  active one but silently wrong when it came *before* — every later bar's index shifts down by one
  when an earlier bar is deleted, so a plain clamp leaves `activeIndex` pointing at the bar that
  now happens to sit at that old number, not the bar that was actually being edited (e.g. bars
  `[A,B,C,D]` with `C` active, deleting `A`, would silently leave `D` marked active instead of `C`
  tracking its new position). Fixed to shift `activeIndex` down by one specifically when the
  removed bar's index was less than it, verified with a small synthetic script checking all four
  relative orderings (removed-before-active, removed-after, removing the active bar itself, and
  the down-to-one-bar edge case) plus the existing clamp — all five pass.

  Verified: `tsc`, `eslint` (including confirming zero new warnings, and that the two now-stale
  `eslint-disable` comments were safe to remove rather than masking a real regression), and
  `next build` all pass; `git diff --stat` confirms `GuessTheChord.tsx` only shrank (its own
  keypad array and JSX replaced by one `<ChordSymbolKeypad>` call) rather than having any of its
  actual answer-grading logic touched. **Not verified**, the same as this whole tool's UI: whether
  clicking between bars, typing, and using the keypad actually feels like "typing directly on the
  chart" the way the request pictured it, whether the display-mode `ChordLabel` rendering (natural,
  unscaled size — this grid deliberately doesn't run through `PageFit`'s scale-to-fit the way a
  real rendered chart does, so it can stay a stable, always-editable size instead of shrinking for
  a long chart) reads clearly at that size inside the modal, and whether Enter-to-advance and the
  keypad's cursor-insertion behave correctly across real browsers and real keyboards — this
  sandbox still has no way to click through any of it.
- **Slow Downer** — load a local audio/video file, slow playback without pitch shift, loop
  sections, add named markers with notes, zoom/pan the waveform.
- **Recorder** — multitrack recording: per-track clips, punch-in recording, trim/crop/repeat/move
  clips (even between tracks), automatic recording/playback sync via an inaudible burst-tone
  trick (`lib/syncBurst.ts`), a "align to beat" pitch-based nudge (`lib/alignBeat.ts`), WAV
  export/mixdown. **Desktop-only** — greyed out on phones via `desktopOnly` in
  `components/tools.tsx`'s `NAV_LINKS`.
- **Community** (`components/Community.tsx`, `app/community/page.tsx`) — this app's first public,
  social feature; a new `"Community"` `NAV_LINKS` category on its own, reachable (like every other
  page here) without an account. Has its own left sidebar — Search / Following / Chord Charts —
  using the exact same `SidebarNavButton` (`components/SidebarNavButton.tsx`, pulled out of
  `/account`'s own sidebar into a shared component) `/account` itself uses, per a direct request to
  give this page "the same sidebar thing." **Search** is a username-only search box (not
  instrument/tune — an explicit scoping call) over every `isPublic` profile, via
  `convex/profiles.ts`'s `search` — a plain scan-and-filter over public profiles rather than a real
  search index, since this is a small personal-project directory, not a large-scale service.
  **Following** reuses `FollowLists` wholesale (the same component `/account`'s own Following tab
  renders — both who you follow and who follows you), per a direct follow-up request for "a
  section for people you follow" here too, not just on the account page. **Chord Charts**
  (`components/CommunityChordCharts.tsx`) is this app's first user-generated content — see its own
  paragraph below. Since this page (unlike `/account`) is reachable signed out, `Community` gates
  the Following and Chord Charts views itself — `useConvexAuth()`'s `isLoading`/`isAuthenticated`
  picks between a loading spinner, the real content, or a sign-in prompt — rather than mounting
  either unconditionally: `FollowLists`' own `useQuery(api.users.current)` gate only checks for
  "still loading" (`user === undefined`), not "definitely signed out" (`user === null`), so
  mounting it while signed out would leave its lists stuck spinning forever, and
  `CommunityChordCharts` is deliberately signed-in-only per Jack's own scoping call (browsing needs
  an account, even though search doesn't); `/account` never hits either problem because that whole
  page is already gated behind being signed in before any tab ever renders. See "Public profiles &
  follows" under Backend (Convex) below for the follow/profile feature, and "Community chord
  charts"/"Community tunes" further down for the two posting sections — the public profile page
  itself (`app/u/[username]/page.tsx`) isn't a "tool" with a nav entry of its own, just what a
  Community search result (or a shared link) leads to.
- **Community chord charts** (`components/CommunityChordCharts.tsx`, `convex/communityChordCharts.ts`)
  — the Community page's third section: browse chord charts and playlists other users have posted,
  and import any of them straight into your own Chord Charts library. Went through two real
  storage designs, both broken at actual scale, before landing on the current one — worth reading
  in order since each failure directly shaped the next design:
  1. **v1**: one `communityChordCharts` document per post, `songs: v.any()` holding every song
     inline, full `bars` included. Broke the same way the personal library's original blob did —
     `create` (`songIds.length` used to be `songs.length`) had a `MAX_SONGS_PER_POST = 100` cap
     specifically to stay under Convex's 1 MiB single-document limit, but Jack wanted to post the
     whole jazz-standards forum playlist (~1,400 charts), which both the cap and the underlying
     document size would have rejected outright.
  2. **v2**: kept posting/importing on the client, but had it fetch every selected song's `bars`
     in one bulk call (`chordCharts.getSongsBars`, an object keyed by song id) right before
     posting, so the post itself could still be assembled and sent in one `create` call. This
     traded the document-size problem for a different Convex limit: a plain object can have at
     most 1024 fields, and a 1,410-song bulk fetch needed 1,410 keys —
     `chordCharts.js:getSongsBars return value invalid: Object has too many fields (1410 > maximum
     number 1024)`.
  3. **Current**: **songs live in their own table** (`communityChordChartSongs`, one row per song,
     indexed `by_post` — the post row itself only holds `songCount`), the same
     one-row-per-song split the personal library already uses for `chordChartSongs`/
     `chordChartSongBars`. And, critically, **posting and importing never move `bars` through the
     client at all anymore**: `create` takes only `songIds: Id<"chordChartSongs">[]` — ids the
     client already has from its own metadata-only library listing — and copies each song's data
     (`title`/`composer`/`style`/`key`/`timeSignature`/`bars`) straight from the caller's own
     `chordChartSongs`/`chordChartSongBars` rows into fresh `communityChordChartSongs` rows,
     entirely server-side, inside the mutation. Symmetrically, `importIntoLibrary` (new — replaces
     the old client-side `mergeIntoLibrary` call `PostDetailModal` used to make) takes a `postId`
     and optional `songIds` (omitted = "Import all") and copies the other direction, straight from
     `communityChordChartSongs` into the caller's own `chordChartSongs`/`chordChartSongBars`,
     same server-side-only rule. Both share `convex/lib/chordCharts.ts`'s `findOrCreatePlaylist`/
     `songKey` helpers (also used by `chordCharts.importSongs`) so "merge into an existing
     playlist by name" and "skip a song you already have" mean the same thing everywhere a song
     gets added to a library. `get` (opening a post) now returns song *metadata only*, same
     "list cheaply, fetch one thing's bars lazily" split as the personal library's own
     `library`/`getSongBars` — a post's individual songs preview inline via a new
     `communityChordCharts.getSongBars` (one song's bars, fetched only for whichever row is
     currently expanded). Net effect: no operation in this whole feature ever has to hold more
     than *one song's* `bars` in memory or in a single value at once, so post size no longer has
     any practical ceiling tied to Convex's per-document or per-object-field limits —
     `MAX_SONGS_PER_POST` is still a cap (now 3,000, a generous sanity bound rather than a
     size-driven one) purely to keep one `create`/`importIntoLibrary` call's transaction from
     growing unbounded, not because a bigger post would break storage.

  Both `create` and `importIntoLibrary` were spot-verified against the real dev deployment (not
  just `tsc`): an unauthenticated call is correctly rejected, and — since the previous failure was
  specifically about a *shape* of return value (an object with too many fields), not overall
  payload size — a separate temporary query confirmed a 1,500-element *array* return succeeds with
  no comparable limit, which is the shape `get`'s song list now actually uses.

  **Posting requires the caller's own profile to be `isPublic`** (checked server-side in `create`,
  the real source of truth — the UI mirrors it by showing a "make your profile public" prompt
  instead of a Post button when it isn't) — **browsing only requires being signed in**, not a
  public profile of your own. Every read (`list`/`get`/`getSongBars`) drops a post (or song) whose
  author's profile isn't (or is no longer) public, the same privacy rule applied everywhere else
  cross-user data is read in this app, and `convex/account.ts`'s `performDelete` cascades both the
  post rows and their now-separate song rows, so deleting your account doesn't leave posts (or
  orphaned song rows) behind with no reachable author. The browse list (`list`) stays
  metadata-only (title, description, `songCount`, the author's *current* username/avatar).
  Posting (`CreatePostModal`) doesn't accept a pasted iReal link directly — it picks one or more
  songs out of the caller's *own* Chord Charts library, so there's exactly one place (the Chord
  Charts tool itself) that ever parses iReal links. That picker is grouped by playlist (the same
  grouping the tool's own "Tunes" panel shows) rather than one long flat checkbox list, per a
  direct follow-up request ("a better interface for selecting what charts to include... let me
  include entire playlists"): each playlist has its own tri-state checkbox (unchecked/checked/
  indeterminate, using the checkbox DOM node's `.indeterminate` property via a ref callback —
  there's no HTML attribute for it) that selects or clears every song in that playlist at once,
  alongside per-song checkboxes, and a collapse chevron per playlist. Picking a whole playlist as
  the very first selection defaults the post title to that playlist's name — a starting
  suggestion, never overwriting a title already typed. Viewing a post lets each song expand inline
  into the real `ChordChart` renderer before deciding to import it (lazily fetching just that
  song's bars via `getSongBars`), plus an "Import all" shortcut for the whole post — both call
  `importIntoLibrary` directly, so importing a chart you already have (from Community or anywhere
  else) is always a safe no-op rather than a duplicate, and lands in a playlist named after the
  post.
- **Community tunes** (`components/CommunityTunes.tsx`, `convex/communityTunes.ts`) — the Community
  page's fourth section, added right after Chord Charts per a direct follow-up ("there should be
  another section for posting tunes") and built as its sibling in every way: same shape, same
  posting-needs-a-public-profile/browsing-just-needs-an-account split, same metadata-only `list` +
  lazy-loaded-on-open `get`, same account-deletion cascade, same `v.any()`-blob-in-a-dedicated-table
  call (`communityTunes` in `convex/schema.ts`) for the identical "needs to be readable by other
  users, so `syncedSettings` alone can't cover it" reason. A post's `tunes` is a snapshot of
  `PublicTune[]` (`lib/profileTunes.ts` — name/tempos/keys/time signature) taken from the poster's
  own Tunes list (`useSyncedTunes()`) at post time via the new `toPublicTune` export, never
  `notes` — the exact same privacy rule `getPublicByUsername` already applies when a profile's own
  Tunes section resolves live, just run once at posting time instead. `CreatePostModal` here is
  the tune-shaped twin of the chord-charts one: a searchable checkbox list of the caller's own
  tunes instead of their own chord charts, same "post a tune" and "make a tune list" being the same
  action with a different number of boxes checked. The one real difference from Chord Charts:
  viewing a post (`PostDetailModal`) doesn't need its own bespoke row/import UI at all — it hands
  `post.tunes` straight to `PublicTuneList`, the *exact* component a public profile's own Tunes
  section already renders with (name, tempo/key chips, and the "Add"/"Learn" buttons that copy a
  tune into the viewer's own Tunes or Tunes to Learn list with the same name-based dedupe check),
  so browsing a Community tune post and browsing someone's profile page behave identically with no
  second copy of that logic to maintain. Capped at 300 tunes per post (`MAX_TUNES_PER_POST`) —
  higher than Chord Charts' 100, since a tune here is a few small fields, not a full parsed bar
  list, so many more of them fit comfortably under the same practical per-document-size concern.
- **"My Posts" and posts on a public profile** — two direct follow-up requests landed together
  since they're the same underlying gap: `list`'s shared Browse feed is capped at the 60 most
  recent posts across *everyone*, so your own older post could silently fall out of view with no
  way to find it again once enough other people had posted more recently, and there was no way at
  all to see what someone *else* had posted from their profile page. Two new queries per Community
  table (`communityChordCharts.ts`/`communityTunes.ts`), both scoped by the `by_user` index rather
  than `by_createdAt`, so neither is capped the way `list` is:
  - `mine` — every post the signed-in caller has posted, full stop, no `isPublic` filter (it's
    your own data; deleting already worked this way too, scoped purely by ownership). Drives a new
    Browse/My Posts toggle (a plain two-button pill, `view` state) in both `CommunityChordCharts.tsx`
    and `CommunityTunes.tsx` — switches which query's results the shared list renders, reusing the
    exact same row component either way (`PostListItem`, pulled out of each file's own top-level
    component specifically so Browse/My Posts/a profile's posts section all render a post
    identically — see below).
  - `listByUser(userId)` — a specific user's posts, for a public profile's own "Chord Chart Posts"/
    "Tune Posts" sections (`PublicProfilePage.tsx`). Same signed-in-required rule as `list`/`mine`
    (browsing needs an account, even someone else's posts, per Jack's existing scoping call for
    this feature) *plus* the target's profile has to currently be `isPublic` — re-checked
    independently here rather than trusted from the caller, even though `PublicProfilePage.tsx`
    only ever calls this once `getPublicByUsername` has already confirmed it, same "don't trust the
    caller, the query is the real gate" pattern every other cross-user read in this app follows.
  `PostListItem` and `PostDetailModal` are now exported from each Community component file
  (`export function`, not a second copy) and imported into `PublicProfilePage.tsx` aliased per
  source (`ChordChartPostListItem`/`TunePostListItem` etc.) — a post reached from a profile page
  opens in the *exact* same detail modal Community's own Browse/My Posts do, so viewing and
  importing behave identically regardless of which page led you there.

  Building this surfaced a real gap in the privacy rule itself: `get`/`getSongBars`/
  `importIntoLibrary` (chord charts) and `get` (tunes) all used to hide a post from *everyone*,
  including its own author, the moment that author's profile stopped being `isPublic` — meaning
  "My Posts" could list a post its own owner then couldn't actually open. Fixed by adding an
  owner bypass to each (`row.userId !== userId && !profile.isPublic`, rather than just
  `!profile.isPublic`) — your own posts stay visible/manageable to you regardless of your current
  profile visibility, the same way `remove` already worked (no `isPublic` check on it at all,
  scoped purely by ownership); a private profile still hides your posts from *everyone else*,
  which is the part the rule actually exists to protect.

  Verified against the real dev deployment (not just `tsc`): `mine` and `listByUser` both
  correctly return `[]` for an unauthenticated caller, including `listByUser` called with a real
  existing public user's id (not just a not-found one) — confirming "browsing requires an
  account" holds even when the target profile genuinely is public and exists. Not verified: any
  of the actual UI — the Browse/My Posts toggle switching correctly, a profile's posts sections
  rendering and opening the right modal, or the owner-bypass fix actually letting someone view
  their own post after going private (this sandbox has no way to sign in as two different users,
  post as one, go private, and confirm "My Posts" still opens for the owner). A direct follow-up
  request added `max-h-96 overflow-y-auto` to all four of a profile's list sections (Tunes, Tunes
  to Learn, Chord Chart Posts, Tune Posts) so a long one scrolls in place instead of pushing the
  rest of the page down indefinitely — confirmed, separately, that "import each tune to my
  account" was already covered by `PublicTuneList`'s existing `canAdd` prop on the Tunes/Tunes to
  Learn sections (per-tune Add/Learn buttons), not something that needed building. A further
  follow-up restyled `PostListItem` itself (shared by Browse, My Posts, and a profile's posts
  sections in both files) from a stacked card — title/meta, then a flat rectangular "View &
  import"/"View & add" button on its own line below — into a single horizontal row: title/
  description/meta on the left, a delete icon (when `onDelete` is passed) and a solid `bg-accent`
  "View" pill on the right, both vertically centered against the row via the `<li>`'s own
  `items-center`. `bg-accent` reads as blue by design here (`app/globals.css`'s `--accent`,
  `#6366f1`/`#818cf8` light/dark) — the same token every other primary action button in this app
  already uses (`Post a chart`, `Import all`, ...), not a one-off color picked for this button.
  A further follow-up request added search to both Community list views (Browse and My Posts,
  same input/filter in both files) — typing filters by the post's own title *or* any individual
  song/tune name inside it, not just the title. Chord charts needed a small schema addition —
  `communityChordCharts.songTitles: v.optional(v.array(v.string()))`, accumulated once in
  `create` alongside `songCount` — since a post's individual song names otherwise only exist
  inside `communityChordChartSongs` rows, which `list`/`mine` deliberately never read (the same
  cost `getSongsBars` blew up over — see the two-Convex-bug section below); denormalizing just the
  titles onto the post row keeps search free at read time without re-introducing that cost. Tunes
  needed no schema change at all: a tune post's `tunes` field is already inline `v.any()` on the
  row (small, capped at `MAX_TUNES_PER_POST`), so `communityTunes.ts`'s new `tuneNamesOf` helper
  just derives names from it defensively on every read instead of storing them separately. Both
  `summarizePost` functions now return the name list, and each file's top-level component filters
  its visible list client-side with a case-insensitive substring match against title-or-any-name,
  via a `useMemo` keyed off the trimmed/lowercased query. A `SearchIcon` + `<input type="search">`
  row (same shape used elsewhere in this app) sits above the list, only shown once there's
  something to search; the empty state distinguishes "no posts match your search" from "nobody's
  posted here yet". Verified with `tsc`, `eslint`, and `next build`; not verified by actually
  typing into the box in a browser, same caveat as everything else in Community this session.
- **Home** (`app/page.tsx` / `components/Home.tsx`) — an actual landing page, not a tool directory.
  Went through two very different designs this session: the first rendered every `NAV_LINKS` entry
  as an icon-card grid, grouped by category via the sidebar/command palette's own `groupByCategory`
  helper — a genuinely complete site overview, but one that read like generated documentation
  (a wall of identical cards) rather than a page meant to make a case for the site. Per a direct
  follow-up request to redo it as a real, "somewhat artistic" landing page instead — and
  specifically not "obviously AI generated" — it's a short, editorial single column now: a big
  two-tone "jack**shed**" wordmark (the "shed" in accent color, no gradient text, no icon logo —
  see below); a hand-picked, fixed-array waveform-bar strip under the hero (`WAVEFORM`, tuned by
  hand rather than `Math.random()`'d at render time, which would be a real hydration mismatch — the
  same class of bug `CollapsiblePanel.tsx`'s own "always render the chevron" comment warns about
  elsewhere in this app); a short first-person paragraph in Jack's own voice about *why* this exists
  (styled as a blockquote — a left accent border, not a boxed card) instead of impersonal marketing
  copy; and a curated "A few favorites" list of five of the ~14 tools (not all of them — picked for
  range: a practice tool, an ear trainer, a novelty metronome, a chart reader, and the recorder),
  each written up as its own real sentence with a large faint index numeral (01–05, alternately
  indented for a less perfectly-gridded rhythm) rather than reduced to an icon and a
  three-word fragment. Every tool is still fully reachable — nothing was removed, just no longer
  duplicated on this page — via the sidebar and the `/` command palette, which is what `NAV_LINKS`
  is actually for. Closes with one quiet line about accounts being entirely optional (linking to
  `/community`) instead of a separate "Ready to get started?" CTA banner, and the same footer as
  before. There's no separate icon logo anywhere in the app anymore either, per an earlier follow-up
  request in this same session — the old hand-drawn barn-roof SVG, `BarnLogo` in
  `components/tools.tsx`, was deleted outright (not just unmounted), along with its icon-box wrapper
  in both the desktop and mobile sidebar headers — the "jackshed" text itself is the logo
  everywhere now. Shows "Welcome back, {name}" above the title once signed in — `user.name` (only
  ever set by Google sign-in) if there is one, `user.email` otherwise, since every account has one
  or the other but not necessarily both, same fallback order this app already uses elsewhere for a
  short signed-in label (`AccountMenu.tsx`'s collapsed button, `AccountPage.tsx`'s own subtitle).
  Gated on both `useConvexAuth()`'s `isAuthenticated` and the `api.users.current` query actually
  resolving, so a signed-in visitor never sees a flash of the signed-out version first.
- **Privacy Policy / Terms of Service** (`app/privacy/page.tsx`, `app/terms/page.tsx`,
  `components/LegalPage.tsx`) — plain prose pages, not tools (no `ToolLayout`), and plain Server
  Components (no `"use client"` anywhere in either — no interactivity needed). Linked from
  `Home.tsx`'s footer and, only during the sign-up flow specifically, `AccountMenu.tsx`'s
  `AuthForm`. Written to accurately describe what this app *actually* does (client-side-only
  tool data, what an account collects, the Convex/Resend/Google/Vercel third parties involved,
  no analytics/tracking anywhere in the codebase — confirmed by grepping for common trackers
  before writing this), with jurisdiction (Los Angeles County, California) and the
  privacy-request contact channel (GitHub issues, reusing what `README.md` already directs bug
  reports to) both confirmed with Jack rather than assumed. **Not reviewed by an actual lawyer**
  — a reasonable, honest starting point given this app's genuinely low-risk profile (no payments,
  no ads, minimal data collection), not a substitute for real legal review if that ever matters
  more (e.g. it picks up real users, or the planned data-sync phases land).

## Backend (Convex)

Phase 1 was accounts only, nothing synced; Practice Timer's saved sessions came next as the first
synced *domain* (its own dedicated `practiceSessions` table — see its bullet in the tools list
above). This phase generalized that to **every tool's settings and data**, in one pass rather than
domain-by-domain: tunes, every trainer's instrument/tolerance/playback/pool settings *and* their
lifetime struggle stats and timed history, the Chord Charts library, Metronome/Tuner/Slow Downer/
Recorder's settings, all of it. Every tool still works fully with no account — signing in is still
a pure addition, never a requirement.

**The sync rule is the same everywhere, and it's deliberately simple: no merge.** Signed out, a
tool reads/writes this device's localStorage exactly as it always has. Signed in, it reads/writes
the account instead, full stop — whatever's already in localStorage on that device is **not**
imported, merged, or offered as a choice; it's just not consulted anymore. This was an explicit
simplification Jack asked for over a fancier first-login merge-prompt design that had been
sketched earlier (three-way "keep local / use synced / merge both" choice) — simpler to reason
about, simpler to implement correctly, and the risk case an elaborate merge exists to avoid
(silently losing data) can't happen when there's nothing automatic to get wrong: you'd have to
explicitly want the account's version by signing in.

**One generic mechanism covers nearly all of it**, rather than a hand-typed Convex table per tool
(what the original two-domain plan called for, and genuinely fine at that scale — not at
literally-every-tool scale). Every tool's settings object already round-trips through
`JSON.stringify`/`JSON.parse` for `usePersistedSettings` (`lib/usePersistedSettings.ts`) — that's
what makes it localStorage-safe today — so it's already guaranteed JSON-safe, and storing it as
one opaque blob account-side means a new tool, or a new field on an existing tool's settings, never
needs a matching schema change on the Convex side:
- `convex/schema.ts`'s `syncedSettings` table — one row per `(userId, key)`, `value` holding that
  tool's *entire* settings object as one JSON string. `key` is simply that tool's own existing
  localStorage key string, reused as-is (e.g. `"jam-practice-note-trainer"`,
  `"jam-practice-metronome"`) — one obvious key per call site, not a second naming scheme to keep
  in sync alongside it. `convex/syncedSettings.ts` (`get`/`set`, both scoped to
  `getAuthUserId(ctx)`) is the only Convex code this needed.
- `lib/syncedStore.ts` — the shared machinery underneath `useSyncedSettings`/`useSyncedTunes`: a
  module-level, per-`key` in-memory cache of "the current value while signed in"
  (`getSyncedValue`/`setSyncedValue`/`seedSynced`/`resetSynced`/`subscribeSynced`), updated
  *synchronously* on every local edit and written to Convex only after a `DEBOUNCE_MS` (600ms)
  quiet period. This exists because the first version of these hooks — writing straight to Convex
  on every `update()` call, with "current value" derived fresh from `useQuery`'s result each
  render — had two real problems, both hit directly: adding several tunes quickly (multiple
  standards in a row) silently dropped all but the last one, and the whole site felt sluggish
  since *every* setting change, however small, was a live network round-trip. The stale-closure
  drop happened because two rapid `update()` calls both closed over the same pre-edit snapshot (the
  query hadn't echoed the first write back yet), so the second call's "previous value" excluded the
  first call's edit; keeping the authoritative "current value" in a synchronous module-level cache
  instead of a value closed over from a stale render fixes that — every edit reads whatever the
  *last* edit actually left behind, never a stale echo. The network-call flood is fixed by the
  debounce: a local edit updates the cache and every subscribed component instantly (still feels
  synchronous to type/drag against), but only the *last* value in a burst of edits actually gets
  sent, once the burst goes quiet. `seedSynced` only applies a value the *first* time a real server
  read arrives for a key in the current signed-in session (never overwriting an edit already made
  locally with a lagging echo of the old value); `resetSynced`, called on sign-out, clears that
  so a different account signing in afterward re-seeds fresh instead of quietly showing the
  previous account's cached values — and flushes any not-yet-fired debounced write immediately
  first, so an edit made right before signing out still lands rather than being silently dropped.
  Verified with a synthetic Node script exercising all of this directly (rapid-edit accumulation +
  single collapsed write, seed-never-clobbers-a-local-edit, reset-flushes-then-clears) — see
  "What's genuinely untested" for what that script can't cover (an actual live Convex round-trip).
- `lib/useSyncedSettings.ts` — a **drop-in replacement** for `usePersistedSettings(key, defaults)`:
  identical signature, identical `[settings, update]` return shape, identical "defaults must be a
  stable module-level object" rule. Signed out it's a pure passthrough to the real
  `usePersistedSettings` (zero behavior change, zero regression risk — it's the same code
  underneath) *and* the Convex query is passed `"skip"` instead of real args, so a signed-out
  visitor never opens a live subscription for data they can't have at all (a real, avoidable cost
  the first version paid on every tool, every page load, regardless of sign-in state). Signed in,
  it reads/writes through `syncedStore.ts` as described above. The defensive "keep only fields
  whose type matches defaults" logic that protects a tool's UI from corrupt/foreign localStorage
  data (`mergeWithDefaults`, extracted out of `lib/usePersistedSettings.ts`'s previously-private
  `read()` so both paths share it) applies identically to whatever comes back from the account, for
  the same reason. Every tool's own `usePersistedSettings(SETTINGS_KEY, DEFAULT_SETTINGS)` call
  became `useSyncedSettings(SETTINGS_KEY, DEFAULT_SETTINGS)` — that one-line swap, nothing else in
  the component changed, since `noteStats`/`history`/every other field a trainer already keeps in
  that same settings object rides along automatically. Both `useConvexAuth()` and the underlying
  Convex `useQuery`/`useMutation` calls run unconditionally regardless of sign-in state, per
  rules-of-hooks — only the *returned* value, what `update` writes, and the query's `"skip"`
  argument branch on it (same pattern as every other signed-in-aware code in this codebase, e.g.
  `AccountPage.tsx`).
- `lib/useSyncedTunes.ts` — the one exception to "every tool goes through `useSyncedSettings`":
  Jam Practice's tune list isn't a `usePersistedSettings` object, it's `lib/tunesStore.ts`'s own
  hand-rolled external store (`subscribe`/`getSnapshot`/`setTunes`, used directly via
  `useSyncExternalStore` at four separate call sites — `JamPractice.tsx`, `TunesPanel.tsx`,
  `TunesManager.tsx`, `StandardsPicker.tsx`). Same "one JSON blob per key" shape fits it fine
  though, so it rides the *same* `syncedSettings` table, `syncedStore.ts` debounce/race-fix
  machinery, and `"skip"`-when-signed-out optimization under a fixed key, `"tunes"` — no table of
  its own. `useSyncedTunes()` is a drop-in replacement for that `useSyncExternalStore(...)` triple,
  returning the same `[tunes, setTunes]` shape, so all four call sites needed only an import swap.
  The debounced write in `syncedStore.ts` fires from a `setTimeout` (not from inside a React
  render) but still calls the owning hook's own `useMutation`-returned function, captured in the
  closure `setSyncedValue`/`resetSynced` are given — confirmed safe by reading Convex's own
  `useMutation` source (`node_modules/convex/dist/esm/react/client.js`): it returns a plain
  function bound only to the client instance and the mutation reference via `useMemo`, with no
  dependency on the calling component's own mount state, so it's still callable well after that
  component has unmounted.
- **What deliberately did *not* move to this mechanism**, and why:
  - Pure UI chrome — `CollapsiblePanel`/`OptionsCard`'s open/collapsed + "show hints" state
    (`lib/panels.ts`), the sidebar's width/collapsed state (`components/Sidebar.tsx`), the
    options-column/side-panel hidden toggles. None of this is "this tool's data" the way Jack meant
    it — it's per-device layout, and a phone and a desktop reasonably want different panel layouts
    anyway. Stayed on plain `usePersistedSettings`, unaffected by sign-in.
  - Chord Charts' `VIEW_KEY` (`selectedId`, `barsPerRow`) — a device-local display preference, not
    data — this file already drew exactly this line between `LIBRARY_KEY` (synced) and `VIEW_KEY`
    (not) before sync existed at all; sync just followed the line that was already there.
  - Waveform markers (`lib/markers.ts`) — small JSON, but keyed to a locally-uploaded file
    (`"<filename>|<filesize>"`) that isn't itself synced (see next bullet), so a synced marker set
    would be a dangling reference pointing at nothing on another device.
  - Recorder's project metadata and Slow Downer's loaded files — genuinely out of scope, unchanged
    from the original plan: the actual audio lives in IndexedDB as `Blob`s (`lib/projectStore.ts`,
    `lib/fileLibrary.ts`), which needs Convex file storage and a real sync design, not a JSON blob
    write. Both tools' small *settings* objects (volume, snap, track height, ...) did switch to
    `useSyncedSettings` like everything else — only the large binary data stayed local.
  - Theme (`lib/theme.ts`) — arguably could be nice to follow you across devices, but it's an
    app-wide display preference, not a specific tool's "options" in the sense Jack asked for, and
    wasn't part of this request — left alone, a candidate for later if it's ever actually wanted.

**Deploying it — two separate targets, not automatic together by default.** A `git push` alone
only redeploys the frontend (Vercel); it does *not* push anything under `convex/` to the
production Convex deployment (`grandiose-dolphin-564`) — that's a genuinely separate step
(`npx convex deploy`) unless wired together, which `vercel.json`'s `buildCommand` now does:
```
npx convex deploy --cmd 'pnpm build'
```
This deploys Convex functions *before* building the frontend, on every Vercel build, so the two
can't drift out of sync (a frontend build that depends on a Convex function that hasn't been
deployed yet would otherwise just break in production). It authenticates via a `CONVEX_DEPLOY_KEY`
environment variable in Vercel (a **Production**-scoped deploy key from the Convex dashboard's
Deploy Keys page — deliberately not set for Preview/Development, so a future preview-branch build
can't accidentally push to production Convex) rather than a personal login, which is what makes it
safe to run inside an automated build at all — `npx convex deploy` refuses to run non-interactively
under a personal login (confirmed directly: it prompts "Do you want to push your code to your prod
deployment now?" and hard-refuses even with `CI=1` set or `y` piped into stdin — a deploy key is
the only way around that prompt, not a flag).
- `convex/schema.ts` — `{...authTables}` (Convex Auth's own tables: `users`, `authAccounts`,
  `authSessions`, etc.) plus `pendingConfirmations` (below) and two app-data tables:
  `practiceSessions` (`convex/practiceSessions.ts` — list/create/update/remove, all scoped to
  `getAuthUserId(ctx)`), one row per saved Practice Timer session, shaped like
  `lib/practiceTimer.ts`'s `PracticeSession` minus its own `id` (the Convex document id doubles as
  that once synced); and `syncedSettings` (`convex/syncedSettings.ts` — `get`/`set`), the generic
  one-JSON-blob-per-`(userId, key)` table every other tool's settings (and Jam Practice's tunes)
  sync through — see this section's own paragraph above for why that one's generic rather than
  hand-typed per tool.
- `convex/auth.ts` — `convexAuth({ providers: [Password({ verify: ResendOTP }), Google] })`.
  Google is listed in code already but **won't actually work** until `AUTH_GOOGLE_ID`/
  `AUTH_GOOGLE_SECRET` are set on the deployment (`npx convex env set ...`) and a matching OAuth
  Client ID exists in Google Cloud Console with redirect URI
  `https://<deployment-name>.convex.site/api/auth/callback/google` — a one-time manual step only
  Jack can do (his own Google account). Same story for `verify: ResendOTP` — it needs
  `AUTH_RESEND_KEY` set (a Resend account, its own one-time signup) before it can actually send
  anything; see the email-confirmation bullet below. Until both exist, "Continue with Google"
  fails and password sign-up gets stuck waiting on a code that was never sent — the account page's
  password flows have the exact same dependency.
- **Email** (`convex/lib/resend.ts`, `convex/ResendOTP.ts`) — one shared `sendEmail` helper, a
  thin `fetch()` wrapper around Resend's plain HTTP API (`https://api.resend.com/emails`) rather
  than their Node SDK, since Convex actions can already call external APIs directly — no reason to
  add a dependency just to POST one JSON body with a bearer token. Reads `AUTH_RESEND_KEY` (throws
  a clear "you haven't set this yet" error if it's missing, rather than a confusing failure deeper
  in) and an optional `AUTH_EMAIL_FROM` (defaults to `onboarding@resend.dev`, Resend's own
  no-setup-required sending address — a verified custom domain is a nicer `from` address but isn't
  required to get this working). Two things live here rather than in `convex/account.ts`, since
  both are used by more than one caller: `generateOtp` (a 6-digit numeric code — short enough to
  type by hand, unlike Convex Auth's own 32-character default verification token) and `hashCode`
  (SHA-256 via the Web Crypto API already available in Convex's action runtime — confirmation
  codes are stored hashed, not in plaintext, in `pendingConfirmations` below). `ResendOTP.ts` wraps
  `sendEmail`/`generateOtp` as an `Email`-type provider (`@convex-dev/auth/providers/Email`) for
  Convex Auth's own sign-up verification — see the `auth.ts` bullet above. It only supplies *how*
  to send the code; Convex Auth's `Password` provider already owns *when* to trigger it (a fresh
  sign-up, or any account whose `emailVerified` isn't set yet — traced through the installed
  package's actual source, `Password.ts`'s `authorize` function, to confirm this rather than
  guessing) and the code storage/expiry/one-time-use machinery (`authVerificationCodes`, already
  part of the schema via `authTables`, previously unused since verification was never turned on
  before now).
- `convex/users.ts` — one `current` query (the signed-in user's own doc, or `null`) for the
  account button to show who's signed in. Not a synced-data domain, just identity.
- `components/AccountMenu.tsx` — the sign-in/account UI, **built from scratch, no premade auth
  widget** (Jack asked for this explicitly): signed out, a small custom modal with email+password
  (sign-in/sign-up toggle) and "Continue with Google", styled to match this app's own
  `ConfirmDialog`/`PromptDialog` conventions (same backdrop/panel/Escape-to-close shape). A
  password sign-up (or any pre-existing account that's never verified its email) doesn't complete
  right away — `signIn("password", {...})` resolves with `{signingIn: false}` and no error, which
  the form reads as "a code was emailed" and swaps to a "check your email" step;
  `signIn("password", {email, code, flow: "email-verification"})` completes it. That
  `signingIn`/thrown-error distinction is the only signal the client gets — confirmed by reading
  the actual client `signIn` implementation (`@convex-dev/auth`'s `client.tsx`) rather than
  assuming a shape. Signed in, it's a plain link to the `/account` page instead (below) — mounted
  in `components/Sidebar.tsx` as a sibling of `ThemeButton` in both footers (desktop `<aside>` and
  the mobile overlay), same `collapsed`/`large` prop shape, plus an `onNavigate` so the mobile
  overlay closes itself on tap, same as every other nav link there.
- **`/account`** (`app/account/page.tsx` / `components/AccountPage.tsx`) — password (change or set
  one for the first time), sign-in methods (connect/disconnect Google), and delete account, laid
  out as its own small Profile/Security/Danger zone sidebar (`AccountNavButton`, a plain
  `useState<AccountView>` tab switch, not routing — the page itself widens from the loading/
  signed-out states' `max-w-md` to `max-w-3xl` via `PageShell`'s `wide` prop to fit it, and stacks
  to a full-width column above the content on narrow screens rather than a fixed sidebar): Profile
  is a read-only summary (email, name if the account has one, which providers are linked); Security
  holds `PasswordSection` + `SignInMethodsSection`; Danger zone holds the delete-account section.
  Sign out sits below a divider at the bottom of that same nav list as a direct action (not a
  fourth view — clicking it signs out immediately, same as the plain button it replaced). Creating
  an account, changing/setting a password, and deleting an account (except a Google-only account —
  see below) all now require confirming a code emailed first, per an explicit follow-up request; a
  "forgot password" *reset* flow (recovering access when you don't know your *current* password at
  all) is still deliberately not implemented — a different thing from the email confirmations this
  section describes, and still out of scope. No route protection, consistent with the rest of the
  app — visiting it signed out just shows a plain "you're not signed in" message instead of
  redirecting. `convex/account.ts`'s `linkedProviders` query (which providers — `"password"`,
  `"google"` — are on the signed-in user's `authAccounts` rows) drives which of these sections show
  what.
  - **Password** (`PasswordSection`) is one section that's either "Change password" (has one
    already) or "Set a password" (Google-only so far) — same `linkedProviders` check throughout
    this feature — and now a two-step flow either way: step 1 (`requestPasswordConfirmation`)
    verifies the *current* password if there is one (`retrieveAccount`, throws on a mismatch) and
    emails a code; step 2 (`confirmPassword`) takes that code plus the new password and actually
    applies it, re-checking `linkedProviders` *again* at that point (rather than trusting which
    step-1 path was taken) to decide between `modifyAccountCredentials` (existing password — then
    `invalidateSessions` on every *other* session, since a leaked old password shouldn't still
    work elsewhere) and `createAccount` with `shouldLinkViaEmail: true` (first password — links to
    the *already-signed-in* user by matching their already-verified email rather than accidentally
    creating a second user; Convex Auth's account linking is fundamentally email-match-based, not
    session-based — traced through the installed package's actual source,
    `defaultCreateOrUpdateUser`, to confirm this rather than guessing — with the same defensive
    `linkedUser._id === userId` check as before). The new password is deliberately never sent to
    step 1 at all and never touches the database before step 2 succeeds — it just sits in
    `PasswordSection`'s own React state between the two submits, so a password is never persisted
    anywhere while a confirmation is still pending.
  - **Sign-in methods** (`SignInMethodsSection`) — "Connect Google" is literally the same
    `signIn("google")` OAuth flow as signing in, relying on that same email-matching linking
    behavior; it only lands on *this* account if the Google account's email matches. Since that's a
    real, somewhat confusing failure mode (a mismatched email silently signs into — or creates — a
    *different* account instead, with no error), `useGoogleLinkWarning` records the current email
    in `sessionStorage` right before redirecting to Google, then — on the fresh page load once
    Google redirects back — compares it against whoever's actually signed in and shows a plain-
    language warning if they don't match. Reads the marker once via a lazy `useState` initializer
    (safe — it only runs at mount) and derives the warning as a plain value during render; the
    accompanying `useEffect` only clears the marker (a real side effect against sessionStorage), it
    never calls `setState` itself — hit `react-hooks/set-state-in-effect` on a first draft that did
    call `setState` synchronously inside the effect body, restructured to avoid it. "Disconnect
    Google" (`disconnectGoogle` action) is only enabled once a password exists — checked both
    client-side (the button's `disabled`) and server-side (the action re-checks
    `linkedProviders`, since the action is the real source of truth, not the UI) — so there's
    always at least one way to sign back in. (Disconnecting doesn't need an emailed confirmation
    itself — only creating/deleting/changing credentials does, per the request that added this
    whole section — but it's already gated behind having a password, which is its own form of
    "prove you can still get in another way.")
  - **Delete account** is a confirm-first modal (`DeleteAccountModal`, following `ConfirmDialog`'s
    own shape) with two different paths depending on `linkedProviders`, per an explicit exception
    for accounts with only Google and no password: a password-holding account goes through the
    *same* two-step emailed-confirmation shape as the password section — step 1
    (`requestDeleteConfirmation`) verifies the password and emails a code, step 2 (`confirmDelete`)
    takes the code and actually deletes; a Google-only account instead keeps the original
    single-step "type `DELETE`" flow straight into `deleteAccount` — no password to gate an email
    behind, and the typed confirmation is treated as enough friction on its own for that case.
    `deleteAccount` itself now refuses outright if the account *does* have a password (so it can't
    be used to route around the email confirmation those accounts require — the action is the
    source of truth, not which UI path the client happened to take). Whichever path runs, the
    actual deletion is the same `internalMutation` (`performDelete`) hand-cascading across Convex
    Auth's own tables — there's no built-in "delete this user" helper, so this walks `authAccounts`
    (by the `userIdAndProvider` index) deleting each one's `authVerificationCodes` (by `accountId`)
    first, then `authSessions` (by `userId`) deleting each one's `authRefreshTokens` (by
    `sessionId`) first, then the `users` row itself — the same per-account delete helper
    (`deleteAuthAccountAndCodes`) is shared with "Disconnect Google" above, since it's the same
    operation just scoped to one provider instead of all of them. Deliberately *doesn't* also sweep
    `authVerifiers`/`authRateLimits` — neither has a `userId`-scoped index (short-lived PKCE/
    rate-limit bookkeeping, not reachable without a full table scan), and once the account+session
    rows are gone the user can't sign back in regardless. The client calls `signOut()` right after
    either path succeeds, since the server-side rows being gone doesn't by itself clear this
    device's cached token.
  - **`pendingConfirmations`** (`convex/schema.ts`) is the one table behind both the password and
    delete-account confirmation flows: one row per `(userId, kind)` (`"password"` or
    `"deleteAccount"`), storing a SHA-256 hash of the code (not the code itself) plus an expiry
    (15 minutes). A fresh request (`storeConfirmation`, `internalMutation`) deletes any existing
    pending row for that same `(userId, kind)` before inserting — no stacking multiple live codes.
    `consumeConfirmation` checks the submitted code's hash against the stored one and the expiry in
    one step, deleting the row either way it's actually used (success) — a wrong or expired code
    just leaves the pending row in place to actually expire on its own. This is deliberately
    separate machinery from Convex Auth's own sign-up verification (`authVerificationCodes`, owned
    entirely by the library) — these are app-specific confirmations for actions taken *after*
    already being signed in, not part of authenticating in the first place.
- `components/ConvexClientProvider.tsx` + `app/layout.tsx` — the app's first-ever React context
  providers. **`ConvexAuthNextjsServerProvider` is required, not optional** — confirmed by trying
  to remove it: `pnpm build` then fails outright while prerendering (`Cannot destructure property
  'isLoading' of 'c(...)' as it is undefined`), because Convex Auth's client-side auth context
  isn't safely renderable during Next's static-generation pass on its own. Keeping it means every
  route builds as `ƒ Dynamic` (server-rendered on demand) instead of the `○ Static` every route
  was before this session — a real, unavoidable cost of adding Convex Auth to the root layout, not
  a missed optimization. Worth knowing if page-load performance or hosting cost ever seems off
  after this.
- `proxy.ts` (repo root) — `convexAuthNextjsMiddleware()`, no route-gating (every tool stays fully
  usable signed out, by design). Named `proxy.ts`, **not** `middleware.ts` — Next.js 16 (this repo
  is on 16.3.4) renamed the convention; the API is unchanged, just the filename.
- `convex/_generated/` is **committed** to the repo (there's no CI here that runs `convex dev`
  first, so committing keeps `tsc`/`pnpm build` runnable standalone). Regenerate it with
  `npx convex dev --once` after any change to a `convex/*.ts` file — `tsc` will fail against a
  stale `api.d.ts` otherwise (hit this directly while building this phase: adding `convex/users.ts`
  didn't show up in `api.*` until re-running).
- Package manager is **pnpm only** now — the stray `package-lock.json` (this repo briefly had
  both) has been deleted; `pnpm-lock.yaml` + `pnpm-workspace.yaml` are the real ones.
- No password reset / email verification (deliberately deferred — needs a transactional email
  provider like Resend, which is out of scope for this phase). If email+password sign-up
  succeeds but someone forgets their password, there's currently no recovery path.
- **What's genuinely untested here**: none of the actual sign-up/sign-in/sign-out flow, or the
  Google OAuth round-trip, has ever been clicked through in a real browser — this sandbox has no
  working browser (same limitation noted elsewhere in this file for Chord Charts'
  `FitChordRow`/Playwright). `tsc`/`pnpm lint`/`pnpm build` all pass and `npx convex dev --once`
  successfully pushes the schema/functions to a real dev deployment, but none of that proves the
  UI actually works end to end for a person clicking through it. Needs a real pass by Jack: sign
  up, sign in, sign out, refresh persistence, both sidebar chrome states (desktop
  expanded/collapsed, mobile), and — once the Google Cloud OAuth app exists — "Continue with
  Google" specifically. Same goes for `/account`'s change-password (including that
  `invalidateSessions` actually signs out other devices/tabs and not the current one) and
  delete-account flows (including the cascade delete genuinely leaving no way to sign back in, and
  that a Google-only account's `DELETE`-to-confirm path works with no password field shown). And
  now, the account-linking additions specifically: whether "Set a password" on a Google-only
  account really attaches to the same user (the `linkedUser._id !== userId` check is only a
  same-session sanity check — it can't prove `shouldLinkViaEmail`'s underlying matching behaved as
  read from the library's source, only that this action didn't return an obviously-wrong user id);
  whether "Connect Google" with a *matching*-email Google account actually links instead of
  erroring; and whether the mismatched-email warning (`useGoogleLinkWarning`) actually fires
  correctly across a real Google OAuth redirect round-trip, versus just working in theory against
  the sessionStorage read/write logic in isolation. And now the whole email-confirmation layer:
  whether Resend actually delivers (needs `AUTH_RESEND_KEY` set — a Resend account, its own
  one-time signup, same category of prerequisite as Google's OAuth app; not done as of this
  writing), whether the default `onboarding@resend.dev` sender lands in an inbox instead of spam
  without a verified custom domain, the full sign-up "enter code, get signed in" round-trip
  (`ResendOTP`/Convex Auth's own `email-verification` flow), and both of `convex/account.ts`'s
  request/confirm pairs end to end (`requestPasswordConfirmation`/`confirmPassword`,
  `requestDeleteConfirmation`/`confirmDelete`) — including that a wrong or expired code is
  actually rejected by `consumeConfirmation`, and that a fresh request really does replace (not
  stack alongside) an earlier unconfirmed one. Only verified so far: `generateOtp`/`hashCode`
  (`convex/lib/resend.ts`) against a synthetic Node script (6-digit codes, deterministic/collision-
  free SHA-256 hashing) and that every new Convex function type-checks and deploys — nothing about
  an actual email ever having been sent or received.

**Public profiles & follows** — this app's first genuinely public, social feature (see the
Community bullet in the tools list above), and its first-ever file upload. Two new tables:
- `profiles` (`convex/profiles.ts`) — one row per user: `username` (always lowercased, both stored
  and displayed — no separate display-case, so there's never a "@JohnSmith" vs. "@johnsmith"
  ambiguity to reason about; validated by `lib/username.ts`'s `usernameError`/`normalizeUsername`,
  the same functions used client-side for instant feedback and server-side as the actual
  source-of-truth check — client validation is never trusted alone), `avatarStorageId` (a Convex
  file-storage reference — see below), `instruments` (free text, not `lib/instruments.ts`'s
  `INSTRUMENTS` catalog — that list is range-specific for the note trainers, a poor semantic fit
  for "what do you play"; `lib/profileInstruments.ts`'s `COMMON_INSTRUMENTS` drives autocomplete
  only, never validated against), and `isPublic`. Nothing on a profile is visible to anyone but its
  owner while `isPublic` is false. `knownTuneIds` (`v.optional`, unused) is a deprecated leftover
  from an earlier design — see the tune-lists paragraph below for why it's gone.
- `follows` (`convex/follows.ts`) — one row per `(followerId, followingId)` pair; `follow` checks
  for an existing row first so it's idempotent, never a duplicate. Both Following and Followers
  show on a profile — gated the same way the rest of it is: always visible for your own account,
  otherwise only if that profile is public (`canViewFollowGraph`) — a private profile's social
  graph stays private too, not just its tune list.

**A public profile's tune lists aren't curated — it shows everything, automatically.** The first
version had a "which of your tunes should show" picker (`knownTuneIds`, a hand-picked subset) on
the Public Profile tab; per a direct follow-up request that was removed entirely — a public profile
now just shows *every* tune in the owner's own lists, full stop, nothing to ask about. There are
two such lists, both shown as their own section on the profile page (`app/u/[username]/page.tsx`):
**Tunes** (the same list Jam Practice and the account's own "Tunes" tab use, `"tunes"` in
`syncedSettings`) and **Tunes to Learn** — a new, separate personal list
(`lib/useTunesToLearn.ts`/`lib/tunesToLearn.ts`, its own fixed `syncedSettings` key,
`"jam-practice-tunes-to-learn"`) for tunes bookmarked from *other* people's profiles, kept
deliberately apart from your own practice list rather than mixed into it. It rides the exact same
generic `syncedSettings` table and the same `lib/syncedStore.ts` debounce/stale-closure-race fix as
`useSyncedTunes`, but — like Favorites (`lib/useFavorites.ts`) — is **account-only**, with no
signed-out local-storage fallback: the only way to ever add something to it is visiting another
account's public profile, which already requires being signed in, so there's no meaningful
signed-out story for it to fall back to. It gets its own **Tunes to Learn** tab in `/account`
(`components/TunesToLearnTab.tsx`, between Tunes and Public Profile) — the exact same
`TuneListManager` layout the Tunes tab uses (see that section below), just with standards-adding
turned off, since there's nothing to browse here — everything on this list arrives by being copied
from someone else's profile, not looked up.

`convex/profiles.ts`'s `getPublicByUsername` is the one query in this app that reads across users'
data *by design* — a public profile's tune lists have to come from the *owner's* `syncedSettings`
rows, not the caller's, unlike every other synced-data query here (`convex/syncedSettings.ts`'s
`get`, deliberately self-scoped via `getAuthUserId(ctx)`). Rather than loosen that existing query
into a general "read anyone's data" backdoor, this reads the owner's `"tunes"` and
`"jam-practice-tunes-to-learn"` rows directly and resolves each through `lib/profileTunes.ts`'s
`resolvePublicTunes` — a pure function returning full `{id, name, tempos, keys, timeSignature}` for
*every* tune in the blob (no id filter anymore — see above), but never `notes` (which could hold
private practice notes). Also returns `null` — indistinguishable — for both "no such username" and
"that profile exists but isn't public", so a visitor can't tell the two apart by probing usernames.

**Viewing someone else's profile shows their tunes in the same styled list Jam Practice itself
uses** (`components/PublicTuneList.tsx` — name, time signature, tempo/key chips, styled after
`TunesTab.tsx`'s own rows), not the plain name pills the first version showed, per a direct
follow-up request. The same component renders both the Tunes and Tunes to Learn sections — which
list a tune came from doesn't change what a viewer can do with it. A signed-in viewer looking at
someone *other* than themselves (`canAdd` on that component) gets two per-row actions, each copying
that tune into one of the *viewer's own* lists as a fresh, independent tune (new ids throughout,
`notes` always empty since a public profile never exposes it to copy in the first place): "Add"
into their own Tunes, "Learn" into their own Tunes to Learn — each disabled once a tune with a
matching name (`lib/standards.ts`'s `nameId`, the same name-insensitive match the jazz-standards
picker already uses) is already in that target list. Copying is a snapshot, not a live reference —
once it's in your list, it's yours to edit or delete independently of whatever the original owner
does to theirs afterward, same reasoning as importing a CSV or adding a jazz standard.

**File storage** (profile pictures): Convex's built-in `_storage` system table, no schema entry
needed beyond referencing `v.id("_storage")`. The standard two-step upload flow — `profiles.ts`'s
`generateAvatarUploadUrl` mutation returns a one-time URL, the browser `fetch()`s a POST straight
to it (bypassing Convex's own request path entirely) with the image bytes, gets back
`{storageId}`, and `setAvatar` attaches that id to the profile — deleting the previous
`avatarStorageId`'s stored file first, if there was one, so changing your picture doesn't just
leave the old upload orphaned in storage forever. The image itself is resized *client-side* before
any of this — `components/AvatarUpload.tsx`'s `resizeToSquareJpeg`, a plain `<canvas>`
center-crop-and-resize to 400×400 JPEG (no new dependency, same "reach for the platform first"
habit as everywhere else audio-related in this app) — so a multi-megabyte phone photo never
actually reaches the network as anything but a small round picture. `components/UserAvatar.tsx` is
the one shared "picture, or a plain fallback icon" renderer reused everywhere an avatar shows up
(the editor, a public profile, Community search results, Following/Followers lists).

`/account` also has its own **Tunes** tab (`components/TunesTab.tsx`, between Profile and Public
Profile in the sidebar) for managing the same tune list Jam Practice uses — same underlying
`useSyncedTunes()`, so a tune added, edited, or deleted from either place is immediately visible in
the other, no separate copy to keep in sync. It briefly reused `components/TunesPanel.tsx` (Jam
Practice's own compact sidebar-panel UI) as-is, but per a direct follow-up request was rewritten as
its own from-scratch layout instead, since the account page has room Jam Practice's narrow options
column doesn't: Jam Practice spreads tune management across three separate surfaces (the inline
collapsible list; a "search 631 jazz standards" modal reached via a `+`; a "search your tunes"
bulk-select modal reached via a checklist icon) because each only has a cramped sidebar column to
work in, but on the full-width account page there's no reason those need to be three different
screens.

The actual layout — search box, multi-select checkboxes, per-row edit/delete, and a bulk
Select-all/Export/Import/Delete footer — lives in `components/TuneListManager.tsx`, a shared
component both `TunesTab.tsx` and `TunesToLearnTab.tsx` wrap (per a direct follow-up request to put
"this UI" on Tunes to Learn too, rather than duplicating it by hand into a second, drifting copy).
It went through two designs: the first merged "search your tunes" and "browse jazz standards to
add" into the *same* search box (typing a query showed matching standards inline, right below your
own filtered results); per a direct follow-up request that was reverted, since searching your own
tunes surfacing someone else's whole library in the same box read as confusing rather than
convenient. The search box now only ever filters the list it's given — nothing else. Adding a jazz
standard went back to being a separate, explicit action instead: `TuneListManager`'s `allowStandards`
prop makes the header's `+` button open `StandardsPicker`, the exact same search-and-add-or-create-
custom modal Jam Practice's own `TunesPanel` uses, styled as the exact same small round
accent-colored icon button Jam Practice's own `+` is (per a direct request to match it, replacing an
earlier rectangular "+ New tune" text button) — rather than jumping straight to a blank tune editor
the way it does when `allowStandards` is off. **Both tabs turn this on**, including Tunes to Learn —
per a direct follow-up request specifically asking for the Tunes tab's jazz-standards picker there
too, once the first version had it off (reasoning at the time: nothing to browse, everything there
arrives from someone else's profile) — there's a real use for it: bookmarking a standard you want to
learn without first adding it to your actual practice list. `StandardsPicker` originally
read/wrote `useSyncedTunes()` internally with no way to target a different list; it now takes
`tunes`/`setTunes` as optional props instead, used only when passed — Jam Practice's own
`TunesPanel.tsx` call site still passes neither, so it falls back to `useSyncedTunes()` exactly as
before (verified unaffected: zero behavior change, confirmed via `git diff` showing no edit to that
call site at all), while `TuneListManager` always passes its *own* `tunes`/`setTunes` through, so a
standard picked from either tab's `+` lands in whichever list that tab is actually managing, never
always Jam Practice's. **Jam Practice itself (`TunesPanel.tsx`'s own call site, `TunesManager.tsx`)
was deliberately left untouched** throughout all of this — every request was specifically about the
account-only experience, not about changing how Jam Practice's own sidebar panel works; the one
shared file that *did* need a real edit, `StandardsPicker.tsx`, only gained optional props with a
default that reproduces its exact original behavior. Deleting a tune from either tab needs no extra
bookkeeping elsewhere — a public profile shows every tune live at read time (see above), so there's
no separate "known tunes" selection anywhere that could reference a since-deleted id.

**Account deletion now cascades here too** — a real gap found and fixed while building this:
`convex/account.ts`'s `performDelete` previously only cleaned up Convex Auth's own tables
(`authAccounts`/`authSessions`/`authRefreshTokens`/the `users` row), never touching
`practiceSessions`/`syncedSettings` (a pre-existing gap, out of scope to fix here — see that
section's own "genuinely untested" note — since that data is private, not public-facing) or,
critically, this new `profiles`/`follows` data. Left as-is, "deleting your account" would have
left a public profile — username, photo, everything — live and searchable forever, directly
contradicting both the account page and the Privacy Policy's own "removes this visibility
immediately" promise. Fixed: `performDelete` now also deletes the user's `profiles` row (and its
uploaded avatar file via `ctx.storage.delete`, not just the database reference to it) and every
`follows` row in both directions, so a deleted account doesn't leave a ghost entry in anyone
else's Following/Followers list either.

`app/privacy/page.tsx` gained a full "Public profiles" section (what a public profile exposes and
to whom, that Following/Followers are visible under the same public/private rule, that avatars are
resized client-side before upload) plus updates to "The short version", "Who else sees your data"
(Convex now also named as storing file uploads, not just account data), and "Your choices"
(turning a profile private/deleting it any time).

## Shared conventions — reuse these before writing something new

- `components/LoadingSpinner.tsx`: the one shared "something's loading" indicator — a small row of
  circles, one lit up at a time in a loop, styled after (and directly requested to be modeled on)
  the metronome's own beat-circle display (`components/BeatIndicator.tsx`), but driven by a
  looping CSS animation (`@keyframes loading-dot` + a `--animate-loading-dot` token, both in
  `app/globals.css` — Tailwind v4's `@theme` convention for a custom animation utility) rather than
  real beat timing, since there's no tempo to follow here. `size` (`sm`/`md`/`lg`), `inline` (sits
  mid-sentence instead of as its own block), and `showLabel` (also renders `label` as visible text
  next to the dots, for a spot specific enough that a sighted user benefits from knowing *what's*
  loading, not just that something is — e.g. Recorder's "Finishing recording…"; when off, `label`
  is still the accessible name via `role="status"`/`aria-label`, just not shown). Reach for this
  instead of a bare "Loading…" string or a one-off spinner — swapped into every place that already
  had one: `AccountPage.tsx` (the whole "is anyone signed in yet" gate), `AccountMenu.tsx` (the
  sidebar button's brief placeholder before that resolves), `PracticeTimer.tsx` (saved sessions
  loading from the account), and `Recorder.tsx` (loading a saved project from IndexedDB, and — a
  spot that had no loading feedback at all before this, just a disabled record button — finishing
  the post-recording burst-tone alignment processing). **Deliberately not** threaded into every
  `useSyncedSettings`/`useSyncedTunes` consumer, even though those *are* "waiting on the server" in
  a literal sense: that hook returns `defaults` while its first Convex read is pending specifically
  so call sites don't need a loading state to use it at all (see its own doc comment) — adding a
  spinner there would undo that design, not extend it.
- `components/ToolLayout.tsx`: the page shell every tool uses. `layout="split"` gives a
  hideable options column (the eye icon); `layout="stacked"` (Slow Downer, Recorder) is
  full-width with options in one card below. Takes `help={<HelpButton .../>}` for a controls
  dialog. The header icon next to the title is auto-picked from `NAV_LINKS` by matching the
  title string, so a new tool's title must exactly match its `NAV_LINKS` label. An optional
  `sidePanel` (+ `sidePanelLabel`) adds a second, independently hide/show-able column on the
  right (split layout only) — its own eye button, persisted via `useSidePanelHidden` in
  `lib/panels.ts` — for things like Note Trainer's time-history panel or the modulation log.
- `lib/meterControls.ts` + `components/MeterFields.tsx`: tempo/meter logic and UI shared by
  Metronome and Polyrhythm Metric Modulation Metronome — the log-scaled BPM slider,
  note-value-only beat unit,
  accent grouping, subdivision picker, tap tempo, and the `TempoHero`/`MeterOptions`/
  `SoundOptions` building blocks. Reuse these before adding another metronome-like tool.
- `lib/clickEngine.ts`'s `startClickEngine` takes an array of tracks (`{getSettings, onBeat}`
  each), all scheduled off one shared `setInterval` tick. Any tool playing more than one
  simultaneous click (like Polyrhythm Metric Modulation Metronome's reference click) should
  run them as tracks
  on the _same_ `startClickEngine` call, not as separate calls — two independent calls each get
  their own timer, and browser timer jitter can nudge one but not the other, so they slowly drift
  apart even though the underlying Web Audio scheduling of each is individually sample-accurate.
- `components/CollapsiblePanel.tsx` (split layout) / `components/OptionsCard.tsx` +
  `OptionSection` (stacked layout) for settings sections. `CollapsiblePanel` supports
  `toggle={{checked,onChange,disabled}}` to put a switch in the header that gates whether the
  section can expand.
  - **Hydration gotcha:** the chevron button in a gated `CollapsiblePanel` must always be
    _rendered_ (visually hidden with a CSS class like `invisible` when not expandable), never
    conditionally mounted/unmounted — the checked value comes from localStorage and can differ
    between the server default and the saved client value, and an element that's added/removed
    based on that will cause a real hydration mismatch. A class-only difference is fine.
  - **Option descriptions are opt-in, per section.** Both `CollapsiblePanel` and `OptionsCard`
    always show a "?" toggle in their header (next to the title, persisted alongside that
    section's open/closed state) and provide a `lib/hints.ts` `HintsContext` down to their
    children, off by default. `SwitchRow` and `AdvancedSlider` only show their own `hint` prop
    text while that context is on; description text that isn't already routed through one of
    those (e.g. a standalone explanatory paragraph, like several in Recorder's option panels)
    should use `components/Hint.tsx` directly instead of a bare `<p>`, so it's covered by the
    same toggle. Descriptions are never shown by default — always add them behind this
    mechanism, not as always-visible text. Every option across every tool now has one — treat
    "add a new setting" as also meaning "add its hint."
- `lib/usePersistedSettings.ts`: the localStorage-backed settings hook nearly every tool uses.
  **Always pass a module-level constant default object**, never an inline literal, or the
  `useSyncExternalStore` memoization (and SSR-safety) breaks. A new tool's settings should use
  `lib/useSyncedSettings.ts` instead — identical signature and rule, but also syncs to the
  account when signed in (see "Backend (Convex)" below); reach for the plain, unsynced hook only
  for something deliberately device-local (a display preference, not real tool data).
- `components/Select.tsx`, `SwitchRow.tsx`, `ConfirmDialog.tsx`, `PromptDialog.tsx`,
  `NumberField.tsx`, `KeyHint.tsx`, `HelpButton.tsx`, `ContextMenu.tsx`: shared
  form/dialog/menu primitives.
- `components/Waveform.tsx` + `lib/multitrack.ts` (the `Engine` class) + `lib/clips.ts`: the
  audio-editing core shared by Slow Downer and Recorder — waveform drawing/interaction (zoom,
  pan, loop, markers, clip trim/repeat/move), and sample-accurate scheduled playback. Read before
  touching; it's the most complex part of the codebase.
- `components/tools.tsx`: every icon component plus `NAV_LINKS` (the sidebar/search/title-icon
  source of truth) and `TOOLS` (currently unused, `NAV_LINKS` minus `/`).
- **Favorites** (`lib/useFavorites.ts`, `components/Sidebar.tsx`'s `NavItems`) — a star next to
  each tool in the sidebar (desktop and the mobile overlay both, via the same shared `NavItems`);
  clicking it adds/removes that tool from a "Favorites" section shown above the normal categories
  (each favorited tool still also stays in its own category below — a quick-access shortcut, not a
  relocation). **Account-only, on purpose** — unlike every other synced setting in this app, there
  is no signed-out local fallback: the star and the Favorites section simply don't render at all
  unless signed in (`useFavorites`'s `isAuthenticated` gate), since which tools you reach for most
  is tied to *you*, not a particular device/browser. Still rides the same generic `syncedSettings`
  Convex table as everything else (a fixed key, `"jam-practice-favorites"`, holding `{hrefs:
  string[]}`) rather than a bespoke account-only mechanism — the signed-out branch
  `useSyncedSettings` always has underneath still technically exists here too, it's just never
  surfaced in the UI. Visually the star sits *inside* each nav button, at its right edge, so the
  button itself stays full width — but it's a DOM sibling of the row's `<Link>`, not actually
  nested inside it (a `<button>` inside an `<a>` is invalid HTML and breaks click handling),
  absolutely positioned over padding the link reserves for it (`pr-11`/`pr-14`) whenever it can
  show, so nothing shifts when it fades in, and stacked on top (`z-10`) so a click there hits the
  star, not the link underneath. Only shown when not collapsed (no room for it in the icon-only
  collapsed sidebar) and signed in. Visibility beyond that: an already-favorited star always stays
  visible, so what's starred is visible at a glance without hovering; an unfavorited one is hidden
  on desktop until the row's hovered or the star itself is keyboard-focused (`opacity-0
  group-hover:opacity-100 focus-visible:opacity-100`), but always visible on mobile regardless,
  where there's no hover to reveal it.
- `lib/noteSpelling.ts` (accidental spelling: sharp/flat/random/both), `lib/trainerUtils.ts`
  (`formatDuration`, `shuffled`), and `components/AdvancedSlider.tsx` /
  `CountdownRing.tsx` / `CountdownLabel.tsx` / `ElapsedTimer.tsx`: pulled out of Note Trainer when
  Scale Trainer was built, since both drill-style trainers need the same note-name spelling, timer
  readouts and countdown ring (`CountdownLabel` is `ElapsedTimer`'s mirror image — a ticking "Ns"
  readout counting down instead of up, both driven by the same rAF-write-to-DOM pattern so a
  fast-ticking display doesn't force a re-render). `lib/noteGrade.ts`'s `Grade` type also carries
  `GRADE_COLOR`/`GRADE_LABEL` (correct/partial/incorrect colors and labels) and `scoreOf`
  (correct = 1, partial = 0.5), for the same reason. `lib/struggleStats.ts` (`bumpGradeCounts`,
  `rankWeak`, `weaknessScore` = incorrect + partial×0.5) is the lifetime per-note/per-scale
  struggle tracking behind both trainers' "Struggles" panel — generic over the string key, so
  Note Trainer keys it by note and Scale Trainer by mode id. Reuse these before adding another
  drill/quiz-style tool.
- `lib/tones.ts`: the "Tone" dropdown shared by Note/Scale/Interval Trainer's "Play note/scale/
  interval out loud", Guess the Interval/Guess the Chord's playback, and Practice Timer's
  transition chime (`TONES`, `DEFAULT_TONE_ID`, `playNote`). Each `Tone` is just an `id`/`label`
  plus a `play(ctx, freq, durationSeconds)` function — simple waveforms (triangle/sine/square/
  sawtooth, plus "organ"/"pluck" as hand-picked `PeriodicWave` Fourier coefficients) share one
  `waveTone` helper building its own Web Audio graph from scratch per note. "Piano" and "Rhodes"
  used to be synthesis functions too (a five-partial detuned-sine model and a 2-operator FM patch,
  respectively) but are now real recordings via `lib/sampledTones.ts` — this app's first actual
  audio *assets*, per an explicit request to stop approximating and use real samples. Neither
  sample set ships in the repo: the browser `fetch()`s the specific note it needs directly from the
  sample's origin host the first time that note comes up (Piano: the Salamander Grand Piano,
  Alexander Holm, CC-BY, hosted by the Tone.js project, sampled at A/C/D#/F# every octave, 30
  notes; Rhodes: the FluidR3 GM SoundFont's "Electric Piano 1" patch converted to per-note mp3s by
  the midi-js-soundfonts project, CC-BY, every semitone across the full 88-key range) and
  `decodeAudioData`s it into an `AudioBuffer`, cached in a module-level `Map` keyed by URL for the
  rest of the tab's lifetime — so only the very first play of a given sample note pays a
  network/decode cost; every repeat, and the browser's own normal HTTP cache on a later visit, are
  instant. A requested note without its own recording gets the *nearest* sample, pitch-shifted via
  `playbackRate` to the exact target frequency — continuous, not limited to semitone steps, same as
  the synthesized tones could render any frequency exactly. Both sets' filenames are generated from
  MIDI note numbers (`midiToAppName`/`midiToFlatName`) rather than hand-typed, and every generated
  URL (118 across both sets) was spot-checked for real — several edge/middle/flat-spelled notes
  fetched directly and confirmed to return actual mp3 data, not guessed from memory. CC-BY requires
  attribution, which lives on `/credits` (`app/credits/page.tsx`, linked from `Home.tsx`'s footer,
  same `LegalPage` shell as `/privacy`/`/terms`) rather than cluttering every tool that has a Tone
  dropdown. `DEFAULT_TONE_ID` is still "triangle" (unchanged, so existing persisted settings aren't
  affected) — Piano/Rhodes stay opt-in via the Tone dropdown, not a new default, for every Tone
  picker *except* Guess the Interval's and Guess the Chord's: those two ("Ear Training" tools,
  specifically — not the other trainers' own "play out loud" Tone pickers or Practice Timer's
  chime, which still offer the full list) were narrowed to real samples only, per a direct
  follow-up request once the samples actually sounded good — `EAR_TRAINING_TONES` (just Piano and
  Rhodes) and `DEFAULT_EAR_TRAINING_TONE_ID` ("piano") in `lib/tones.ts`, filtered from the same
  `TONES` array rather than a separate list to maintain, so a new tone added to `TONES` later needs
  a one-line decision (does it belong in this filter too) rather than being duplicated by hand.
  Each of those two components also clamps its own persisted `toneId` against
  `EAR_TRAINING_TONES` (same pattern as their existing `accidentalStyle` clamp) — a `toneId` saved
  before this narrowing (e.g. still `"triangle"`) falls back to the new default instead of
  silently pointing at a tone no longer offered in the dropdown. `playNotesTogether(notes,
  durationSeconds, toneId)` is the other export alongside `playNote` — used wherever several notes
  need to actually start together (Guess the Chord's block voicing, Guess the Interval's harmonic
  playback), not just be *called* around the same moment. Reported directly: with Piano/Rhodes, one
  note of a block chord would play slightly before the others on a first play, but a replay was
  always fine. Cause: each `playNote` call independently awaited its own sample's fetch+decode
  (`lib/sampledTones.ts`), so if a chord's notes needed different sample files and only some were
  already cached, each note computed "now" whenever *its own* fetch happened to resolve — on replay
  everything's cached so every note resolves near-instantly and the skew vanishes on its own, which
  is exactly why it only showed up on a first play. Scheduling every note for the same future
  `AudioContext` time turned out not to be a real fix on its own: a sample that's still mid-fetch
  when that moment arrives simply doesn't exist yet to play, so it'd still start late regardless of
  what start time was requested (a dead end worth recording so it isn't tried again) — Web Audio
  scheduling can't paper over a network request that hasn't finished. The actual fix is
  `Tone.prepare?: (ctx, freq) => Promise<void>` (optional; absent for every synthesized tone, which
  has nothing to preload) plus `lib/sampledTones.ts`'s `prepareSampledNote`, which fetches+decodes
  into the same `bufferCache` `playSampledNote` reads from without playing anything.
  `playNotesTogether` awaits `Promise.all` of every note's `prepare` call *before* computing a
  shared start time and playing any of them — so a chord genuinely waits for its slowest note to
  finish loading before any note sounds, rather than the fast notes racing ahead. Verified with a
  synthetic script using a fake `AudioContext` whose `currentTime` actually advances in real time
  (necessary — a static fake clock can't distinguish "fixed" from "reads `ctx.currentTime` fresh
  whenever each note happens to resolve", the bug, since both would trivially produce the same
  value against a clock that never moves) and two notes with deliberately different, real
  `setTimeout`-based fetch delays (5ms vs 150ms): both end up scheduled at the *exact* same
  Web Audio time, and that time is provably after the real ~150ms wait actually elapsed, not "0" by
  coincidence — plus a second check that a synthesized tone (no `prepare` step) still resolves
  near-instantly through the same function, unaffected.

## What's genuinely untested

Every change here has passed `next build` + `tsc --noEmit` + `eslint`, and audio-processing logic
(WAV encoding, pitch/beat detection, latency alignment) has been spot-checked with small synthetic
Node scripts — but **none of it has been exercised in a live browser with real audio hardware**.
If Jack reports odd behavior in any of these, treat it as genuinely unverified, not a regression
from something that used to work:

- **Public profiles & follows** (see "Backend (Convex)" above for the full design): genuinely
  nothing about this has been clicked through — this sandbox can't upload a real image file,
  create two different signed-in sessions to test following/searching/viewing each other's
  profiles, or click through a public profile link at all. Specifically unverified: the actual
  avatar upload flow end to end (resize → `generateAvatarUploadUrl` → the raw `fetch()` POST →
  `setAvatar`) in a real browser; whether the client-side `<canvas>` crop/resize produces a
  reasonable-looking square from a real photo (portrait vs. landscape, unusual aspect ratios);
  live username-availability checking while typing; the Community search page's actual results;
  the Follow/Unfollow round-trip and both Following/Followers lists updating live; a public
  profile page correctly showing (or correctly refusing to show) someone else's data depending on
  their `isPublic` flag; and the account-deletion cascade fix (`performDelete` now also removing
  the profile, its avatar file, and follow rows) actually leaving no trace behind in a real
  deployment, not just type-checking. Also unverified, since this session's redesign: that a public
  profile really does show *every* tune automatically with no picker involved; the "Add"/"Learn"
  buttons on `PublicTuneList` actually copying a tune into the viewer's own Tunes/Tunes to Learn
  lists correctly (fresh ids, no `notes` leakage, correctly disabling once already added); and the
  account's own Tunes to Learn tab's edit/delete/clear-all against a list that was actually
  populated by visiting someone else's profile first (as opposed to a script fabricating one).
  Verified so far, purely at the logic level: `lib/username.ts` (valid/invalid formats, boundary
  lengths) and `lib/profileTunes.ts`'s `resolvePublicTunes` (every tune returned in full,
  `notes` never present, tolerant of malformed/missing input, individual bad entries dropped
  without failing the whole list) against synthetic Node scripts, and that the whole feature —
  schema, every new Convex function, every new page — type-checks and deploys cleanly to the dev
  backend.
- **Community chord charts** (see its own paragraph under Backend (Convex) above — now on its
  third storage design, the first two both having broken for real at actual posting scale, most
  recently a ~1,400-song post): partially clicked through by Jack himself (that's how both prior
  bugs were actually found — this sandbox still can't authenticate as a real user, so every fix
  here has been verified against the *architecture*, via the real dev deployment, not by clicking
  the UI). Specifically unverified: that `create`/`importIntoLibrary` actually succeed end to end
  for a genuinely large post now (the original ask) — verified so far only that the specific
  failure modes that broke v1 (a >1 MiB document) and v2 (a >1024-field object) no longer apply
  architecturally, via a real query/mutation reachability check and a dedicated large-array-return
  check against the live dev deployment (see the Backend section), not by actually posting 1,400
  real charts and confirming they show up correctly; that `create` actually refuses posting for a
  non-public profile and the client-side prompt matches; that `list`/`get`/`getSongBars` really do
  drop a post (or song) once its author's profile goes private; that the inline `ChordChart`
  preview inside `PostDetailModal` renders correctly once its now-lazy `getSongBars` fetch
  resolves, in that narrower modal context; that "Import all" and a per-song "Import" actually
  land in `ChordCharts.tsx`'s own library and show up there immediately; and the account-deletion
  cascade now also clearing `communityChordCharts` *and* `communityChordChartSongs` rows. Also
  unverified: whether a playlist's tri-state checkbox (`.indeterminate` set imperatively via a ref
  callback) actually renders the indeterminate dash in every browser rather than just
  checked/unchecked; whether the title-autofill-from-playlist-name behavior feels helpful or
  surprising in practice; and whether search correctly hides a playlist with zero matching songs.
  Verified so far: `tsc`/`eslint`/`next build` all pass; `npx convex dev --once` deploys the
  current three-table shape (`communityChordCharts`/`communityChordChartSongs`, alongside the
  personal library's own `chordChartPlaylists`/`chordChartSongs`/`chordChartSongBars`) cleanly;
  and, against the real dev backend specifically (not a mock), both `create` and
  `importIntoLibrary` correctly reject an unauthenticated caller, and a large (1,500-element) array
  return value — the shape `get`'s song list now uses — succeeds with no limit comparable to the
  one that broke the old object-keyed-by-id bulk fetch. No synthetic Node script was run against
  the dedupe/playlist logic specifically here, since it's now shared with the already-scripted
  `mergeIntoLibrary`/`chordCharts.importSongs` path via `convex/lib/chordCharts.ts`'s
  `findOrCreatePlaylist`/`songKey`, not a second independent implementation to separately verify.
- **Community tunes** (see its own paragraph under Backend (Convex) above): same story, also
  entirely unclicked. Specifically unverified, beyond everything already listed for Community
  chord charts (the same posting-gate/privacy-filter/account-deletion-cascade concerns apply here
  identically): that `PublicTuneList` — a component only ever previously mounted from a public
  profile page — renders and behaves the same way reused here inside `PostDetailModal` (correct
  dedupe against the viewer's own Tunes/Tunes to Learn, correct fresh-id copy on Add/Learn, no
  layout surprises in a modal instead of a full page); and that `toPublicTune` actually strips
  `notes` in practice, not just by reading the function. Verified so far at the same level as
  Community chord charts: `tsc`/`eslint`/`next build` pass and `npx convex dev --once` deploys the
  new `communityTunes` table and functions cleanly — no dedicated synthetic script, for the same
  "thin glue over already-tested pieces" reasoning.
- Recorder: multitrack recording/overdub, the auto-latency burst-tone alignment, "align to beat",
  moving clips between tracks, WAV export/mixdown.
- Note Trainer listen mode: live pitch grading accuracy, the "ignore a held-over note" fix, the
  always-on max-time timer, and the "Sound feedback" click scheduling (a `setTimeout` per
  countdown second, cleared and rescheduled on every note change). "Shed a string" specifically:
  whether two octaves above the open string is actually the right span for a real instrument (no
  fret-count data exists to check against — see the shared-conventions note above) and whether
  the octave-override actually holds through to grading and the results screen as intended.
- Scale Trainer listen mode: same live-pitch-grading machinery as Note Trainer, plus its own
  untested bit — advancing through a scale's notes in sequence (settling between each one so a
  held note's tail isn't graded as an attempt at the next degree), failing the whole round on a
  wrong note (immediately by default, or after a second miss on the same degree with "Partial
  credit" on), the drill queue's per-key/per-octave coverage, and the "Sound feedback" click
  scheduling (a `setTimeout` per countdown second, cleared and rescheduled on every round change).
- Interval Trainer listen mode: same live-pitch-grading machinery again, plus its own untested
  bit — "Continue from previous note" chaining actually starting each round on the prior round's
  target note rather than drifting.
- Guess the Interval: whether the played interval's pitch actually matches what's shown once
  revealed (`playNote`/`lib/tones.ts`), the melodic-vs-harmonic playback timing (two `playNote`
  calls fired simultaneously for harmonic isn't something that's been heard), and the same
  countdown-timing machinery inherited from Interval Trainer (the sound-feedback click scheduling,
  answering early re-syncing the round timer).
- Guess the Chord: everything above, plus its own untested bits — whether a played chord's block
  vs. arpeggio voicing (all the notes at once, several simultaneous oscillators through
  `playNote`) actually sounds like one coherent chord rather than mush, especially on the bigger
  qualities (13th chords are 7 simultaneous notes); whether a fully random slash bass (not
  restricted to an actual chord tone) is musically legible enough to identify by ear at all,
  versus just sounding like noise under the chord; and the typed-answer flow end to end — the
  live-formatting preview while typing, submitting via Enter vs. the Submit button, and the
  timeout path (`onTimeUp` → `gradeAndReveal` → the same `lockInRound` reveal pause an explicit
  answer gets) actually behaving the way the code reads; plus, since this section was last
  written, the "Give the root" prefill (whether the caret really lands after the prefilled text
  rather than before/inside it — `setSelectionRange` after a `useEffect`, not something provable
  without a real focused `<input>` in a real browser) and the symbol keypad (whether a tap really
  inserts at the caret without stealing focus, across actual touch/mouse input rather than the
  synthetic string-splicing check that's all `insertSymbol`'s logic itself got). None of this is
  something this sandbox's lack of a browser can confirm beyond the synthetic parser/round-
  generation/prefill checks already run against `lib/chords.ts` directly.
- `lib/sampledTones.ts`'s "Piano" and "Rhodes" tones: every generated sample URL was checked for
  real (a script fetching representative ones — both range edges, a middle note, and a
  flat-spelled filename from each set — and confirming actual mp3 bytes come back, not a guess
  from memory), and the note-name/frequency/nearest-sample-selection math has a synthetic test
  against the real `noteToFrequency`. Jack reported the samples playing louder in one ear —
  both sets are real stereo recordings (an actual mic'd piano, unlike every other tone here, a
  single inherently-centered mono oscillator), so whatever left/right balance the recording itself
  happened to have was passing straight through; fixed by forcing the gain node's `channelCount`/
  `channelCountMode`/`channelInterpretation` to explicitly downmix to a centered mono signal before
  it reaches `ctx.destination` (the Web Audio spec's standard L+R downmix rule), verified with a
  mocked-Web-Audio-graph script asserting those three properties actually land on the node — but
  **not re-confirmed by ear**, since this sandbox still has no audio output; take "fixed" as
  "the mechanism that would cause this is now provably absent from the graph," not "confirmed
  centered by listening." Also still unconfirmed: whether the pitch-shifted notes between recorded
  samples (especially the piano set's wider, every-third gaps) still sound convincingly like a real
  piano rather than audibly "chipmunked" or "slowed down"; how loud the samples are next to this
  app's other tones (no gain matching was done — the samples' own recorded levels are used as-is,
  now just centered); whether the 80ms release ramp on cutoff sounds natural against a real
  recording's own decay tail versus clicking or cutting it off abruptly; the actual first-note
  network/decode latency in practice; and whether `AudioContext.decodeAudioData`'s promise-based
  (no-callback) form is supported by every browser this app otherwise targets. Jack also reported a
  block chord's notes not starting quite together on a first play (fine on replay) — fixed via
  `playNotesTogether`'s prepare-then-schedule redesign (see `lib/tones.ts`'s bullet above) and
  verified with a synthetic script proving two notes with deliberately different fetch delays
  converge on the exact same Web Audio start time, but same caveat as the left/right fix: not
  re-confirmed by ear in a real browser, since that's still not something this sandbox can do.
- Practice Timer: the engine's live start/pause/resume/skip/stop/auto-advance behavior and its
  restore-from-`localStorage` paths (paused, mid-step, and time-fully-elapsed-while-away) are all
  checked with synthetic Node scripts driving `lib/practiceTimerEngine.ts` directly against a
  mocked `window.localStorage` — but never in a real browser: an actual page reload genuinely
  resuming a running session, the sidebar widget/mobile badge staying in sync with the tool page
  across navigation (the whole reason the tool page's own `Date.now()`-based ring replaced an
  earlier `performance.timeOrigin`-converted one — see the tool's own bullet above — was Jack
  actually seeing the two disagree; this sandbox can't reproduce or re-check that by eye at all),
  and the transition chime (`playTransitionChime`, `lib/tones.ts`) are all unverified by ear/eye.
  Same story for what's new since: alarm mode's repeating chime (whether the 1.5s repeat interval
  actually sounds like a sane alarm cadence rather than too frantic or too slow — a number picked,
  not measured against anything), the sidebar widget's new pause/resume/skip/stop buttons actually
  working when clicked (siblings of the card's `<Link>`, not nested inside it, which fixes a real
  invalid-HTML/broken-click-handling risk on paper, but hasn't been clicked for real), and
  `PracticeTimerAlert`'s full-screen takeover — whether it actually renders above everything else
  app-wide (untestable without a real multi-page browsing session to interrupt), whether its
  `z-[200]` really does sit above every other overlay in the app (a number chosen by reading every
  other `z-` value already in use and going higher, not verified by opening two at once), and
  whether `autoFocus` on its Continue button actually lands keyboard focus there in every browser.
  The state machine itself (holds on `alarming` instead of auto-advancing, stays held rather than
  firing once, `skip()`/`stop()` both work from an alarming state, restoring into an
  already-alarming or just-elapsed-into-alarming state on reload) is covered by synthetic tests —
  see `lib/practiceTimerEngine.ts`'s own bullet above — but that's the logic, not the experience of
  an actual alarm going off while you're doing something else on your phone. The signed-in-reads-
  Convex-only sync switch (`lib/usePracticeSessions.ts`) type-checks and the schema/functions
  deploy cleanly to the dev backend, but the actual cross-device behavior — including that signing
  in really does ignore whatever's in local storage rather than merging it — hasn't been clicked
  through.
- **Every tool's account sync** (`lib/useSyncedSettings.ts`, `lib/useSyncedTunes.ts`,
  `convex/syncedSettings.ts`): `tsc`/`pnpm lint`/`pnpm build` all pass and `npx convex dev --once`
  deploys the schema/functions cleanly, but none of the actual signed-in behavior has been clicked
  through in a real browser — this sandbox can't sign into a real account and watch it happen. In
  particular, unverified: that a tool's settings genuinely round-trip through the account (change
  something, refresh, see it persist via Convex rather than localStorage); that signing in with
  existing local data really does just stop reading it rather than showing something stale or
  erroring; that all four of Jam Practice's tune-list call sites
  (`JamPractice.tsx`/`TunesPanel.tsx`/`TunesManager.tsx`/`StandardsPicker.tsx`) stay in sync with
  each other through `useSyncedTunes` the way they did through the shared `tunesStore` module
  before; and that a large settings object (Chord Charts' imported-song library in particular,
  potentially several hundred KB of JSON per `PROJECT.md`'s own note on that data's size) writes
  and reads back correctly as one `syncedSettings.value` string rather than hitting some
  unanticipated Convex document-size or `useMutation` payload limit.
- Tuner: the tone generator and the per-instrument string tunings.
- Polyrhythm Metric Modulation Metronome: the bar-boundary detection driving each
  modulation (relies on the
  click engine's `onBeat` callback timing).
- Chord Charts' `FitChordRow` (`components/ChordChart.tsx`): keeps a bar's chords on one line by
  measuring the row's natural width against the bar's available width (`ResizeObserver` +
  `scrollWidth`/`clientWidth`) and applying `transform: scaleX()` to compress it exactly enough to
  fit, instead of wrapping or overflowing. This one's untested for a different reason than the
  audio items above — it's plain DOM layout, no special hardware — but this sandbox has no working
  browser to actually render in (Playwright's Chromium is missing OS shared libraries — e.g.
  `libnss3.so`, `libgtk` — and installing them needs `sudo`, which isn't available
  non-interactively here); `next build`/`tsc`/`eslint` are all it's been checked with.
  Same-unverified-for-the-same-reason applies to a later visual pass matching iReal Pro's/Finale's
  chart look more closely, per two rounds of direct follow-up with reference screenshots. Round
  one swapped the chord font from Oswald (a condensed sans, a rough stand-in from when this was
  first built) to Bevan (a bold slab serif) and added a stacked time signature, baseline-aligned
  quality suffix, and an always-thick opening barline — sent back as "not even close... the font
  you just used is horrible... it should be very thin," naming Finale's own "Jazz Text" font as
  the actual reference. Round two (the current state): the font is now EB Garamond — genuinely
  thin-stroked, the opposite of Bevan, and the closest freely-licensed stand-in for Jazz Text
  available via `next/font/google` (Jazz Text itself is bundled with Finale, not distributable for
  web use, so this remains an approximation, not a claim of an exact match — the same honest
  caveat as the first attempt, just aimed at a different reference font this time). More
  consequentially, round two also replaced the chart's entire sizing model: it used to size chord
  text off the container's *width* only (a `cqw`-based scheme), so a long chart (many rows) just
  ran taller than its box and needed a scrollbar — exactly what "the whole chart, regardless of
  length, should be able to fit without scrolling" was asking to fix. Now the chart renders inside
  a single fixed-aspect-ratio box (`aspect-[8.5/11]`, "almost" a sheet of paper, per that same
  request) at one natural (unscaled) size, and a new `PageFit` component measures the whole
  rendered result (`ResizeObserver` + `scrollWidth`/`scrollHeight`, the same "measure then
  `transform: scale()`" idea `FitChordRow` already used for a single bar, now applied to the
  *entire* chart) and applies one uniform scale so it always fits inside that page — shrinking a
  long chart down, or growing a short one up (capped at `MAX_SCALE`, so a 4-bar tune doesn't blow
  up absurdly large). Every row now always renders exactly `barsPerRow` fixed-width columns
  (`COL_WIDTH`), even a short trailing row, leaving the remainder blank rather than stretching —
  matching how a real chart never changes bar width mid-line just because a line ends early. None
  of this has been seen rendered: not whether EB Garamond actually reads as close to Jazz Text, not
  whether `Δ`/`ø`/`°` (outside EB Garamond's coverage too — an existing limitation carried over
  from both earlier fonts, not a new regression) fall back jarringly, not whether the scale-to-fit
  math actually keeps a very long real chart legible rather than shrinking it into illegibly tiny
  text, and not whether the page's own on-screen size (`max-w-2xl` × the 8.5:11 ratio, comfortably
  taller than it is wide) ends up needing the *page itself* to scroll on a shorter viewport even
  though the *chart content* inside it never does — those are two different things, and only the
  second was ever actually promised here.

  Two further direct follow-ups landed on top of this, both also unclicked for the same reason.
  First, the page's own side margins on mobile — both `ChordCharts.tsx`'s display wrapper
  (`p-4 sm:p-6` → `px-1 py-4 sm:p-6`) and `PageFit`'s own inset (`inset-4 sm:inset-6` →
  `inset-x-1 inset-y-4 sm:inset-6`) — shrank to near-zero horizontally below the `sm:` breakpoint,
  deliberately left untouched above it, and deliberately *not* touching `ToolLayout.tsx`'s own
  shared `px-4` page gutter (used by every "stacked"-layout tool, not just this one) — so there's
  still a small unavoidable gutter from that shared layer, not literally edge-to-edge. Second, a
  "maximize" toggle (`MaximizeIcon`/`MinimizeIcon`, new in `components/tools.tsx`) opens the
  selected chart in a `fixed inset-0` full-screen overlay (Escape, or a "minimize" button, to
  close) — a plain CSS overlay rather than the browser's native Fullscreen API, deliberately: iOS
  Safari doesn't support calling `requestFullscreen()` on an arbitrary element at all, which would
  have made the button silently do nothing on an iPhone specifically, a bad outcome for what's
  otherwise a mobile-first practice tool. `ChordChart` itself gained a `fullscreen` prop that drops
  the paper aspect-ratio/width-cap in favor of filling whatever box it's given — maximizing is
  about legibility while practicing, not preserving a page shape that would waste space on a
  landscape phone — while still routing through the same `PageFit` scale-to-fit logic either way,
  so "never needs to scroll" holds in both the normal and maximized views.

  Two more direct follow-ups after that, both also unclicked. First, maximized, the composer name
  used to sit flush right in the header (`justify-between`) — colliding with the "minimize"
  button that sits top-right of the full-screen overlay, per a reported screenshot of "Coleman
  Haw[kins]" overlapping it. Fixed by moving the composer down under the title (left-aligned) only
  when `fullscreen`; the normal (non-maximized) view, which has no button there to collide with,
  keeps the composer flush right as before. Second, and more substantial: a long chart (many rows)
  in the *normal* (non-maximized) view rendered at a fraction of the phone screen's actual width,
  with wasted margin on both sides — `PageFit` had been fitting *both* width and height inside the
  fixed `aspect-[8.5/11]` page box, so a tall chart's height became the binding constraint on the
  scale, and that same (small) scale then applied to width too, shrinking it far more than the
  screen actually required. `PageFit` now takes a `fitHeight` prop: `true` (the full-screen case,
  a genuinely fixed box with no page below it to grow into) keeps fitting both dimensions exactly
  as before; `false` (the new default, normal in-page case) fits *width only* — always scales to
  exactly fill the container's width — and instead reports the resulting scaled *height* back onto
  its own box (`content.scrollHeight * scale`, via a second piece of state), so the page itself
  simply grows taller for a longer chart rather than the whole chart shrinking to preserve a paper
  ratio that was never the point — normal page scroll below a tall chart is fine; the chart
  needing its own internal scrollbar, which this whole `PageFit` mechanism exists to prevent, is
  the thing that was actually promised. Setting the box's own height from inside the same
  `ResizeObserver` callback that watches that box does cause one extra, harmless observer firing
  per settle (the box's height changing is itself a resize) — verified by tracing it through, not
  by watching it run: the second pass recomputes from the *same* `content` natural size (unaffected
  by the box's own height, since `content` is absolutely positioned) and lands on the identical
  scale/height values, so React bails out of re-rendering and it settles after that one bounce
  rather than looping.

  **Round three**, a direct follow-up asking for "a handwritten jazz font like lilyjazz": swapped
  EB Garamond for `lilyjazz-text`, the hand-written text face from the [LilyJAZZ font
  family](https://github.com/OpenLilyPondFonts/lilyjazz) (SIL Open Font License 1.1, copyright
  Abraham Lee) — this app's first actually-bundled font, self-hosted via `next/font/local` rather
  than fetched from Google Fonts. Immediately correctable on two points, both from a direct
  follow-up: **first**, `lilyjazz-text`'s own glyph set was missing three of `prettyQuality`'s five
  substitution characters (`Δ`, `♯`, `♭` — only `ø`/`°` were covered), pointed out directly
  ("the font shuold have flats and stuff"); **second**, there's no lighter weight of
  `lilyjazz-text` to switch to for "make the font thinner." Both together were reason enough to
  replace it outright rather than patch around the gaps.

  **Round four** (the current state) swapped in [Petaluma](https://github.com/steinbergmedia/petaluma)
  instead, per a direct follow-up naming it specifically: "its open source and definately includes
  everything." Petaluma is the SMuFL-compliant notation font family Steinberg built for its Dorico
  scoring software (SIL Open Font License 1.1, copyright Steinberg Media Technologies GmbH) — and
  genuinely does include everything needed, once the right *two* of its three faces are actually
  used together rather than just one:
  - **`PetalumaScript`** — a hand-inked text face, used for root letters, digits, and most of the
    quality suffix (`chordFont` in `ChordChart.tsx`). Its cmap was checked directly (`opentype.js`
    against the real downloaded `.otf`, the same verification method used for every font swap in
    this file, not assumed from the family's README) and — unlike `lilyjazz-text` — it already
    covers `♯`/`♭`/`ø` (three of `prettyQuality`'s five substitution glyphs) at their normal
    Unicode codepoints directly, no second font needed for those.
  - **`Petaluma`** itself (the engraving/symbol face, `chordSymbolFont`) — used for exactly the
    remaining two: `Δ` (major 7) and `°` (diminished). Rather than falling back to whatever other
    font happens to be installed for those two (the gap every earlier font in this chart's history
    had), a new `QualityText` component in `ChordChart.tsx` intercepts just those two characters
    after `prettyQuality` and re-renders them through `Petaluma`'s own dedicated SMuFL "chord
    symbols" glyph range — `csymMajorSeventh` (U+E873) and `csymDiminished` (U+E870), purpose-built
    engraved jazz-chord marks, not a Greek letter or degree sign standing in for them. Confirmed to
    exist in the actual font (not assumed from the SMuFL spec alone) by cross-referencing the
    [SMuFL glyphnames registry](https://github.com/w3c/smufl)'s `csym*` codepoints against
    Petaluma's real cmap. `prettyQuality` itself (`lib/iRealPro.ts`) is completely untouched — still
    the same Δ/ø/°/♯/♭ substitution shared with Guess the Chord's own chord bank — so this is a
    `ChordChart.tsx`-local addition on top of it, not a change to shared logic; Guess the Chord
    keeps rendering those same five characters in whatever ordinary font it already uses, unaffected.

  Both `.otf` files (`components/fonts/petaluma/Petaluma.otf`, `PetalumaScript.otf`, plus the
  family's shared `OFL.txt`/`FONTLOG.txt`) are committed the same way `lilyjazz-text` was, replacing
  it outright — `components/fonts/lilyjazz-text/` was deleted, not left alongside as dead weight.
  `/credits`' "Typeface" section was rewritten to credit Petaluma/Steinberg instead. On "make the
  font thinner" specifically: `PetalumaScript` reads as a visibly lighter weight than `lilyjazz-text`
  on paper, which happens to land closer to what was asked for, but that's a side effect of picking
  a different single-weight font, not an adjustable setting — the Petaluma family ships only one cut
  of `PetalumaScript`, so if it still reads too heavy once actually seen rendered, there's no lighter
  variant within this family to fall back to; a non-variable OTF's own stroke weight can't be thinned
  further through CSS `font-weight` the way a variable font's could. `tsc`, `eslint`, and `next build`
  all pass, and a synthetic Node script (run directly against the real `prettyQuality` plus
  `QualityText`'s own substitution table, not a mock) confirms the character-level logic against real
  quality suffixes pulled from `lib/chords.ts`: `^7`/`^13`/`o7`/`o` correctly isolate `Δ`/`°` for the
  SMuFL substitution, while `h7`/`-7b5`/`7#9`/`sus` correctly need no substitution at all (their
  `ø`/`♭`/`♯` already render through `PetalumaScript` directly). **Not verified**, same as every
  round before it: how any of this actually looks rendered in a browser — whether `PetalumaScript`
  reads as legible hand-written jazz notation at chord-chart sizes, whether it's visibly thin enough
  to satisfy the original ask, and whether the two `Petaluma`-rendered SMuFL glyphs sit at a
  consistent size/baseline next to `PetalumaScript`'s own text (both fonts share the same
  1000-units-per-em design, so no manual scale correction was applied — checked via each font's own
  metrics, but genuinely unconfirmed by eye).

  **Round five**, a direct follow-up with a screenshot of the actual rendered chart: chord symbols
  themselves were correctly in the new font, but the "%" repeat-bar mark and the coda symbol
  (segno wasn't in the screenshot, but shares the exact same code path) were still visibly in a
  plain system font, unchanged by any of the rounds above — both were typed as plain Unicode
  characters (`%`, `⊕`, `𝄋`) with no `chordFont`/`chordSymbolFont` class applied at all, simply
  missed when the font swap first went in. Rather than just adding `chordFont`'s class to those
  same plain characters, this checked whether `Petaluma` (the SMuFL engraving face, already
  bundled for `QualityText`'s `Δ`/`°`) has real dedicated glyphs for these too — cross-referencing
  the SMuFL glyphnames registry again, then confirming directly against the actual bundled
  `Petaluma.otf`'s cmap: it does, `repeat1Bar` (U+E500), `coda` (U+E048), and `segno` (U+E047),
  proper engraved marks rather than a percent sign/circled-plus/musical-repeat-character standing
  in for them (`PetalumaScript`, the text face, has none of the three — confirmed the same way —
  so this is `chordSymbolFont` only, not a choice between the two faces). `BarContent`'s repeat
  case and `BarCell`'s segno/coda span now render those three codepoints through
  `chordSymbolFont.className` instead of the old plain-Unicode characters; `REPEAT_SIZE`/
  `SYMBOL_SIZE` (the same font-size constants each already used) were left as-is rather than
  guessed at anew. `repeat1Bar`'s own bounding box sits mostly *below* the font's baseline
  (`y1: -250, y2: 175` in its 1000-unit em, versus a typed `%`'s more ordinary above-baseline
  shape) — flagged here as a real, not-yet-visually-confirmed risk: normal flex-centering in
  `BarCell` should still land it roughly centered in the bar regardless, since that's centering the
  span's line box rather than reasoning about glyph-specific bbox position, but it's worth a second
  look once this is actually seen rendered, before assuming that math holds. `tsc`, `eslint`, and
  `next build` all pass, and all three codepoints were confirmed present in the real bundled
  `Petaluma.otf` (not assumed from the SMuFL spec). **Not verified**, same as everything else in
  this chart's font history: how the repeat mark, coda, and segno actually look and sit once
  rendered — including that vertical-centering question above.
- Chord Charts' playlist grouping (`lib/chordChartsLibrary.ts`'s `Library`/`Playlist`,
  `PlaylistSection` in `ChordCharts.tsx` — see that tool's own bullet above): the merge/resolve/
  delete logic itself is covered by a synthetic Node script (creating vs. merging into an existing
  playlist by name, a duplicate song skipped correctly even in a brand-new playlist, every song
  accounted for exactly once, the legacy-library-falls-into-"Unsorted" case, and an emptied
  playlist being dropped), but nothing about the actual UI has been clicked through: whether the
  expand/collapse chevrons work and animate sensibly, whether a playlist containing the selected
  song really does show expanded by default without needing a manual click, whether the nested
  indentation reads clearly at the sidebar's narrow width, and — genuinely unknown, not just
  unclicked — how an account with chord charts imported *before* this change actually looks the
  first time it loads under the new "Unsorted" bucket, since this sandbox has no way to seed a real
  pre-existing synced library to check that against.
- Chord Charts' Convex-backed library (`lib/useChordChartsLibrary.ts`, `convex/chordCharts.ts` —
  see the tool's own bullet above for why this exists: the old single-blob storage broke on a real
  "massive playlist" import). Verified so far: the deployed functions are correctly wired and
  behave as expected when called *unauthenticated* (a plain Node script against the real dev
  backend, not a mock), and the signed-out/local code path is provably unchanged (same functions,
  same synthetic-script coverage, as before this session). **Not** verified: an actual signed-in
  import of a large playlist succeeding where it used to fail — this sandbox can't authenticate as
  a real user, so the one thing that actually matters most here (does Jack's original "massive
  playlist" import now work) is unconfirmed by anything stronger than the architecture no longer
  having the specific failure mode that caused it. Also unverified: the one-time
  `migrateFromSyncedSettings` migration actually preserving a real pre-existing library's playlists
  and songs correctly (only reasoned through, never run against real data — this sandbox has
  nothing to migrate); whether `getSongBars`' lazy per-song fetch introduces a noticeable delay
  switching between tunes in a real browser (the `selectedSongLoading` spinner is new and unclicked
  the way everything else visual here is); and whether `CreatePostModal`'s bulk `getSongsBars`
  fetch at submit time (via `useConvex().query`, not `useQuery`) actually returns bars keyed
  correctly by song id in practice, not just by reading the handler's code.

## Environment quirk (may not apply on a different machine)

On the machine this was developed on, something outside of any explicit `git commit` call was
auto-committing file edits to `main` as Jack's own git identity — `git status` looked clean
mid-session even though a lot had just changed. If that's not the case on a fresh clone/machine,
don't assume it — check `git log`, but also remember to actually commit (and push, which needs
Jack's hardware security key and can't be done from a sandboxed/non-interactive session) when work
should be saved.
