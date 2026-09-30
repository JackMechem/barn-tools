"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ChordChart from "@/components/ChordChart";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import UserAvatar from "@/components/UserAvatar";
import { CheckIcon, DownloadIcon, PlusIcon, TrashIcon } from "@/components/tools";
import { formatComposer, type IRealSong } from "@/lib/iRealPro";
import {
  LIBRARY_DEFAULTS,
  LIBRARY_KEY,
  mergeSongs,
  songKey,
  type StoredSong,
} from "@/lib/chordChartsLibrary";
import { useSyncedSettings } from "@/lib/useSyncedSettings";

function toIRealSong(s: StoredSong): IRealSong {
  return {
    title: s.title,
    composer: s.composer,
    style: s.style,
    key: s.key,
    timeSignature: s.timeSignature,
    bars: s.bars,
  };
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** The Community page's "Chord Charts" section (`Community.tsx`'s third view) — browse chord
    charts and playlists other people have posted, post your own, and import anything you find
    straight into your own Chord Charts library (`lib/chordChartsLibrary.ts`, the same
    `syncedSettings` blob `components/ChordCharts.tsx` itself reads/writes — an import here shows
    up there immediately, no separate copy to keep in sync). Browsing only needs to be signed in;
    posting also needs the caller's own profile to be public (enforced server-side in
    `convex/communityChordCharts.ts`'s `create`, mirrored here so the "Post" button explains why
    it's unavailable instead of just failing). */
