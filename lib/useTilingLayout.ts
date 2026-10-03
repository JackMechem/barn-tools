"use client";

import { useSyncExternalStore } from "react";
import type { PaneTree } from "@/lib/tilingLayout";

/** "Advanced layouts" (tiling panes) state — a device-local preference and arrangement, same
    category as the sidebar's own width/collapsed state (`components/Sidebar.tsx`'s own
    `STORAGE_KEY`/`getLayout`/`updateLayout`/`subscribeLayout`, the exact pattern mirrored here):
    not synced to the account, just this browser remembering what you last had open. `enabled`
    defaults to `false` so the feature stays invisible until someone deliberately turns it on;
    `tree`/`activePaneId` start `null` and get seeded with a single pane showing wherever you
    currently are the first time `TilingLayout` actually mounts (see that component), rather than
    defaulting to some fixed tool that might not be where you were. */
const STORAGE_KEY = "jam-practice-tiling";

export type TilingState = {
  enabled: boolean;
  tree: PaneTree | null;
  activePaneId: string | null;
};

const DEFAULT_STATE: TilingState = { enabled: false, tree: null, activePaneId: null };
let cached: TilingState | null = null;
const listeners = new Set<() => void>();

function read(): TilingState {
  if (cached) return cached;
  cached = DEFAULT_STATE;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && typeof stored === "object") {
      cached = {
        enabled: stored.enabled === true,
        // Not deeply validated against the real PaneTree shape — a malformed tree just fails to
        // find its leaves sensibly, and `TilingLayout`'s own reset button recovers from that.
        tree: stored.tree ?? null,
        activePaneId: typeof stored.activePaneId === "string" ? stored.activePaneId : null,
      };
    }
  } catch {
    // ignore unreadable storage
  }
  return cached;
}

function getServerState(): TilingState {
  return DEFAULT_STATE;
}

function write(patch: Partial<TilingState>) {
  cached = { ...read(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // storage unavailable
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTilingState() {
  return useSyncExternalStore(subscribe, read, getServerState);
}

export function updateTilingState(patch: Partial<TilingState>) {
  write(patch);
}
