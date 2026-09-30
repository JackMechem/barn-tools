import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  /** A code emailed to confirm a sensitive account action before it actually happens — see
      `convex/account.ts`'s `request*`/`confirm*` action pairs. One row per `(userId, kind)`; a
      fresh request replaces any existing pending one for that same kind (no stacking multiple
      live codes). Stores a SHA-256 hash of the code, not the code itself. */
  pendingConfirmations: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("deleteAccount"), v.literal("password")),
    codeHash: v.string(),
    expiresAt: v.number(),
  }).index("by_user_kind", ["userId", "kind"]),

  /** One saved Practice Timer session per row (mirrors `lib/practiceTimer.ts`'s `PracticeSession`
      union, minus its own `id` — the Convex document id is the id once synced). Signed-in-only:
      when signed out, the exact same shape lives client-side in localStorage instead
      (`lib/practiceSessionsStore.ts`) — see `lib/usePracticeSessions.ts`, which switches between
      the two with no merge, per Jack's call: signing in reads the account's data only, local data
      already on the device is simply not consulted. */
  practiceSessions: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(v.literal("custom"), v.literal("pomodoro")),
    segments: v.optional(
      v.array(v.object({ id: v.string(), title: v.string(), minutes: v.number() })),
    ),
    pomodoro: v.optional(
      v.object({
        workMinutes: v.number(),
        shortBreakMinutes: v.number(),
        longBreakMinutes: v.number(),
        workTitles: v.array(v.string()),
        cyclesBeforeLongBreak: v.number(),
        totalCycles: v.union(v.number(), v.null()),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Generic account-wide sync for every other tool's settings — one row per `(userId, key)`,
      `value` holding that tool's *entire* localStorage-equivalent settings object, JSON-stringified
      whole. Deliberately not a hand-typed table per tool: nearly every tool component already
      round-trips its own settings object through `JSON.stringify`/`JSON.parse` for
      `usePersistedSettings` (`lib/usePersistedSettings.ts`), so it's already guaranteed
      JSON-safe — storing it as one opaque blob here means a new tool, or a new field on an
      existing tool's settings, never needs a matching schema change on this side. `key` is each
      tool's own existing localStorage key string, reused as-is (e.g.
      `"jam-practice-note-trainer"`, `"jam-practice-metronome"`), so there's exactly one obvious
      `key` per synced call site, not a second naming scheme to keep in sync alongside it.
      `lib/useSyncedSettings.ts` is the one hook every synced tool's settings go through — same
      no-merge rule as
      `practiceSessions` above: signed out reads/writes localStorage only (unchanged,
      zero-risk — it's still the exact same `usePersistedSettings` code underneath), signed in
      reads/writes this table only, and whatever's already in localStorage on that device is
      simply never consulted once signed in. Reused as-is (same table, no schema change) for
      `lib/useSyncedTunes.ts` (Jam Practice's tune list — not itself a `usePersistedSettings`
      object, but the exact same "one JSON blob per key" shape fits it too) under the fixed key
      `"tunes"`. */
  syncedSettings: defineTable({
    userId: v.id("users"),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_user_key", ["userId", "key"]),

  /** A user's public-facing profile — this app's first data that's ever visible to anyone other
      than its own owner. `username` is always lowercased before storing (one field, no separate
      display-case, so "@JohnSmith" and "@johnsmith" can't read as two different things) and has
      nothing to do with how you sign in — a separate identity you opt into. `instruments` is
      deliberately free text, not `lib/instruments.ts`'s `INSTRUMENTS` catalog (that list is
      range-specific for the note trainers — six different "Keyboard — N Key" entries, nothing for
      Drums/Voice — a bad semantic fit for "what do you play"; see `lib/profileInstruments.ts`'s
      `COMMON_INSTRUMENTS` for the autocomplete-only suggestion list). A public profile's tune
      lists (`convex/profiles.ts`'s `getPublicByUsername`) aren't stored here at all — they're
      *every* tune in the owner's own `"tunes"`/`"tunesToLearn"` `syncedSettings` rows, resolved
      live at read time, not a curated subset; see that function's own comment for why there's
      nothing to pick here. None of this is visible to anyone while `isPublic` is false — see
      `convex/profiles.ts` for exactly which queries require that flag.
      `knownTuneIds` is a deprecated, no-longer-written leftover from an earlier design (a curated
      subset of tunes to show, picked by hand) — kept `optional` rather than removed so existing
      rows that still have it don't fail schema validation; new code never reads or writes it. */
  profiles: defineTable({
    userId: v.id("users"),
    username: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    instruments: v.array(v.string()),
    knownTuneIds: v.optional(v.array(v.string())),
    isPublic: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_username", ["username"]),

  /** One row per follow relationship — `followerId` follows `followingId`. `by_pair` is what
      `convex/follows.ts`'s `follow` mutation checks first to stay idempotent (never inserts a
      second row for the same pair). Both Following and Followers show on a profile
      (`by_follower`/`by_following` respectively), gated the same way the rest of a profile is:
      always visible for your own account, otherwise only if that profile is `isPublic` — a
      private profile's social graph stays private too, not just its tune list. */
  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),

  /** A chord chart, or a whole chord-chart playlist, posted to the Community page for any
      signed-in account to browse and import — this app's first user-generated content beyond a
      profile itself. `songs` is a *snapshot* taken at post time (the same `IRealSong[]` shape
      `lib/iRealPro.ts` produces and `ChordCharts.tsx`'s own library stores), not a live reference
      to the poster's library — editing or clearing your own library afterward doesn't change or
      break what you already posted, same reasoning as a public profile's tune-copy being a
      snapshot (`lib/profileTunes.ts`). Stored as `v.any()` rather than a hand-typed validator
      matching `IRealSong`/`Bar`'s full discriminated-union shape (chord slots, repeat bars,
      endings, directives, ...) — the same "opaque JSON blob" call already made for
      `syncedSettings` above, for the same reason: a change to that shape shouldn't also need a
      matching schema migration here. Posting requires the caller's *own* profile to be
      `isPublic` (checked in `convex/communityChordCharts.ts`'s `create`, not enforced by the
      schema) — browsing/importing only requires being signed in, not a public profile of your
      own. A post is filtered out of every read once its author's profile isn't (or is no longer)
      public, mirroring every other privacy rule in this app. */
  communityChordCharts: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    songs: v.any(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_createdAt", ["createdAt"]),

  /** The tune-list analog of `communityChordCharts` above — one post per row, `tunes` a snapshot
      of `PublicTune[]` (`lib/profileTunes.ts` — name/tempos/keys/time signature, never `notes`)
      taken from the poster's own Tunes list at post time, not a live reference to it. Same
      `v.any()` call as `communityChordCharts.songs` and the same reasoning: `PublicTune[]` is
      already a stable, hand-typed shape, but storing it as an opaque blob still means a future
      field added to it doesn't also need a schema migration here. Same posting/browsing rules too
      (`convex/communityTunes.ts`): posting needs the caller's own profile to be `isPublic`,
      browsing just needs to be signed in, and a post is dropped from every read once its author's
      profile isn't (or is no longer) public. */
  communityTunes: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    tunes: v.any(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_createdAt", ["createdAt"]),
});