export default function CommunityChordCharts() {
  const profile = useQuery(api.profiles.getMine);
  const posts = useQuery(api.communityChordCharts.list);
  const removePost = useMutation(api.communityChordCharts.remove);
  const [library] = useSyncedSettings(LIBRARY_KEY, LIBRARY_DEFAULTS);

  const [showCreate, setShowCreate] = useState(false);
  const [openPostId, setOpenPostId] = useState<Id<"communityChordCharts"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"communityChordCharts"> | null>(null);

  const canPost = profile?.isPublic === true;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">
          Chord charts and playlists other jackshed users have posted. Import one straight into
          your own Chord Charts library.
        </p>
        {profile !== undefined &&
          (canPost ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Post a chart
            </button>
          ) : (
            <p className="shrink-0 text-xs text-muted">
              <Link href="/account" className="text-accent hover:underline">
                Make your profile public
              </Link>{" "}
              to post here.
            </p>
          ))}
      </div>

      {posts === undefined ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-muted">
          Nobody&apos;s posted a chord chart yet — be the first.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{post.title}</p>
                  {post.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{post.description}</p>
                  )}
                </div>
                {post.isMine && (
                  <button
                    type="button"
                    onClick={() => setDeletingId(post.id)}
                    aria-label="Delete post"
                    title="Delete post"
                    className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-background hover:text-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {post.authorUsername && (
                  <Link
                    href={`/u/${post.authorUsername}`}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <UserAvatar url={post.authorAvatarUrl} size="sm" />
                    {post.authorUsername}
                  </Link>
                )}
                <span aria-hidden>·</span>
                <span>
                  {post.songCount} chart{post.songCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>

              <button
                type="button"
                onClick={() => setOpenPostId(post.id)}
                className="self-start rounded-lg bg-background px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
              >
                View &amp; import
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreatePostModal library={library.songs} onClose={() => setShowCreate(false)} />
      )}

      {openPostId && (
        <PostDetailModal id={openPostId} onClose={() => setOpenPostId(null)} />
      )}

      {deletingId && (
        <ConfirmDialog
          title="Delete this post?"
          message="This removes it from Community for everyone. It doesn't touch anyone who already imported it."
          confirmLabel="Delete"
          onConfirm={() => {
            void removePost({ id: deletingId });
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

/** The "post a chart" form — picks one or more songs out of the caller's own Chord Charts
    library (nothing to paste here; you post what you've already imported there) and snapshots
    them into a new Community post via `communityChordCharts.create`. */
function CreatePostModal({
  library,
  onClose,
}: {
  library: StoredSong[];
  onClose: () => void;
}) {
  const create = useMutation(api.communityChordCharts.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...library].sort((a, b) => a.title.localeCompare(b.title)),
    [library],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) => s.title.toLowerCase().includes(q) || s.composer.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Give this post a title.");
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one chart to post.");
      return;
    }
    setSubmitting(true);
    try {
      const songs = library
        .filter((s) => selected.has(s.id))
        .map(toIRealSong);
      await create({ title: title.trim(), description: description.trim(), songs });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Post a chart to Community"
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface p-5 text-left text-foreground shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Post to Community</h2>

        {library.length === 0 ? (
          <p className="text-sm text-muted">
            Your Chord Charts library is empty — import a playlist in the Chord Charts tool first,
            then come back here to post from it.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Real Book vol. 1 standards"
                className="rounded-lg bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-y rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">
                  Charts to include ({selected.size} selected)
                </span>
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your library…"
                className="rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
              <ul className="max-h-56 overflow-y-auto rounded-lg bg-background">
                {filtered.map((song) => (
                  <li key={song.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={selected.has(song.id)}
                        onChange={() => toggle(song.id)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {song.title}
                        {song.composer && (
                          <span className="text-muted"> — {formatComposer(song.composer)}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Cancel
          </button>
          {library.length > 0 && (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A single post's full content — every song in it, each previewable inline (the same
    `ChordChart` component the Chord Charts tool itself renders with) and importable individually,
    plus an "Import all" shortcut for the whole playlist. Fetches the post's full data lazily
    (`communityChordCharts.get`, only queried once this modal actually mounts) rather than the
    browse list carrying every post's full chart data up front. */
function PostDetailModal({ id, onClose }: { id: Id<"communityChordCharts">; onClose: () => void }) {
  const post = useQuery(api.communityChordCharts.get, { id });
  const [{ songs: myLibrary }, updateLibrary] = useSyncedSettings(LIBRARY_KEY, LIBRARY_DEFAULTS);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const haveKeys = useMemo(() => new Set(myLibrary.map(songKey)), [myLibrary]);

  function importSongs(songs: IRealSong[], label: string) {
    const { songs: merged, added, skipped } = mergeSongs(myLibrary, songs);
    updateLibrary({ songs: merged });
    setStatus(
      added === 0
        ? `Already in your library.`
        : `Imported ${label} (${added} chart${added === 1 ? "" : "s"}${skipped > 0 ? `, ${skipped} already had` : ""}).`,
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={post?.title ?? "Community chart"}
        className="flex max-h-[85dvh] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-2xl bg-surface p-5 text-left text-foreground shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        {post === undefined ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : post === null ? (
          <>
            <p className="text-sm text-muted">
              This post isn&apos;t available anymore — it may have been removed, or its author&apos;s
              profile is no longer public.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="self-end rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{post.title}</h2>
                {post.authorUsername && (
                  <Link
                    href={`/u/${post.authorUsername}`}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
                  >
                    <UserAvatar url={post.authorAvatarUrl} size="sm" />
                    {post.authorUsername}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => importSongs(post.songs, "all")}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                <DownloadIcon className="h-4 w-4" />
                Import all
              </button>
            </div>
            {post.description && <p className="text-sm text-muted">{post.description}</p>}
            {status && <p className="text-xs text-accent">{status}</p>}

            <ul className="flex-1 overflow-y-auto">
              {post.songs.map((song, i) => {
                const have = haveKeys.has(songKey(song));
                return (
                  <li key={i} className="border-t border-background first:border-t-0">
                    <div className="flex items-center gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
                      >
                        {song.title}
                        {song.composer && (
                          <span className="font-normal text-muted"> — {formatComposer(song.composer)}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => importSongs([song], song.title)}
                        disabled={have}
                        title={have ? "Already in your library" : "Import this chart"}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-background hover:text-foreground disabled:opacity-50"
                      >
                        {have ? <CheckIcon className="h-3.5 w-3.5" /> : <DownloadIcon className="h-3.5 w-3.5" />}
                        {have ? "Added" : "Import"}
                      </button>
                    </div>
                    {expanded === i && (
                      <div
                        className="mb-3 w-full max-w-full overflow-x-auto rounded-xl bg-background p-3"
                        style={{ containerType: "inline-size" }}
                      >
                        <ChordChart song={song} barsPerRow={4} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={onClose}
              className="self-end rounded-lg bg-background px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
