import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const bound = Math.min(Math.max(args.limit ?? 50, 1), 100);

    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(bound);

    return await Promise.all(
      favs.map(async (fav) => {
        const product = await ctx.db.get(fav.productId);
        const imageUrl = product?.imageId
          ? await ctx.storage.getUrl(product.imageId)
          : null;

        return {
          favoriteId: fav._id,
          productId: fav.productId,
          product: product
            ? {
                ...product,
                imageUrl,
              }
            : null,
        };
      })
    );
  },
});

export const isFavorite = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const fav = await ctx.db
      .query("favorites")
      .withIndex("by_user_id_and_product_id", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    return !!fav;
  },
});

export const add = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_id_and_product_id", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("favorites", {
        userId: user._id,
        productId: args.productId,
      });
    }

    return { isFavorite: true };
  },
});

export const remove = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_id_and_product_id", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { isFavorite: false };
  },
});

export const toggle = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_id_and_product_id", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { isFavorite: false };
    } else {
      await ctx.db.insert("favorites", {
        userId: user._id,
        productId: args.productId,
      });
      return { isFavorite: true };
    }
  },
});
