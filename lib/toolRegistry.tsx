"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { NAV_LINKS } from "@/components/tools";

function PaneLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

/** href -> that tool's own component, lazily imported. A hand-written mapping, not derived from
    `NAV_LINKS` automatically — `next/dynamic`'s `import()` needs a static, literal path for
    webpack/Next's bundler to code-split correctly, so it can't be built from a variable the way
    `NAV_LINKS` itself is read generically elsewhere. This is what lets `TilingLayout` mount any
    tool in any pane directly (bypassing the Next.js router entirely for everything but the one
    pane whose href happens to match the current URL), instead of needing every pane to be a real,
    separately-routed page. */
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "/jam-practice": dynamic(() => import("@/components/JamPractice"), { loading: PaneLoading }),
  "/note-trainer": dynamic(() => import("@/components/NoteTrainer"), { loading: PaneLoading }),
  "/scale-trainer": dynamic(() => import("@/components/ScaleTrainer"), { loading: PaneLoading }),
  "/interval-trainer": dynamic(() => import("@/components/IntervalTrainer"), { loading: PaneLoading }),
  "/guess-the-interval": dynamic(() => import("@/components/GuessTheInterval"), { loading: PaneLoading }),
  "/guess-the-chord": dynamic(() => import("@/components/GuessTheChord"), { loading: PaneLoading }),
  "/practice-timer": dynamic(() => import("@/components/PracticeTimer"), { loading: PaneLoading }),
  "/metronome": dynamic(() => import("@/components/Metronome"), { loading: PaneLoading }),
  "/random-metric-modulation": dynamic(() => import("@/components/RandomMetricModulation"), {
    loading: PaneLoading,
  }),
  "/tuner": dynamic(() => import("@/components/Tuner"), { loading: PaneLoading }),
  "/slow-downer": dynamic(() => import("@/components/SlowDowner"), { loading: PaneLoading }),
  "/chord-charts": dynamic(() => import("@/components/ChordCharts"), { loading: PaneLoading }),
  "/recorder": dynamic(() => import("@/components/Recorder"), { loading: PaneLoading }),
};

/** The subset of `NAV_LINKS` that can actually be tiled — every real tool, deliberately not
    account/community/legal pages (those aren't "tools" to arrange side by side the way the
    metronome and the tuner are), per an explicit scoping call. */
export const TILEABLE_LINKS = NAV_LINKS.filter((link) => link.href in TOOL_COMPONENTS);
