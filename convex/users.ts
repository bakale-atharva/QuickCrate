import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import { eventDecision } from "./identityPolicy";

export const initialize = mutation({
  args: {}, returns: v.id("users"),
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const existing = await ctx.db.query("users").withIndex("by_clerk_user_id", q => q.eq("clerkUserId", identity.subject)).unique();
    if (existing) {
      if (existing.deletedAt !== undefined || (existing.tokenIdentifier && existing.tokenIdentifier !== identity.tokenIdentifier)) throw new Error("Unauthorized");
      if (!existing.tokenIdentifier) await ctx.db.patch("users", existing._id, { tokenIdentifier: identity.tokenIdentifier });
      return existing._id;
    }
    return await ctx.db.insert("users", { clerkUserId: identity.subject, tokenIdentifier: identity.tokenIdentifier, email: identity.email ?? "", name: identity.name, imageUrl: identity.pictureUrl, createdAt: Date.now() });
  },
});

export const me = query({
  args: {}, returns: v.object({ id: v.id("users"), email: v.string(), name: v.optional(v.string()), role: v.union(v.literal("customer"), v.literal("admin")) }),
  handler: async ctx => {
    const user = await requireUser(ctx);
    return { id: user._id, email: user.email, name: user.name, role: user.role === "admin" ? "admin" as const : "customer" as const };
  },
});

// Invoked only by a trusted operator through the Convex CLI/dashboard.
export const bootstrapAdmin = internalMutation({
  args: { clerkUserId: v.string() }, returns: v.null(),
  handler: async (ctx, { clerkUserId }) => {
    if (!clerkUserId.trim()) throw new Error("Clerk user ID is required");
    const user = await ctx.db.query("users").withIndex("by_clerk_user_id", q => q.eq("clerkUserId", clerkUserId)).unique();
    if (!user || user.deletedAt !== undefined) throw new Error("Active user not found");
    await ctx.db.patch("users", user._id, { role: "admin" });
    return null;
  },
});

export const applyClerkEvent = internalMutation({
  args: { eventId: v.string(), type: v.union(v.literal("user.created"), v.literal("user.updated"), v.literal("user.deleted")), timestamp: v.number(), updatedAt: v.optional(v.number()), clerkUserId: v.string(), email: v.optional(v.string()), name: v.optional(v.string()), imageUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const receipt = await ctx.db.query("webhookReceipts").withIndex("by_provider_and_event_id", q => q.eq("provider", "clerk").eq("eventId", args.eventId)).unique();
    if (receipt) return null;
    const user = await ctx.db.query("users").withIndex("by_clerk_user_id", q => q.eq("clerkUserId", args.clerkUserId)).unique();
    const decision = eventDecision(user, args.type, args.timestamp, args.updatedAt);
    if (decision === "delete") {
      if (user) await ctx.db.patch("users", user._id, { email: "", name: undefined, imageUrl: undefined, address: undefined, role: undefined, deletedAt: args.timestamp, lastEventAt: args.timestamp });
      else await ctx.db.insert("users", { clerkUserId: args.clerkUserId, email: "", createdAt: Date.now(), deletedAt: args.timestamp, lastEventAt: args.timestamp });
    } else if (decision === "upsert") {
      const profile = { email: args.email ?? "", name: args.name, imageUrl: args.imageUrl, lastEventAt: args.timestamp, lastProfileUpdatedAt: args.updatedAt };
      if (user) await ctx.db.patch("users", user._id, profile);
      else await ctx.db.insert("users", { clerkUserId: args.clerkUserId, createdAt: Date.now(), ...profile });
    }
    await ctx.db.insert("webhookReceipts", { provider: "clerk", eventId: args.eventId, receivedAt: Date.now() });
    return null;
  },
});
