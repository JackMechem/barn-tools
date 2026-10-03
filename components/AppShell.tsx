"use client";

import TilingLayout from "@/components/TilingLayout";
import { useTilingState } from "@/lib/useTilingLayout";

/** Wraps `children` (the page Next.js actually resolved for the current URL) in the one div every
    route already rendered inside before "Advanced layouts" existed — unless that's turned on, in
    which case `children` is dropped entirely in favor of `TilingLayout`'s own tree of panes (see
    that component's own doc comment for why there's no way to reconcile "the real Next.js page"
    with "several independently-chosen tools on screen at once"). Reads the same
    `useTilingState()` the tiling layout itself does, so flipping "Advanced layouts" off/on from
    the sidebar swaps between the two instantly, no reload needed. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { enabled } = useTilingState();

  if (!enabled) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background lg:my-2 lg:ml-2 lg:mr-2 lg:rounded-xl lg:border lg:border-surface-hover">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background lg:my-2 lg:ml-2 lg:mr-2 lg:rounded-xl lg:border lg:border-surface-hover">
      <TilingLayout />
    </div>
  );
}
