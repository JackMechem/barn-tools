# jackshed — project notes for AI agents

This file is for picking up work on this repo in a fresh session (including on a different
computer after a clone). It's hand-maintained, separate from the auto-generated Next.js warning
in `AGENTS.md`.

## What this is

A personal collection of browser-based music practice tools, built for Jack (a musician/dev) as a
Next.js (App Router) + Tailwind app, all client components (`"use client"`). Everything runs
client-side — no backend, no accounts. Per-tool settings and data (tunes, projects, recordings)
persist in the browser via localStorage / IndexedDB, not on a server.

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
  (see below). An optional second click (own tone, own mute, own `BeatIndicator`) runs the whole
  time as a second track on the _same_ `startClickEngine` call (see below) so it can hear/see it
  against whatever the main click has modulated to — pinned to the true starting tempo in "return
  to original" mode, or otherwise always the tempo the main click just left (one modulation
  behind). Each modulation carries an exact `num`/`den` (e.g. 3:2), so it also shows what the new
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
- **Slow Downer** — load a local audio/video file, slow playback without pitch shift, loop
  sections, add named markers with notes, zoom/pan the waveform.
- **Recorder** — multitrack recording: per-track clips, punch-in recording, trim/crop/repeat/move
  clips (even between tracks), automatic recording/playback sync via an inaudible burst-tone
  trick (`lib/syncBurst.ts`), a "align to beat" pitch-based nudge (`lib/alignBeat.ts`), WAV
  export/mixdown. **Desktop-only** — greyed out on phones via `desktopOnly` in
  `components/tools.tsx`'s `NAV_LINKS`.
- **Home** (`app/page.tsx` / `components/Home.tsx`) — just the logo/name and a "press / to
  search" hint; not itself in the nav list (the logo links to it instead).

## Shared conventions — reuse these before writing something new

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
  `useSyncExternalStore` memoization (and SSR-safety) breaks.
- `components/Select.tsx`, `SwitchRow.tsx`, `ConfirmDialog.tsx`, `PromptDialog.tsx`,
  `NumberField.tsx`, `KeyHint.tsx`, `HelpButton.tsx`, `ContextMenu.tsx`: shared
  form/dialog/menu primitives.
- `components/Waveform.tsx` + `lib/multitrack.ts` (the `Engine` class) + `lib/clips.ts`: the
  audio-editing core shared by Slow Downer and Recorder — waveform drawing/interaction (zoom,
  pan, loop, markers, clip trim/repeat/move), and sample-accurate scheduled playback. Read before
  touching; it's the most complex part of the codebase.
- `components/tools.tsx`: every icon component plus `NAV_LINKS` (the sidebar/search/title-icon
  source of truth) and `TOOLS` (currently unused, `NAV_LINKS` minus `/`).
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
  interval out loud" and Guess the Interval's playback (`TONES`, `DEFAULT_TONE_ID`, `playNote`).
  Each `Tone` is just an `id`/`label` plus a `play(ctx, freq, durationSeconds)` function building
  its own Web Audio graph from scratch per note — simple waveforms (triangle/sine/square/sawtooth,
  plus "organ"/"pluck" as hand-picked `PeriodicWave` Fourier coefficients) share one `waveTone`
  helper, while "Piano" and "Rhodes" are their own small synthesis functions: Piano sums five
  detuned-off-exact-integer sine partials (real strings are slightly inharmonic) through a lowpass
  filter that sweeps darker over the note's length (a hammer strike is bright and decays duller);
  Rhodes is 2-operator FM (a sine carrier, a sine modulator an octave up) whose modulation index
  decays quickly from a bright attack "bark" into a smoother sustained tone. Both are synthesized,
  not sampled — there's no audio-asset pipeline anywhere in this app (everything's synthesis or
  the mic), so "actual instrument sounds" here means a better *model* of the instrument, not a
  recording of one. `DEFAULT_TONE_ID` is still "triangle" (unchanged, so existing persisted
  settings aren't affected) — Piano/Rhodes are opt-in via the Tone dropdown, not a new default.

## What's genuinely untested

Every change here has passed `next build` + `tsc --noEmit` + `eslint`, and audio-processing logic
(WAV encoding, pitch/beat detection, latency alignment) has been spot-checked with small synthetic
Node scripts — but **none of it has been exercised in a live browser with real audio hardware**.
If Jack reports odd behavior in any of these, treat it as genuinely unverified, not a regression
from something that used to work:

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
- `lib/tones.ts`'s "Piano" and "Rhodes" tones: entirely untested by ear — the synthesis (partial
  gains/ratios, filter sweep, FM modulation index/decay time) was only checked structurally, with
  a mocked Web Audio graph asserting the right nodes get created/connected/started with sane
  values, never against what it actually sounds like or how loud it is next to the older tones
  (whose gain constants were themselves presumably ear-tuned at some point). Likely needs a
  balance pass once someone can actually listen.
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

## Environment quirk (may not apply on a different machine)

On the machine this was developed on, something outside of any explicit `git commit` call was
auto-committing file edits to `main` as Jack's own git identity — `git status` looked clean
mid-session even though a lot had just changed. If that's not the case on a fresh clone/machine,
don't assume it — check `git log`, but also remember to actually commit (and push, which needs
Jack's hardware security key and can't be done from a sandboxed/non-interactive session) when work
should be saved.
