import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

async function validateStorageImage(ctx: MutationCtx, imageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", imageId);
  if (!metadata) {
    throw new Error("Referenced storage image does not exist");
  }
  if (metadata.contentType && !metadata.contentType.startsWith("image/")) {
    throw new Error("Storage object is not an image");
  }
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {
    categoryId: v.optional(v.id("categories")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bound = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const products = args.categoryId
      ? await ctx.db
          .query("products")
          .withIndex("by_category_id_and_archived", (q) =>
            q.eq("categoryId", args.categoryId!).eq("archived", false)
          )
          .take(bound)
      : await ctx.db
          .query("products")
          .withIndex("by_archived", (q) => q.eq("archived", false))
          .take(bound);

    return await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const imageUrl = p.imageId ? await ctx.storage.getUrl(p.imageId) : null;
        return {
          ...p,
          imageUrl,
          categoryName: category?.name ?? "",
        };
      })
    );
  },
});

export const search = query({
  args: {
    query: v.string(),
    categoryId: v.optional(v.id("categories")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.query.trim();
    if (!trimmed) {
      return [];
    }

    const bound = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const products = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) => {
        let builder = q.search("name", trimmed).eq("archived", false);
        if (args.categoryId) {
          builder = builder.eq("categoryId", args.categoryId);
        }
        return builder;
      })
      .take(bound);

    return await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const imageUrl = p.imageId ? await ctx.storage.getUrl(p.imageId) : null;
        return {
          ...p,
          imageUrl,
          categoryName: category?.name ?? "",
        };
      })
    );
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!product || product.archived) {
      return null;
    }

    const category = await ctx.db.get(product.categoryId);
    const imageUrl = product.imageId ? await ctx.storage.getUrl(product.imageId) : null;

    return {
      ...product,
      imageUrl,
      categoryName: category?.name ?? "",
    };
  },
});

export const getById = query({
  args: {
    id: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product || product.archived) {
      return null;
    }

    const category = await ctx.db.get(product.categoryId);
    const imageUrl = product.imageId ? await ctx.storage.getUrl(product.imageId) : null;

    return {
      ...product,
      imageUrl,
      categoryName: category?.name ?? "",
    };
  },
});

export const adminList = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bound = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const products = await ctx.db.query("products").order("desc").take(bound);

    return await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const imageUrl = p.imageId ? await ctx.storage.getUrl(p.imageId) : null;
        return {
          ...p,
          imageUrl,
          categoryName: category?.name ?? "",
        };
      })
    );
  },
});

export const adminGetById = query({
  args: {
    id: v.id("products"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) {
      return null;
    }

    const category = await ctx.db.get(product.categoryId);
    const imageUrl = product.imageId ? await ctx.storage.getUrl(product.imageId) : null;

    return {
      ...product,
      imageUrl,
      categoryName: category?.name ?? "",
    };
  },
});

