"use client";

import { createContext, useContext } from "react";
import { EyeIcon, NAV_LINKS } from "@/components/tools";
import { useOptionsHidden } from "@/lib/panels";

const LayoutContext = createContext<"split" | "stacked">("split");

/** Which layout the surrounding tool page uses, so controls can pick matching icons. */
export function useToolLayout() {
  return useContext(LayoutContext);
}

/**
 * Shared page shell for the tools. On narrow screens everything stacks in one column;
 * on wide screens the options sit on the left and the main display on the right, and can be
 * hidden. With `layout="stacked"` the tool uses the full width with its options in one card
 * below it (always visible).
 */
export default function ToolLayout({
  title,
  options,
  layout = "split",
  topAligned = false,
  titleExtra,
  help,
  children,
}: {
  title: string;
  layout?: "split" | "stacked";
  /** With the stacked layout: pin content to the top and let it fill the height (no centring). */
  topAligned?: boolean;
  /** Shown to the right of the title in the page header (e.g. the current project). */
  titleExtra?: React.ReactNode;
  /** A help button shown right after the title. */
  help?: React.ReactNode;
  options: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useOptionsHidden();
  const stacked = layout === "stacked";
  const TitleIcon = NAV_LINKS.find((link) => link.label === title)?.icon;

  return (
    <LayoutContext.Provider value={layout}>
      <div className="relative flex min-h-full flex-1 flex-col bg-background text-foreground">
        <div className="absolute left-0 top-[calc(env(safe-area-inset-top)+0.75rem)] flex h-10 items-center pl-16 sm:pl-[4.5rem] lg:top-2 lg:pl-6">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-accent">
            {TitleIcon && <TitleIcon className="h-5 w-5 shrink-0" />}
            {title}
          </h1>
          {help && <div className="ml-3">{help}</div>}
          {titleExtra && <div className="ml-4 pr-4">{titleExtra}</div>}
        </div>

        {stacked ? (
          <main className="flex w-full flex-1 flex-col gap-6 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16">
            <section
              className={`flex w-full min-w-0 flex-1 flex-col items-center gap-6 text-center ${
                topAligned ? "justify-start" : "justify-center"
              }`}
            >
              {children}
            </section>
            <aside className="w-full">{options}</aside>
          </main>
        ) : (
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16 xl:max-w-5xl xl:flex-row xl:gap-14">
            <section className="flex w-full min-w-0 flex-col items-center gap-7 text-center xl:flex-1 xl:items-center xl:justify-center">
              <div className="relative flex w-full flex-col items-center gap-7 xl:max-w-[24rem]">
                {hidden && (
                  <button
                    type="button"
                    onClick={() => setHidden(false)}
                    aria-label="Show options"
                    title="Show options"
                    className="flex h-8 w-8 items-center justify-center self-start rounded-lg bg-surface text-muted outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent xl:absolute xl:-left-11 xl:-top-9 xl:self-auto"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                )}
                {children}
              </div>
            </section>
            {!hidden && (
              <aside className="flex w-full flex-col gap-3 xl:order-first xl:w-[24rem] xl:shrink-0">
                {options}
              </aside>
            )}
          </main>
        )}
      </div>
    </LayoutContext.Provider>
  );
}
