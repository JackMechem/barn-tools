"use client";

// Shared by the sidebar and the command palette.

export function svgProps(className?: string) {
  return {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "h-4 w-4",
  };
}

export function MetronomeIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M8 21h8l-2.5-16h-3z" />
      <path d="M12 16l4-8" />
    </svg>
  );
}

export function NoteIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function StopwatchIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6M12 2v3" />
    </svg>
  );
}

export function MeterIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 5v14M20 5v14M12 5v14M4 12h16" />
    </svg>
  );
}

export function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M11 5L6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 010 7M18.5 6a9 9 0 010 12" />
    </svg>
  );
}

export function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function ListIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

export function BookIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" />
      <path d="M4 21a2 2 0 012-2h13v2H6" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 6l2 2 3-3.5M3 13l2 2 3-3.5M12 7h9M12 14h9M12 20h9M3 20h.01" />
    </svg>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" />
    </svg>
  );
}

export function TunerIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 17a8 8 0 0116 0" />
      <path d="M12 17l4-7" />
      <circle cx="12" cy="17" r="1.2" />
    </svg>
  );
}

export function BarnLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 30L32 8l26 22" />
      <path d="M11 26v30h42V26" />
      <rect
        x="22"
        y="34"
        width="20"
        height="22"
        rx="1"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M22 34l20 22M42 34L22 56" />
      <path d="M32 26v.01" strokeWidth="5" />
    </svg>
  );
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M10.7 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-2.6 3.4M6.6 6.6A16.7 16.7 0 002 12s3.6 7 10 7a10.5 10.5 0 005.4-1.5" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2M3 3l18 18" />
    </svg>
  );
}

export function WaveIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 12h2M7 8v8M11 4v16M15 8v8M19 10v4M21 12h.01" />
    </svg>
  );
}

export function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 014-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 01-4 4H3" />
    </svg>
  );
}

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13a1 1 0 001.5.86l11-6.5a1 1 0 000-1.72l-11-6.5A1 1 0 008 5.5z" />
    </svg>
  );
}

export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)} fill="currentColor" stroke="none">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function FlagIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

export function ExpandHeightIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
    </svg>
  );
}

export function ShrinkHeightIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 12h16M8 4l4 4 4-4M8 20l4-4 4 4" />
    </svg>
  );
}

export function RecordIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

export function StopIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)} fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
    </svg>
  );
}

export function HelpIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.500 2-2.500 3.500M12 17h.01" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 7h3c5 0 5 10 10 10h5M3 17h3c1.8 0 3-.9 4-2M14 9c.9-1.2 2-2 4-2h3" />
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </svg>
  );
}

export function MetricModulationIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M8 21h8l-2.5-16h-3z" />
      <path d="M12 17l3-7" />
      <path d="M4 6l-2 2 2 2M20 6l2 2-2 2" />
    </svg>
  );
}

export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

/** Groups tools in the sidebar and search; also fixes their display order. */
export const CATEGORIES = ["Practice", "Timing & Tuning", "Audio"] as const;
export type Category = (typeof CATEGORIES)[number];

export const NAV_LINKS = [
  {
    href: "/jam-practice",
    label: "Jam Practice",
    description:
      "Build a tune list, pick one at random and get counted in at the right tempo.",
    icon: ShuffleIcon,
    category: "Practice" as Category,
  },
  {
    href: "/note-trainer",
    label: "Note Trainer",
    description:
      "Random notes in your instrument's range, with a listen mode that grades you.",
    icon: NoteIcon,
    category: "Practice" as Category,
  },
  {
    href: "/metronome",
    label: "Metronome",
    description:
      "Any time signature, custom accents, subdivisions and tap tempo.",
    icon: MetronomeIcon,
    category: "Timing & Tuning" as Category,
  },
  {
    href: "/random-metric-modulation",
    label: "Polyrhythm Metric Modulation Metronome",
    description:
      "A metronome that jumps to a new, mathematically related tempo every few bars.",
    icon: MetricModulationIcon,
    category: "Timing & Tuning" as Category,
  },
  {
    href: "/tuner",
    label: "Tuner",
    description:
      "Tune by ear or by mic with a tone generator, for strings, brass and reeds.",
    icon: TunerIcon,
    category: "Timing & Tuning" as Category,
  },
  {
    href: "/slow-downer",
    label: "Slow Downer",
    description:
      "Load a song, slow it down without changing pitch and loop the tricky parts.",
    icon: WaveIcon,
    category: "Audio" as Category,
  },
  {
    href: "/recorder",
    label: "Recorder",
    description:
      "Record yourself, play it back with loops and markers, and export the audio.",
    icon: RecordIcon,
    category: "Audio" as Category,
    /** Needs a desktop-sized screen; it's greyed out in the mobile menu. */
    desktopOnly: true,
  },
];

export function filterLinks(query: string) {
  const q = query.trim().toLowerCase();
  return q
    ? NAV_LINKS.filter((link) => link.label.toLowerCase().includes(q))
    : NAV_LINKS;
}

/** Buckets a (possibly filtered) list of links by category, in `CATEGORIES` order. */
export function groupByCategory<T extends { category: Category }>(
  links: T[],
): { category: Category; items: T[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    items: links.filter((link) => link.category === category),
  })).filter((group) => group.items.length > 0);
}
