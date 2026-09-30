"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FollowButton from "@/components/FollowButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import PublicTuneList from "@/components/PublicTuneList";
import UserAvatar from "@/components/UserAvatar";

/** A public profile page (`app/u/[username]/page.tsx`) — reachable by anyone, signed in or not;
    this is the shareable link. `getPublicByUsername` returns `null` for both "no such username"
    and "that profile exists but isn't public", deliberately indistinguishable from here — a
    visitor can't tell the difference by probing usernames. "Tunes" and "Tunes to Learn" are two
    separate sections, both rendered with `PublicTuneList` (the same Jam-Practice-styled row layout
    for both — see that component for why one component covers both), which also lets a signed-in
    viewer copy a tune they see into their own lists. */
export default function PublicProfilePage({ username }: { username: string }) {
  const profile = useQuery(api.profiles.getPublicByUsername, { username });
  const viewer = useQuery(api.users.current);

  if (profile === undefined || viewer === undefined) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16">
        <LoadingSpinner />
      </main>
    );
  }

  if (profile === null) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-2 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] text-center sm:px-6 lg:pt-16">
        <h1 className="text-xl font-semibold">This profile isn&apos;t available</h1>
        <p className="text-sm text-muted">
          It might not exist, or its owner hasn&apos;t made it public.
        </p>
      </main>
    );
  }

  const isOwnProfile = viewer?._id === profile.userId;
  const canAdd = !isOwnProfile && !!viewer;
  const hasNothing =
    profile.instruments.length === 0 &&
    profile.tunes.length === 0 &&
    profile.tunesToLearn.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-16 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:px-6 lg:pt-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <UserAvatar url={profile.avatarUrl} size="xl" />
        <h1 className="text-2xl font-bold text-accent">{profile.username}</h1>
        {!isOwnProfile && viewer && (
          <FollowButton targetUserId={profile.userId as Id<"users">} />
        )}
        {!isOwnProfile && !viewer && (
          <p className="text-xs text-muted">
            <Link href="/" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to follow {profile.username}.
          </p>
        )}
      </div>

      {profile.instruments.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl bg-surface p-5 text-left">
          <h2 className="text-sm font-semibold text-muted">Instruments</h2>
          <div className="flex flex-wrap gap-2">
            {profile.instruments.map((name) => (
              <span
                key={name}
                className="rounded-full bg-background px-3 py-1 text-xs font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.tunes.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl bg-surface p-5 text-left">
          <h2 className="text-sm font-semibold text-muted">Tunes</h2>
          <PublicTuneList tunes={profile.tunes} canAdd={canAdd} />
        </section>
      )}

      {profile.tunesToLearn.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl bg-surface p-5 text-left">
          <h2 className="text-sm font-semibold text-muted">Tunes to Learn</h2>
          <PublicTuneList tunes={profile.tunesToLearn} canAdd={canAdd} />
        </section>
      )}

      {hasNothing && (
        <p className="text-center text-sm text-muted">
          {profile.username} hasn&apos;t added any instruments or tunes yet.
        </p>
      )}
    </main>
  );
}
