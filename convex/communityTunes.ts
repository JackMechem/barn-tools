import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import type { PublicTune } from "../lib/profileTunes";

const MAX_TUNES_PER_POST = 300;
const MAX_LIST = 60;

async function authorProfile(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (!userId) return null;
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** Posts a tune (one) or a whole tune list (several) to Community — a snapshot of `PublicTune[]`
    already stripped of `notes` client-side (`lib/profileTunes.ts`'s `toPublicTune`), not a live
    reference to the poster's own Tunes list. Same public-profile requirement as
    `communityChordCharts.create`, for the same reason. */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    tunes: v.array(v.any()),
  },
  handler: async (ctx, { title, description, tunes }) => {
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
    if (tunes.length === 0) throw new Error("Pick at least one tune to post.");
    if (tunes.length > MAX_TUNES_PER_POST) {
      throw new Error(
        `Posts are limited to ${MAX_TUNES_PER_POST} tunes — split a bigger list into more than one post.`,
      );
    }
    await ctx.db.insert("communityTunes", {
      userId,
      title: trimmedTitle,
      description: description.trim(),
      tunes,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("communityTunes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in.");
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error("Post not found.");
    await ctx.db.delete(id);
  },
});

/** The browse list — every post, newest first, metadata only (title, description, tune count,
    the author's *current* username/avatar), not each post's full tune data — see
    `communityChordCharts.list`'s own comment for the identical reasoning. Requires being signed
    in; browsing doesn't need a public profile of your own, only posting does. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("communityTunes")
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
        tuneCount: Array.isArray(row.tunes) ? row.tunes.length : 0,
        createdAt: row.createdAt,
        authorUsername: profile.username,
        authorAvatarUrl: avatarUrl,
        isMine: row.userId === userId,
      });
    }
    return results;
  },
});

/** One post's full tune list, fetched only once it's actually opened — `null` if the post doesn't
    exist, or its author's profile isn't currently public, same as `communityChordCharts.get`. */
export const get = query({
  args: { id: v.id("communityTunes") },
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
      tunes: row.tunes as PublicTune[],
      createdAt: row.createdAt,
      authorUsername: profile.username,
      authorAvatarUrl: avatarUrl,
      isMine: row.userId === userId,
    };
  },
});
