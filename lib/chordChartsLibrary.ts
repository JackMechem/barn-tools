import type { IRealSong } from "./iRealPro";

/** Shared between `ChordCharts.tsx` (the tool itself) and `CommunityChordCharts.tsx` (posting from
    it / importing into it), so both read and write the exact same synced library under the exact
    same key — a copy-pasted key string in two places would be a silent "why didn't my import show
    up" bug waiting to happen. */
export type StoredSong = IRealSong & { id: string };

export const LIBRARY_KEY = "jam-practice-chord-charts-library";
export const LIBRARY_DEFAULTS: { songs: StoredSong[] } = { songs: [] };

/** A name/composer/key fingerprint used to dedupe imports against what's already in a library —
    the same tune re-imported from a different playlist (or, now, from a Community post) shouldn't
    show up twice. */
export function songKey(song: IRealSong) {
  return `${song.title.toLowerCase()}__${song.composer.toLowerCase()}__${song.key.toLowerCase()}`;
}

function freshId(fallback: string) {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : fallback;
}

/** Merges `incoming` songs into `existing`, skipping anything that's already there by `songKey` —
    the same merge `ChordCharts.tsx`'s own playlist import has always done, reused as-is by
    Community chart imports so both paths behave identically. Returns the merged list plus how many
    were actually added (for a "N imported, M already in your library" status message). */
export function mergeSongs(
  existing: StoredSong[],
  incoming: IRealSong[],
): { songs: StoredSong[]; added: number; skipped: number } {
  const existingKeys = new Set(existing.map(songKey));
  const additions: StoredSong[] = [];
  for (const song of incoming) {
    const key = songKey(song);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    additions.push({ ...song, id: freshId(key) });
  }
  return {
    songs: [...existing, ...additions],
    added: additions.length,
    skipped: incoming.length - additions.length,
  };
}
