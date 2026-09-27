"use client";

import { PANEL_DEFAULTS, panelKey } from "@/lib/panels";
import { usePersistedSettings } from "@/lib/usePersistedSettings";

/** A titled settings card whose body can be folded away. The open state is remembered. */
export default function CollapsiblePanel({
  id,
  title,
  icon: Icon,
  action,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra control shown at the right of the header (stays visible when collapsed). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [{ open }, update] = usePersistedSettings(panelKey(id), PANEL_DEFAULTS);
  const bodyId = `panel-${id}`;

  return (
    <section className="w-full rounded-2xl bg-surface text-left">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => update({ open: !open })}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent sm:px-6"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </button>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        <button
          type="button"
          onClick={() => update({ open: !open })}
          tabIndex={-1}
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-foreground sm:mr-3"
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
      </div>
      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
