import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bound = Math.min(Math.max(args.limit ?? 100, 1), 100);
    return await ctx.db
      .query("categories")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .take(bound);
  },
});

export const listAllAdmin = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bound = Math.min(Math.max(args.limit ?? 100, 1), 200);
    return await ctx.db.query("categories").order("desc").take(bound);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!category || category.archived) {
      return null;
    }
    return category;
  },
});

export const getById = query({
  args: {
    id: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id);
    if (!category || category.archived) {
      return null;
    }
    return category;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Category name is required");
    }
    const slug = normalizeSlug(args.slug);
    if (!slug) {
      throw new Error("Valid category slug is required");
    }

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      throw new Error(`Category slug "${slug}" is already taken`);
    }

    return await ctx.db.insert("categories", {
      name: trimmedName,
      slug,
      archived: false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new Error("Category not found");
    }

    const updates: {
      name?: string;
      slug?: string;
      archived?: boolean;
    } = {};

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        throw new Error("Category name cannot be empty");
      }
      updates.name = trimmed;
    }

    if (args.slug !== undefined) {
      const slug = normalizeSlug(args.slug);
      if (!slug) {
        throw new Error("Valid category slug is required");
      }
      if (slug !== category.slug) {
        const existing = await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
        if (existing && existing._id !== category._id) {
          throw new Error(`Category slug "${slug}" is already taken`);
        }
        updates.slug = slug;
      }
    }

    if (args.archived !== undefined) {
      updates.archived = args.archived;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const archive = mutation({
  args: {
    id: v.id("categories"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(args.id);
    if (!category) {
      throw new Error("Category not found");
    }
    await ctx.db.patch(args.id, { archived: args.archived });
    return null;
  },
});
