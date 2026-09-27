"use client";

import { SlidersIcon } from "@/components/tools";
import { usePersistedSettings } from "@/lib/usePersistedSettings";

const DEFAULTS = { open: true };

/**
 * One card holding a tool's option sections side by side (used by the full-width tools).
 * The whole card can be collapsed to its header, but the sections inside aren't collapsible
 * on their own.
 */
export function OptionsCard({ id, children }: { id: string; children: React.ReactNode }) {
  const [{ open }, update] = usePersistedSettings(`jam-practice-options-card-${id}`, DEFAULTS);
  const bodyId = `options-card-${id}`;

  return (
    <div className="w-full rounded-2xl bg-surface text-left">
      <button
        type="button"
        onClick={() => update({ open: !open })}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent sm:px-6"
      >
        <span className="flex items-center gap-2">
          <SlidersIcon className="h-4 w-4 shrink-0" />
          Options
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid gap-x-6 gap-y-6 px-4 pb-4 sm:px-6 sm:pb-6 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OptionSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Icon className="h-4 w-4 shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  );
}
