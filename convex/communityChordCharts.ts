import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import type { IRealSong } from "../lib/iRealPro";

const MAX_SONGS_PER_POST = 100;
const MAX_LIST = 60;

async function authorProfile(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (!userId) return null;
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** Posts a chord chart (one song) or a whole playlist (several) to Community — a snapshot of
    whatever `songs` the caller already has in their own Chord Charts library, not a live
    reference to it (see the schema's own comment on why). Requires the caller's own profile to
    be `isPublic` — posting under a private/nonexistent profile would put content out in the
    world with no author page anyone could actually find, the same reasoning `list`/`get` below
    apply symmetrically when reading. */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    songs: v.array(v.any()),
  },
  handler: async (ctx, { title, description, songs }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const profile = await authorProfile(ctx, userId);
    if (!profile?.isPublic) {
      throw new Error(
        "Make your profile public (Account → Public Profile) before posting to Community.",
      );
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error("Give this post a title.");
    if (songs.length === 0) throw new Error("Pick at least one chart to post.");
    if (songs.length > MAX_SONGS_PER_POST) {
      throw new Error(
        `Posts are limited to ${MAX_SONGS_PER_POST} charts — split a bigger playlist into more than one post.`,
      );
    }
    await ctx.db.insert("communityChordCharts", {
      userId,
      title: trimmedTitle,
      description: description.trim(),
      songs,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("communityChordCharts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Post not found.");
    await ctx.db.delete(id);
  },
});

/** The browse list — every post, newest first, with just enough to render a row (title,
    description, song count, the author's *current* username/avatar) rather than each post's full
    chart data, which `get` below fetches on demand only once something's actually opened.
    Requires being signed in — any account, not necessarily a public profile of your own (that's
    only required to post, not to browse — see `create`). A post whose author's profile isn't (or
    is no longer) public is left out, same privacy rule as every other cross-user read in this
    app. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("communityChordCharts")
      .withIndex("by_createdAt")
      .order("desc")
      .take(MAX_LIST);
    const results = [];
    for (const row of rows) {
      const profile = await authorProfile(ctx, row.userId);
      if (!profile?.isPublic) continue;
      const avatarUrl = profile.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : null;
      results.push({
        id: row._id,
        title: row.title,
        description: row.description,
        songCount: Array.isArray(row.songs) ? row.songs.length : 0,
        createdAt: row.createdAt,
        authorUsername: profile.username,
        authorAvatarUrl: avatarUrl,
        isMine: row.userId === userId,
      });
    }
    return results;
  },
});

/** One post's full content (every song, in full — title/composer/key/bars, everything
    `ChordChart.tsx` needs to render it), fetched only once something's actually opened rather
    than as part of `list` above. Same signed-in-required / author-still-public rules as `list`;
    `null` for a post that doesn't exist, or whose author isn't currently public, so a viewer
    can't distinguish those two by probing ids. */
export const get = query({
  args: { id: v.id("communityChordCharts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db.get(id);
    if (!row) return null;
    const profile = await authorProfile(ctx, row.userId);
    if (!profile?.isPublic) return null;
    const avatarUrl = profile.avatarStorageId
      ? await ctx.storage.getUrl(profile.avatarStorageId)
      : null;
    return {
      id: row._id,
      title: row.title,
      description: row.description,
      songs: row.songs as IRealSong[],
      createdAt: row.createdAt,
      authorUsername: profile.username,
      authorAvatarUrl: avatarUrl,
      isMine: row.userId === userId,
    };
  },
});