export const getStockMovements = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bound = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_product_id", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(bound);

    return await Promise.all(
      movements.map(async (m) => {
        const actor = await ctx.db.get(m.actorId);
        return {
          ...m,
          actorName: actor?.name ?? actor?.email ?? "System",
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    sku: v.string(),
    description: v.string(),
    packLabel: v.string(),
    pricePaise: v.int64(),
    initialStock: v.int64(),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Product name is required");
    }

    const slug = normalizeSlug(args.slug);
    if (!slug) {
      throw new Error("Valid product slug is required");
    }

    const sku = normalizeSku(args.sku);
    if (!sku) {
      throw new Error("Valid product SKU is required");
    }

    const description = args.description.trim();
    const packLabel = args.packLabel.trim();
    if (!packLabel) {
      throw new Error("Pack label is required (e.g. 500g, 1 kg, Pack of 6)");
    }

    if (args.pricePaise < BigInt(0)) {
      throw new Error("Price cannot be negative");
    }

    if (args.initialStock < BigInt(0)) {
      throw new Error("Initial stock cannot be negative");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const existingSlug = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existingSlug) {
      throw new Error(`Product slug "${slug}" is already in use`);
    }

    const existingSku = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", sku))
      .unique();
    if (existingSku) {
      throw new Error(`Product SKU "${sku}" is already in use`);
    }

    if (args.imageId) {
      await validateStorageImage(ctx, args.imageId);
    }

    const productId = await ctx.db.insert("products", {
      categoryId: args.categoryId,
      name,
      slug,
      sku,
      description,
      packLabel,
      pricePaise: args.pricePaise,
      stock: args.initialStock,
      archived: false,
      imageId: args.imageId,
    });

    if (args.initialStock > BigInt(0)) {
      await ctx.db.insert("stockMovements", {
        productId,
        quantityDelta: args.initialStock,
        resultingStock: args.initialStock,
        actorId: admin._id,
        reason: "Initial inventory setup",
      });
    }

    return productId;
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    categoryId: v.optional(v.id("categories")),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    sku: v.optional(v.string()),
    description: v.optional(v.string()),
    packLabel: v.optional(v.string()),
    pricePaise: v.optional(v.int64()),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }

    const updates: {
      categoryId?: Id<"categories">;
      name?: string;
      slug?: string;
      sku?: string;
      description?: string;
      packLabel?: string;
      pricePaise?: bigint;
      imageId?: Id<"_storage">;
    } = {};

    if (args.categoryId !== undefined) {
      const category = await ctx.db.get(args.categoryId);
      if (!category) {
        throw new Error("Category not found");
      }
      updates.categoryId = args.categoryId;
    }

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        throw new Error("Product name cannot be empty");
      }
      updates.name = trimmed;
    }

    if (args.slug !== undefined) {
      const slug = normalizeSlug(args.slug);
      if (!slug) {
        throw new Error("Valid product slug is required");
      }
      if (slug !== product.slug) {
        const existing = await ctx.db
          .query("products")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
        if (existing && existing._id !== product._id) {
          throw new Error(`Product slug "${slug}" is already in use`);
        }
        updates.slug = slug;
      }
    }

    if (args.sku !== undefined) {
      const sku = normalizeSku(args.sku);
      if (!sku) {
        throw new Error("Valid product SKU is required");
      }
      if (sku !== product.sku) {
        const existing = await ctx.db
          .query("products")
          .withIndex("by_sku", (q) => q.eq("sku", sku))
          .unique();
        if (existing && existing._id !== product._id) {
          throw new Error(`Product SKU "${sku}" is already in use`);
        }
        updates.sku = sku;
      }
    }

    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }

    if (args.packLabel !== undefined) {
      const packLabel = args.packLabel.trim();
      if (!packLabel) {
        throw new Error("Pack label cannot be empty");
      }
      updates.packLabel = packLabel;
    }

    if (args.pricePaise !== undefined) {
      if (args.pricePaise < BigInt(0)) {
        throw new Error("Price cannot be negative");
      }
      updates.pricePaise = args.pricePaise;
    }

    if (args.imageId !== undefined) {
      await validateStorageImage(ctx, args.imageId);
      updates.imageId = args.imageId;
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const archive = mutation({
  args: {
    id: v.id("products"),
    archived: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    await ctx.db.patch(args.id, { archived: args.archived });
    return null;
  },
});

export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    expectedStock: v.int64(),
    quantityDelta: v.int64(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.stock !== args.expectedStock) {
      throw new Error(
        `Stock conflict: Current stock is ${product.stock}, but expected ${args.expectedStock}. Please refresh to see latest inventory.`
      );
    }

    const resultingStock = product.stock + args.quantityDelta;
    if (resultingStock < BigInt(0)) {
      throw new Error(
        `Resulting stock cannot be negative (current stock: ${product.stock}, adjustment delta: ${args.quantityDelta})`
      );
    }

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("Reason for stock adjustment is required");
    }

    await ctx.db.patch(product._id, { stock: resultingStock });

    await ctx.db.insert("stockMovements", {
      productId: product._id,
      quantityDelta: args.quantityDelta,
      resultingStock,
      actorId: admin._id,
      reason,
    });

    return {
      previousStock: product.stock,
      resultingStock,
    };
  },
});
