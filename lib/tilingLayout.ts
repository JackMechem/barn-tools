/**
 * Pure data model for "Advanced layouts" — an opt-in, tiling-window-manager-style arrangement of
 * the main content area into multiple resizable panes, each showing a different tool. A
 * `PaneTree` is a binary tree: a `PaneLeaf` shows one tool at one href; a `PaneSplit` holds exactly
 * two children side by side (`"row"`, i.e. "tile right") or stacked (`"col"`, i.e. "tile down"),
 * with `sizes` as a `[first, second]` percentage pair summing to 100. No "up"/"left" direction
 * exists — matching the request this was built for, which only ever asked for right/down splits;
 * a pane can still end up visually on the left/top of its sibling, it's just never something you
 * explicitly choose, the same way a real tiling WM's "split" action works.
 */

export type PaneLeaf = {
  type: "leaf";
  id: string;
  href: string;
};

export type PaneSplit = {
  type: "split";
  id: string;
  direction: "row" | "col";
  sizes: [number, number];
  children: [PaneTree, PaneTree];
};

export type PaneTree = PaneLeaf | PaneSplit;

export function createLeaf(href: string): PaneLeaf {
  return { type: "leaf", id: crypto.randomUUID(), href };
}

/** Splits `targetId` (which must be a leaf) into a new split node — the existing leaf stays put,
    a brand new leaf showing `newHref` is added as its sibling. Returns the whole new tree plus the
    new leaf's id (so the caller can make it the active pane). A no-op (same tree, a fresh unused
    id) if `targetId` isn't found — shouldn't normally happen, since the split button only ever
    knows about panes that actually exist. */
export function splitLeaf(
  tree: PaneTree,
  targetId: string,
  direction: "row" | "col",
  newHref: string,
): { tree: PaneTree; newPaneId: string } {
  const newLeaf = createLeaf(newHref);

  function recurse(node: PaneTree): PaneTree {
    if (node.type === "leaf") {
      if (node.id !== targetId) return node;
      return {
        type: "split",
        id: crypto.randomUUID(),
        direction,
        sizes: [50, 50],
        children: [node, newLeaf],
      };
    }
    return { ...node, children: [recurse(node.children[0]), recurse(node.children[1])] };
  }

  return { tree: recurse(tree), newPaneId: newLeaf.id };
}

const REMOVE = Symbol("remove");

/** Removes the leaf `targetId` and collapses its parent split into just the *sibling* subtree —
    standard tiling-WM "close this window" behavior. Returns `null` if `targetId` was the tree's
    only leaf (nothing left to show — the caller's job to fall back to something sensible, e.g.
    turning "Advanced layouts" back off). */
export function removePane(tree: PaneTree, targetId: string): PaneTree | null {
  function recurse(node: PaneTree): PaneTree | typeof REMOVE {
    if (node.type === "leaf") return node.id === targetId ? REMOVE : node;
    const [a, b] = node.children;
    const resA = recurse(a);
    if (resA === REMOVE) return b;
    const resB = recurse(b);
    if (resB === REMOVE) return a;
    if (resA === a && resB === b) return node;
    return { ...node, children: [resA, resB] };
  }
  const result = recurse(tree);
  return result === REMOVE ? null : result;
}

/** Resizes one split node in place, leaving the rest of the tree untouched. */
export function resizeSplit(tree: PaneTree, splitId: string, sizes: [number, number]): PaneTree {
  if (tree.type === "leaf") return tree;
  if (tree.id === splitId) return { ...tree, sizes };
  return {
    ...tree,
    children: [resizeSplit(tree.children[0], splitId, sizes), resizeSplit(tree.children[1], splitId, sizes)],
  };
}

/** Every leaf in the tree, left-to-right / top-to-bottom in tree order. */
export function collectLeaves(tree: PaneTree): PaneLeaf[] {
  if (tree.type === "leaf") return [tree];
  return [...collectLeaves(tree.children[0]), ...collectLeaves(tree.children[1])];
}
