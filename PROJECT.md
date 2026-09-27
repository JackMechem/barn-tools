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
- **Tuner** — a Total-Energy-style circular note picker for a chromatic tuner + tone generator,
  with per-instrument string tunings.
- **Note Trainer** — drills random notes in an instrument's range. Has a mic-based "listen mode"
  (`lib/audioInput.ts`, `lib/pitchDetect.ts`, `lib/noteGrade.ts`) that listens through the
  microphone and grades correct/partial/incorrect, with a countdown ring and adjustable max-time
  per note.
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
  title string, so a new tool's title must exactly match its `NAV_LINKS` label.
- `components/CollapsiblePanel.tsx` (split layout) / `components/OptionsCard.tsx` +
  `OptionSection` (stacked layout) for settings sections. `CollapsiblePanel` supports
  `toggle={{checked,onChange,disabled}}` to put a switch in the header that gates whether the
  section can expand.
  - **Hydration gotcha:** the chevron button in a gated `CollapsiblePanel` must always be
    *rendered* (visually hidden with a CSS class like `invisible` when not expandable), never
    conditionally mounted/unmounted — the checked value comes from localStorage and can differ
    between the server default and the saved client value, and an element that's added/removed
    based on that will cause a real hydration mismatch. A class-only difference is fine.
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

## What's genuinely untested

Every change here has passed `next build` + `tsc --noEmit` + `eslint`, and audio-processing logic
(WAV encoding, pitch/beat detection, latency alignment) has been spot-checked with small synthetic
Node scripts — but **none of it has been exercised in a live browser with real audio hardware**.
If Jack reports odd behavior in any of these, treat it as genuinely unverified, not a regression
from something that used to work:

- Recorder: multitrack recording/overdub, the auto-latency burst-tone alignment, "align to beat",
  moving clips between tracks, WAV export/mixdown.
- Note Trainer listen mode: live pitch grading accuracy, the "ignore a held-over note" fix, the
  always-on max-time timer.
- Tuner: the tone generator and the per-instrument string tunings.

## Environment quirk (may not apply on a different machine)

On the machine this was developed on, something outside of any explicit `git commit` call was
auto-committing file edits to `main` as Jack's own git identity — `git status` looked clean
mid-session even though a lot had just changed. If that's not the case on a fresh clone/machine,
don't assume it — check `git log`, but also remember to actually commit (and push, which needs
Jack's hardware security key and can't be done from a sandboxed/non-interactive session) when work
should be saved.
