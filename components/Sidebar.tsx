"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { OPEN_PALETTE_EVENT } from "@/components/CommandPalette";
import ThemeModal from "@/components/ThemeModal";
import { BarnLogo, SearchIcon, filterLinks, svgProps } from "@/components/tools";

const STORAGE_KEY = "jam-practice-sidebar";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 160;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 60;

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3a9 9 0 000 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-7.8-9-7.8z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7" r="1" />
      <circle cx="15.5" cy="7.5" r="1" />
    </svg>
  );
}

function ChevronsIcon({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg {...svgProps(className)} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function clamp(n: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}

type Layout = { width: number; collapsed: boolean };

const DEFAULT_LAYOUT: Layout = { width: DEFAULT_WIDTH, collapsed: false };
const layoutListeners = new Set<() => void>();
let cachedLayout: Layout | null = null;

function getLayout(): Layout {
  if (cachedLayout) return cachedLayout;
  cachedLayout = DEFAULT_LAYOUT;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored) {
      cachedLayout = {
        width: typeof stored.width === "number" ? clamp(stored.width) : DEFAULT_WIDTH,
        collapsed: stored.collapsed === true,
      };
    }
  } catch {
    // ignore unreadable storage
  }
  return cachedLayout;
}

function getServerLayout(): Layout {
  return DEFAULT_LAYOUT;
}

function updateLayout(patch: Partial<Layout>) {
  cachedLayout = { ...getLayout(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedLayout));
  } catch {
    // storage unavailable
  }
  for (const listener of layoutListeners) listener();
}

function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  return () => layoutListeners.delete(listener);
}

function SearchBox({
  query,
  onChange,
  onNavigate,
  large,
}: {
  query: string;
  onChange: (query: string) => void;
  onNavigate?: () => void;
  large?: boolean;
}) {
  const router = useRouter();

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      onChange("");
    } else if (e.key === "Enter") {
      const first = filterLinks(query)[0];
      if (!first) return;
      router.push(first.href);
      onChange("");
      onNavigate?.();
    }
  }

  // On desktop the sidebar search is a button that opens the same menu as pressing "/".
  if (!large) {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        aria-label="Search tools"
        className="mb-3 flex w-full items-center gap-2 rounded-lg bg-background px-3 py-2 text-left text-sm text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">Press / to search</span>
      </button>
    );
  }

  return (
    <label
      className={`mb-3 flex items-center gap-2 ${large ? "rounded-xl" : "rounded-lg"} bg-background px-3 text-muted focus-within:ring-2 focus-within:ring-accent ${
        large ? "py-2.5 text-base" : "py-2 text-sm"
      }`}
    >
      <SearchIcon className="h-4 w-4 shrink-0" />
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={large ? "Search tools" : "Press / to search"}
        aria-label="Search tools"
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted"
      />
    </label>
  );
}

function NavItems({
  collapsed,
  large,
  query = "",
  onNavigate,
}: {
  collapsed?: boolean;
  large?: boolean;
  query?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const links = filterLinks(query);
  return (
    <nav className="flex flex-col gap-1">
      {links.length === 0 && (
        <p className={`px-3 text-muted ${large ? "text-base" : "text-sm"}`}>No tools found</p>
      )}
      {links.map(({ href, label, icon: Icon, desktopOnly }) => {
        const active = pathname === href;
        // On phones, tools that need a bigger screen are shown greyed out and can't be opened.
        if (large && desktopOnly) {
          return (
            <div
              key={href}
              aria-disabled="true"
              title="Needs a larger screen"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-muted opacity-40"
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
              <span className="ml-auto text-xs font-normal">Desktop only</span>
            </div>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 ${large ? "rounded-xl" : "rounded-lg"} border px-3 font-medium transition-colors ${
              large ? "py-3 text-base" : "py-2 text-sm"
            } ${collapsed ? "justify-center" : ""} ${
              active
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-transparent text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Icon className={large ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeButton({
  collapsed,
  large,
  onClick,
}: {
  collapsed?: boolean;
  large?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "Theme" : undefined}
      className={`flex w-full items-center gap-3 ${large ? "rounded-xl" : "rounded-lg"} px-3 font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground ${
        large ? "py-3 text-base" : "py-2 text-sm"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <PaletteIcon className={large ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"} />
      {!collapsed && <span>Theme</span>}
    </button>
  );
}

export default function Sidebar() {
  const { width, collapsed } = useSyncExternalStore(subscribeLayout, getLayout, getServerLayout);
  const [dragging, setDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);

  const setWidth = (w: number) => updateLayout({ width: clamp(w) });
  const setCollapsed = (c: boolean) => updateLayout({ collapsed: c });

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileOpen]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    if (collapsed) {
      updateLayout({ collapsed: false, width: MIN_WIDTH });
    }
  }

  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
    setWidth(e.clientX - left);
  }

  function onKeyResize(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setWidth(width - 16);
    else if (e.key === "ArrowRight") setWidth(width + 16);
    else return;
    e.preventDefault();
  }

  const shownWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface hover:bg-surface-hover lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:hidden">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              aria-label="jackshed home"
              className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-accent ring-1 ring-foreground/10">
                <BarnLogo className="h-6 w-6" />
              </span>
              <span className="text-xl font-bold tracking-tight text-accent">jackshed</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-hover"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <SearchBox
            large
            query={query}
            onChange={setQuery}
            onNavigate={() => setMobileOpen(false)}
          />
          <NavItems large query={query} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto">
            <ThemeButton large onClick={() => setThemeOpen(true)} />
          </div>
        </div>
      )}

      {themeOpen && <ThemeModal onClose={() => setThemeOpen(false)} />}

      <aside
        style={{ width: shownWidth }}
        className={`relative hidden shrink-0 flex-col bg-surface p-2 lg:flex ${
          dragging ? "" : "transition-[width] duration-150"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <ChevronsIcon className="h-4 w-4" flip={collapsed} />
        </button>
        <div className="mb-4 flex h-10 items-center overflow-hidden pl-1 pr-12">
          {!collapsed && (
            <Link
              href="/"
              aria-label="jackshed home"
              className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-accent ring-1 ring-foreground/10">
                <BarnLogo className="h-5 w-5" />
              </span>
              <span className="truncate text-lg font-bold tracking-tight text-accent">jackshed</span>
            </Link>
          )}
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            aria-label="Search tools"
            title="Search tools"
            className="mb-3 flex items-center justify-center rounded-lg px-3 py-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        ) : (
          <SearchBox query={query} onChange={setQuery} />
        )}
        <NavItems collapsed={collapsed} query={query} />
        <div className="mt-auto flex flex-col gap-1 border-t border-surface-hover pt-2">
          <ThemeButton collapsed={collapsed} onClick={() => setThemeOpen(true)} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={shownWidth}
          tabIndex={0}
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={onKeyResize}
          className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none justify-center outline-none"
        >
          <div
            className={`h-full w-0.5 transition-colors group-hover:bg-accent group-focus-visible:bg-accent ${
              dragging ? "bg-accent" : ""
            }`}
          />
        </div>
      </aside>
    </>
  );
}
