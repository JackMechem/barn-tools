"use client";

import { useSyncExternalStore } from "react";
import { getServerTheme, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-lg hover:bg-surface-hover"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
