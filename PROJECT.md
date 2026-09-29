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

Phase 1 of a planned multi-phase addition (accounts, then syncing data across devices) — **so
far, accounts only, nothing syncs yet.** Every tool's actual data (tunes, chord charts, trainer
stats/history, recordings, ...) is still pure localStorage/IndexedDB, completely unaffected; every
tool still works fully with no account. This section will grow as later phases land.

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
- `convex/schema.ts` — currently just `{...authTables}` (Convex Auth's own tables: `users`,
  `authAccounts`, `authSessions`, etc.). No app data tables yet — those get added one at a time,
  each alongside the phase that actually uses it.
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
  one for the first time), sign-in methods (connect/disconnect Google), and delete account.
  Creating an account, changing/setting a password, and deleting an account (except a Google-only
  account — see below) all now require confirming a code emailed first, per an explicit follow-up
  request; a "forgot password" *reset* flow (recovering access when you don't know your *current*
  password at all) is still deliberately not implemented — a different thing from the email
  confirmations this section describes, and still out of scope. No route protection, consistent
  with the rest of the app — visiting it signed out just shows a plain "you're not signed in"
  message instead of redirecting. `convex/account.ts`'s `linkedProviders` query (which providers —
  `"password"`, `"google"` — are on the signed-in user's `authAccounts` rows) drives which of
  these sections show what.
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
