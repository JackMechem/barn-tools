"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import PublicTuneList from "@/components/PublicTuneList";
import UserAvatar from "@/components/UserAvatar";
import { PlusIcon, TrashIcon } from "@/components/tools";
import { toPublicTune } from "@/lib/profileTunes";
import { Tune } from "@/lib/types";
import { useSyncedTunes } from "@/lib/useSyncedTunes";

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** The Community page's "Tunes" section (`Community.tsx`'s fourth view) — the tune-list sibling of
    `CommunityChordCharts.tsx`: browse tunes/tune lists other people have posted, post your own,
    and add anything you find into your own Tunes or Tunes to Learn list. Browsing only needs to be
    signed in; posting also needs the caller's own profile to be public, same split as the chord
    charts section. A post's tune list renders with `PublicTuneList` — the exact same component a
    public profile's own Tunes section uses — so "add"/"learn" here behaves identically (same
    dedupe-by-name check, same fresh-id copy, same two buttons) instead of a second copy of that
    logic. */
export default function CommunityTunes() {
  const profile = useQuery(api.profiles.getMine);
  const posts = useQuery(api.communityTunes.list);
  const removePost = useMutation(api.communityTunes.remove);
  const [myTunes] = useSyncedTunes();

  const [showCreate, setShowCreate] = useState(false);
  const [openPostId, setOpenPostId] = useState<Id<"communityTunes"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"communityTunes"> | null>(null);

  const canPost = profile?.isPublic === true;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">
          Tunes and tune lists other jackshed users have posted. Add one into your own Tunes, or
          your Tunes to Learn list.
        </p>
        {profile !== undefined &&
          (canPost ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              <PlusIcon className="h-4 w-4" />
              Post a tune
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
          Nobody&apos;s posted a tune yet — be the first.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-left">
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
                  {post.tuneCount} tune{post.tuneCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>

              <button
                type="button"
                onClick={() => setOpenPostId(post.id)}
                className="self-start rounded-lg bg-background px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
              >
                View &amp; add
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreatePostModal library={myTunes} onClose={() => setShowCreate(false)} />
      )}

      {openPostId && <PostDetailModal id={openPostId} onClose={() => setOpenPostId(null)} />}

      {deletingId && (
        <ConfirmDialog
          title="Delete this post?"
          message="This removes it from Community for everyone. It doesn't touch anyone who already added it."
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

/** The "post a tune" form — picks one or more tunes out of the caller's own Tunes list (nothing
    typed by hand here; you post what's already in your list) and snapshots them, notes stripped
    (`toPublicTune`), into a new Community post via `communityTunes.create`. */
function CreatePostModal({
  library,
  onClose,
}: {
  library: Tune[];
  onClose: () => void;
}) {
  const create = useMutation(api.communityTunes.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...library].sort((a, b) => a.name.localeCompare(b.name)),
    [library],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.name.toLowerCase().includes(q));
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
      setError("Pick at least one tune to post.");
      return;
    }
    setSubmitting(true);
    try {
      const tunes = library.filter((t) => selected.has(t.id)).map(toPublicTune);
      await create({ title: title.trim(), description: description.trim(), tunes });
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
        aria-label="Post a tune to Community"
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-surface p-5 text-left text-foreground shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Post to Community</h2>

        {library.length === 0 ? (
          <p className="text-sm text-muted">
            Your Tunes list is empty — add a tune in Jam Practice or the account Tunes tab first,
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
                placeholder="e.g. Bossa nova gig setlist"
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
              <span className="text-sm font-medium text-muted">
                Tunes to include ({selected.size} selected)
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your tunes…"
                className="rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
              <ul className="max-h-56 overflow-y-auto rounded-lg bg-background">
                {filtered.map((tune) => (
                  <li key={tune.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={selected.has(tune.id)}
                        onChange={() => toggle(tune.id)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="min-w-0 flex-1 truncate">{tune.name}</span>
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

/** A single post's full tune list, fetched lazily (`communityTunes.get`, only queried once this
    modal actually mounts) and rendered with `PublicTuneList` — the same read-only-plus-add/learn
    list a public profile's own Tunes section uses, so adding from a Community post behaves
    identically to adding from someone's profile page. */
function PostDetailModal({ id, onClose }: { id: Id<"communityTunes">; onClose: () => void }) {
  const post = useQuery(api.communityTunes.get, { id });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={post?.title ?? "Community tune list"}
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
            </div>
            {post.description && <p className="text-sm text-muted">{post.description}</p>}

            <div className="flex-1 overflow-y-auto">
              <PublicTuneList tunes={post.tunes} canAdd />
            </div>

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
