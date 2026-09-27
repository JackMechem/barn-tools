import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  snapshotOf,
  subscribeTo,
  usePersistedSettings,
  writeSettings,
} from "@/lib/usePersistedSettings";

export const PANEL_DEFAULTS = { open: true };

export function panelKey(id: string) {
  return `jam-practice-panel-${id}`;
}

/** Whether any of the given panels is open, plus a way to open or close them all at once. */
export function usePanelsToggle(ids: string[]) {
  const joined = ids.join(",");
  const keys = useMemo(() => joined.split(",").map(panelKey), [joined]);

  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribers = keys.map((key) => subscribeTo(key, listener));
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
    [keys],
  );
  const getSnapshot = useCallback(
    () => keys.some((key) => snapshotOf(key, PANEL_DEFAULTS).open),
    [keys],
  );
  const anyOpen = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const setAll = useCallback(
    (open: boolean) => {
      for (const key of keys) writeSettings(key, PANEL_DEFAULTS, { open });
    },
    [keys],
  );

  return { anyOpen, setAll };
}

const OPTIONS_KEY = "jam-practice-options";
const OPTIONS_DEFAULTS = { hidden: false };

/** Whether the options column is hidden on the tool pages (one setting shared by all of them). */
export function useOptionsHidden(): [boolean, (hidden: boolean) => void] {
  const [{ hidden }, update] = usePersistedSettings(OPTIONS_KEY, OPTIONS_DEFAULTS);
  return [hidden, (next) => update({ hidden: next })];
}
