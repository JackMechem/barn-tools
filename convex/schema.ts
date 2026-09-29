import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Phase 1 (accounts only): the auth system's own tables (users, authAccounts, authSessions, ...)
// plus one app-specific table for email-gated confirmations (delete account, change/set
// password). The synced-data tables (tunes, chordCharts, trainerStats, trainerHistory) get added
// one at a time in their own phases, alongside the queries/mutations and UI that actually use
// them — see PROJECT.md and the plan this was built from.
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
});
