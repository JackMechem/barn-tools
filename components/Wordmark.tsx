"use client";

// Hand-picked bar heights, not `Math.random()`'d at render time — a random array here would be a
// real hydration mismatch (server and client markup must match exactly), the same class of bug
// `CollapsiblePanel.tsx`'s own "always render the chevron" comment warns about elsewhere in this
// app. Two separate arrays, not one sliced down to fewer bars — the much narrower sidebar/mobile
// lockup needs a different bar density to read right behind the smaller text, not just fewer of
// the hero's own bars.
const WAVEFORM_LG = [
  18, 34, 14, 46, 24, 58, 20, 40, 64, 28, 50, 16, 60, 22, 44, 12, 36, 66, 20, 52, 26, 42, 14, 38,
  56, 18, 48, 24, 32, 16,
];
const WAVEFORM_SM = [30, 60, 20, 85, 45, 100, 35, 70, 50, 90, 25, 65, 40, 78, 32, 58];

/** The "sheddex" wordmark with the waveform bars running behind it (peeking out above, below, and
    through the gaps in the letterforms) — shared by the home page hero, the desktop sidebar
    header, and the mobile menu header, so there's exactly one place this effect is drawn rather
    than three slightly-drifting copies. The caller's own `className` sets the outer box, whose
    *height* is what the absolutely-positioned bars actually fill (and whose width, if wider than
    the text, needs `justify-center` added via that same `className` to center the text within
    it — off by default, since the sidebar/mobile usages want the text left-aligned instead).
    `textClassName` sets "sheddex" itself's size, since every context uses a different one. */
export default function Wordmark({
  size = "sm",
  heading = false,
  className = "",
  textClassName = "text-lg",
}: {
  /** "lg" (the hero) and "sm" (sidebar/mobile) each use their own hand-tuned bar array/density —
      not just a scaled-down version of the other. */
  size?: "sm" | "lg";
  /** Renders "sheddex" as an `<h1>` instead of a plain `<span>` — for the one place (the home
      page hero) this text is also the page's actual main heading. */
  heading?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const bars = size === "lg" ? WAVEFORM_LG : WAVEFORM_SM;
  const Text = heading ? "h1" : "span";
  return (
    <span className={`relative inline-flex min-w-0 items-center ${className}`}>
      <span
        aria-hidden
        className={`absolute inset-0 flex items-center ${size === "lg" ? "gap-[3px]" : "gap-[2px]"}`}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className={`${size === "lg" ? "w-1" : "w-0.5"} flex-1 rounded-full bg-accent/20`}
            style={{ height: `${h}%` }}
          />
        ))}
      </span>
      <Text className={`relative truncate font-bold tracking-tight text-accent ${textClassName}`}>
        sheddex
      </Text>
    </span>
  );
}
