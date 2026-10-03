"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { svgProps } from "@/components/tools";
import { TILEABLE_LINKS, TOOL_COMPONENTS } from "@/lib/toolRegistry";
import {
  type PaneSplit,
  type PaneTree,
  collectLeaves,
  createLeaf,
  removePane,
  resizeSplit,
  splitLeaf,
} from "@/lib/tilingLayout";
import { updateTilingState, useTilingState } from "@/lib/useTilingLayout";
import { filterLinks } from "@/components/tools";

function SplitRightIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" strokeDasharray="3 2" />
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

/** A small popover (anchored under the split button, portaled to `document.body`, positioned the
    same `getBoundingClientRect`-driven way `components/Select.tsx` already does) for picking
    which tool to open in a new pane and which direction to tile it. Reuses the exact same
    `filterLinks` search the `/` command palette uses, narrowed to `TILEABLE_LINKS`. */
function SplitPicker({
  anchorRef,
  onClose,
  onPick,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onPick: (href: string, direction: "row" | "col") => void;
}) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function place() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 288;
      // Right-align under the button (it sits at a pane's own top-right corner), clamped so it
      // never runs off the left edge of the viewport.
      const left = Math.max(8, rect.right - width);
      setPos({ left, top: rect.bottom + 6, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, onClose]);

  const results = filterLinks(query).filter((link) => TILEABLE_LINKS.includes(link));

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width }}
      className="z-[100] flex max-h-96 flex-col gap-2 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-foreground/10"
    >
      <label className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-muted focus-within:ring-2 focus-within:ring-accent">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted"
        />
      </label>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No tools found</li>}
        {results.map((link) => (
          <li
            key={link.href}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <link.icon className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate">{link.label}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onPick(link.href, "row")}
                title="Tile right"
                aria-label={`Tile ${link.label} to the right`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
              >
                <svg {...svgProps("h-4 w-4")}>
                  <path d="M12 5l7 7-7 7M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onPick(link.href, "col")}
                title="Tile down"
                aria-label={`Tile ${link.label} down`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
              >
                <svg {...svgProps("h-4 w-4")}>
                  <path d="M12 19l7-7-7-7M12 5v14" />
                </svg>
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}

/** One pane's own top-right control bar (the split button, and a close button once there's more
    than one pane to collapse back into) plus the actual tool, mounted via `TOOL_COMPONENTS`. */
function Pane({
  href,
  active,
  canClose,
  onFocus,
  onSplit,
  onClose,
}: {
  href: string;
  active: boolean;
  canClose: boolean;
  onFocus: () => void;
  onSplit: (direction: "row" | "col", newHref: string) => void;
  onClose: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const Component = TOOL_COMPONENTS[href];

  return (
    <div
      onPointerDownCapture={onFocus}
      className={`relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden transition-shadow ${
        active ? "ring-1 ring-inset ring-accent/40" : ""
      }`}
    >
      <div className="absolute right-2 top-2 z-20 flex gap-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-label="Split this pane"
          title="Split this pane"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-muted shadow-sm hover:bg-surface-hover hover:text-foreground"
        >
          <SplitRightIcon className="h-4 w-4" />
        </button>
        {canClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close this pane"
            title="Close this pane"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-muted shadow-sm hover:bg-surface-hover hover:text-danger"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {Component ? <Component /> : <p className="p-4 text-sm text-muted">Unknown tool.</p>}
      </div>
      {pickerOpen && (
        <SplitPicker
          anchorRef={buttonRef}
          onClose={() => setPickerOpen(false)}
          onPick={(newHref, direction) => {
            onSplit(direction, newHref);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** A resizable divider between two sibling panes — the exact same drag mechanics as
    `components/Sidebar.tsx`'s own resize handle (`setPointerCapture`, an absolute pointer-position
    -to-size mapping on every move rather than a drag-origin delta), just computing a percentage
    of the split container instead of an absolute pixel width. */
function SplitContainer({
  node,
  onResize,
  children,
}: {
  node: PaneSplit;
  onResize: (sizes: [number, number]) => void;
  children: [React.ReactNode, React.ReactNode];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const row = node.direction === "row";

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = row
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
    const clamped = Math.min(80, Math.max(20, pct));
    onResize([clamped, 100 - clamped]);
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full min-h-0 min-w-0 ${row ? "flex-row" : "flex-col"}`}
    >
      <div
        style={{ flexBasis: `${node.sizes[0]}%` }}
        className="h-full min-h-0 w-full min-w-0 shrink-0 grow-0 overflow-hidden"
      >
        {children[0]}
      </div>
      <div
        role="separator"
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-label={row ? "Resize panes horizontally" : "Resize panes vertically"}
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className={`group z-10 flex shrink-0 touch-none items-center justify-center outline-none ${
          row ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"
        }`}
      >
        <div
          className={`transition-colors group-hover:bg-accent group-focus-visible:bg-accent ${
            dragging ? "bg-accent" : "bg-surface-hover"
          } ${row ? "h-full w-0.5" : "h-0.5 w-full"}`}
        />
      </div>
      <div
        style={{ flexBasis: `${node.sizes[1]}%` }}
        className="h-full min-h-0 w-full min-w-0 shrink-0 grow-0 overflow-hidden"
      >
        {children[1]}
      </div>
    </div>
  );
}

function PaneNode({
  node,
  activePaneId,
  canClose,
  onFocus,
  onSplit,
  onClose,
  onResize,
}: {
  node: PaneTree;
  activePaneId: string;
  /** Whether *any* pane can be closed right now — false when this is the only pane left, since
      closing it would have nothing to collapse into (`removePane` would just no-op anyway, but
      showing a close button that does nothing is its own small confusion worth avoiding). */
  canClose: boolean;
  onFocus: (id: string) => void;
  onSplit: (targetId: string, direction: "row" | "col", newHref: string) => void;
  onClose: (targetId: string) => void;
  onResize: (splitId: string, sizes: [number, number]) => void;
}) {
  if (node.type === "leaf") {
    return (
      <Pane
        href={node.href}
        active={node.id === activePaneId}
        canClose={canClose}
        onFocus={() => onFocus(node.id)}
        onSplit={(direction, newHref) => onSplit(node.id, direction, newHref)}
        onClose={() => onClose(node.id)}
      />
    );
  }
  return (
    <SplitContainer node={node} onResize={(sizes) => onResize(node.id, sizes)}>
      <PaneNode
        node={node.children[0]}
        activePaneId={activePaneId}
        canClose={canClose}
        onFocus={onFocus}
        onSplit={onSplit}
        onClose={onClose}
        onResize={onResize}
      />
      <PaneNode
        node={node.children[1]}
        activePaneId={activePaneId}
        canClose={canClose}
        onFocus={onFocus}
        onSplit={onSplit}
        onClose={onClose}
        onResize={onResize}
      />
    </SplitContainer>
  );
}

/** Whether a single pane (not the real `Pane` — this one never shows a close button, since it's
    the only thing on screen) should instead be shown, because either the saved tree is a single
    leaf, or the screen is too narrow for a multi-pane arrangement to be usable at all (dragging a
    hairline divider on a phone isn't a reasonable interaction — the same "needs a desktop-sized
    screen" reasoning `NAV_LINKS`'s own `desktopOnly` flag uses for Recorder elsewhere in this
    app). The saved multi-pane tree itself isn't lost on a narrow screen, just not rendered as one
    — reopening on a wide enough screen shows the full arrangement again. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/**
 * "Advanced layouts" — an opt-in tiling window manager for the main content area. Off by default
 * (`lib/useTilingLayout.ts`'s `enabled`); `AppShell.tsx` only ever mounts this component once
 * that's true. Every pane renders its tool directly from `TOOL_COMPONENTS`, bypassing the Next.js
 * router entirely for the panes that aren't "the one matching the current URL" — there's no way
 * to have Next's own router simultaneously render several different routes' pages at once, so
 * this keeps its own tree of live, lazily-imported tool components instead, and only *reflects*
 * the active pane's href into the real URL (via `router.replace`, never `push` — tiling around
 * shouldn't flood the back button with history entries) so a copied link still opens the right
 * tool for whoever you send it to. That link only ever restores a single tool, never the whole
 * tiled arrangement — the arrangement itself is this browser's own `localStorage`, deliberately
 * not something encoded in the URL.
 */
export default function TilingLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const state = useTilingState();
  const isDesktop = useIsDesktop();

  // Seed a single pane showing wherever you currently are, the first time this ever mounts (or
  // after a reset) — not some fixed default tool that might not be where you were.
  useEffect(() => {
    if (state.tree) return;
    const root = createLeaf(pathname);
    updateTilingState({ tree: root, activePaneId: root.id });
  }, [state.tree, pathname]);

  if (!state.tree || !state.activePaneId) {
    // The brief instant before the effect above runs — nothing meaningful to show yet.
    return null;
  }

  function focusPane(id: string) {
    if (id === state.activePaneId) return; // already active — skip the redundant router call
    const leaf = collectLeaves(state.tree!).find((l) => l.id === id);
    updateTilingState({ activePaneId: id });
    if (leaf && leaf.href !== pathname) router.replace(leaf.href, { scroll: false });
  }

  function splitPane(targetId: string, direction: "row" | "col", newHref: string) {
    const { tree, newPaneId } = splitLeaf(state.tree!, targetId, direction, newHref);
    updateTilingState({ tree, activePaneId: newPaneId });
    if (newHref !== pathname) router.replace(newHref, { scroll: false });
  }

  function closePane(targetId: string) {
    const next = removePane(state.tree!, targetId);
    if (!next) return; // the only pane left — nothing to collapse into
    const leaves = collectLeaves(next);
    const stillActive = leaves.some((l) => l.id === state.activePaneId);
    const nextActive = stillActive ? leaves.find((l) => l.id === state.activePaneId)! : leaves[0];
    updateTilingState({ tree: next, activePaneId: nextActive.id });
    if (nextActive.href !== pathname) router.replace(nextActive.href, { scroll: false });
  }

  function resizeSplitNode(splitId: string, sizes: [number, number]) {
    updateTilingState({ tree: resizeSplit(state.tree!, splitId, sizes) });
  }

  if (!isDesktop) {
    const leaves = collectLeaves(state.tree);
    const active = leaves.find((l) => l.id === state.activePaneId) ?? leaves[0];
    return (
      <Pane
        href={active.href}
        active
        canClose={false}
        onFocus={() => {}}
        onSplit={() => {}}
        onClose={() => {}}
      />
    );
  }

  return (
    <PaneNode
      node={state.tree}
      activePaneId={state.activePaneId}
      canClose={collectLeaves(state.tree).length > 1}
      onFocus={focusPane}
      onSplit={splitPane}
      onClose={closePane}
      onResize={resizeSplitNode}
    />
  );
}
