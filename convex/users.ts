import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./auth";
import { eventDecision } from "./identityPolicy";
import { DEFAULT_PAGE_LIMIT, MAX_ADMIN_PAGE_LIMIT } from "../lib/constants";

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
  args: {},
  returns: v.object({
    id: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("customer"), v.literal("admin")),
    suspended: v.optional(v.boolean()),
  }),
  handler: async ctx => {
    const user = await requireUser(ctx);
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role === "admin" ? ("admin" as const) : ("customer" as const),
      suspended: user.suspended ?? false,
    };
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

export const adminListCustomers = query({
  args: {
    search: v.optional(v.string()),
    suspended: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bound = Math.min(
      Math.max(args.limit ?? DEFAULT_PAGE_LIMIT, 1),
      MAX_ADMIN_PAGE_LIMIT
    );
    const allUsers = await ctx.db.query("users").order("desc").take(MAX_ADMIN_PAGE_LIMIT);
    const searchTerm = args.search?.trim().toLowerCase();

    let filtered = allUsers.filter((u) => u.deletedAt === undefined);
    if (args.suspended !== undefined) {
      filtered = filtered.filter((u) => (u.suspended ?? false) === args.suspended);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (u) =>
          (u.email && u.email.toLowerCase().includes(searchTerm)) ||
          (u.name && u.name.toLowerCase().includes(searchTerm)) ||
          (u.clerkUserId && u.clerkUserId.toLowerCase().includes(searchTerm))
      );
    }

    return filtered.slice(0, bound).map((u) => ({
      id: u._id,
      clerkUserId: u.clerkUserId,
      email: u.email,
      name: u.name,
      imageUrl: u.imageUrl,
      role: u.role === "admin" ? ("admin" as const) : ("customer" as const),
      suspended: u.suspended ?? false,
      createdAt: u.createdAt,
    }));
  },
});

export const adminListCustomersPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const paginated = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...paginated,
      page: paginated.page.map((u) => ({
        id: u._id,
        clerkUserId: u.clerkUserId,
        email: u.email,
        name: u.name,
        imageUrl: u.imageUrl,
        role: u.role === "admin" ? ("admin" as const) : ("customer" as const),
        suspended: u.suspended ?? false,
        createdAt: u.createdAt,
        deletedAt: u.deletedAt,
      })),
    };
  },
});

export const adminGetCustomer = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Customer not found");
    }

    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .collect();
        return {
          ...order,
          items: items.map((i) => i.item),
        };
      })
    );

    const rawNotes = await ctx.db
      .query("customerNotes")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    const notes = await Promise.all(
      rawNotes.map(async (note) => {
        const author = await ctx.db.get(note.authorId);
        return {
          ...note,
          author: author
            ? {
                id: author._id,
                name: author.name,
                email: author.email,
              }
            : null,
        };
      })
    );

    return {
      customer: {
        id: user._id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role === "admin" ? ("admin" as const) : ("customer" as const),
        suspended: user.suspended ?? false,
        createdAt: user.createdAt,
        deletedAt: user.deletedAt,
      },
      addresses,
      membership: membership
        ? {
            status: membership.status,
            paidThrough: membership.paidThrough,
            refreshedAt: membership.refreshedAt,
            refreshVersion: membership.refreshVersion,
          }
        : null,
      orders: ordersWithDetails,
      notes,
    };
  },
});

export const adminAddCustomerNote = mutation({
  args: {
    userId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Customer not found");
    }
    const trimmed = args.body.trim();
    if (!trimmed) {
      throw new Error("Note content cannot be empty.");
    }
    return await ctx.db.insert("customerNotes", {
      userId: args.userId,
      authorId: admin._id,
      body: trimmed,
    });
  },
});

export const adminListCustomerNotes = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Customer not found");
    }

    const notes = await ctx.db
      .query("customerNotes")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      notes.map(async (note) => {
        const author = await ctx.db.get(note.authorId);
        return {
          ...note,
          author: author
            ? {
                id: author._id,
                name: author.name,
                email: author.email,
              }
            : null,
        };
      })
    );
  },
});

export const adminSetCustomerSuspended = mutation({
  args: {
    userId: v.id("users"),
    suspended: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Customer not found");
    }
    if (targetUser.role === "admin") {
      throw new Error("Cannot suspend an administrator account.");
    }

    await ctx.db.patch("users", args.userId, {
      suspended: args.suspended,
    });

    if (args.reason?.trim()) {
      await ctx.db.insert("customerNotes", {
        userId: args.userId,
        authorId: admin._id,
        body: `[Status Change: ${args.suspended ? "Suspended" : "Reinstated"}] ${args.reason.trim()}`,
      });
    }

    return {
      userId: args.userId,
      suspended: args.suspended,
    };
  },
});
