import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

const MAX_DISTINCT_PRODUCTS = 100;
const MAX_ITEM_QUANTITY = BigInt(99);

async function getOrCreateUserCart(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<Doc<"carts">> {
  const existing = await ctx.db
    .query("carts")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();

  if (existing) {
    return existing;
  }

  const cartId = await ctx.db.insert("carts", {
    userId,
    revision: 1,
  });

  return (await ctx.db.get(cartId))!;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!cart) {
      return {
        cartId: null,
        revision: 0,
        items: [],
        distinctCount: 0,
        subtotalPaise: BigInt(0),
      };
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
      .take(MAX_DISTINCT_PRODUCTS + 5);

    let subtotalPaise = BigInt(0);

    const items = await Promise.all(
      cartItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        const imageUrl = product?.imageId
          ? await ctx.storage.getUrl(product.imageId)
          : null;

        let available = true;
        let explanation: string | undefined = undefined;

        if (!product || product.archived) {
          available = false;
          explanation = "This item is no longer available.";
        } else if (product.stock <= BigInt(0)) {
          available = false;
          explanation = "Currently out of stock.";
        } else if (product.stock < item.quantity) {
          explanation = `Only ${product.stock} available in stock.`;
        }

        const lineTotalPaise =
          product && available ? product.pricePaise * item.quantity : BigInt(0);

        if (available && product) {
          subtotalPaise += lineTotalPaise;
        }

        return {
          cartItemId: item._id,
          productId: item.productId,
          quantity: item.quantity,
          name: product?.name ?? "Unavailable Product",
          slug: product?.slug ?? "",
          packLabel: product?.packLabel ?? "",
          pricePaise: product?.pricePaise ?? BigInt(0),
          stock: product?.stock ?? BigInt(0),
          archived: product?.archived ?? true,
          imageUrl,
          available,
          explanation,
          lineTotalPaise,
        };
      })
    );

    return {
      cartId: cart._id,
      revision: cart.revision,
      items,
      distinctCount: items.length,
      subtotalPaise,
    };
  },
});

export const addItem = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.int64(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.quantity <= BigInt(0)) {
      throw new Error("Quantity must be at least 1");
    }

    const product = await ctx.db.get(args.productId);
    if (!product || product.archived) {
      throw new Error("Product is no longer available");
    }

    const cart = await getOrCreateUserCart(ctx, user._id);

    const existingItem = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id_and_product_id", (q) =>
        q.eq("cartId", cart._id).eq("productId", args.productId)
      )
      .unique();

    if (existingItem) {
      const newQuantity = existingItem.quantity + args.quantity;
      if (newQuantity > MAX_ITEM_QUANTITY) {
        throw new Error(
          `Cannot exceed maximum limit of ${MAX_ITEM_QUANTITY} per item`
        );
      }
      await ctx.db.patch(existingItem._id, { quantity: newQuantity });
    } else {
      const existingItems = await ctx.db
        .query("cartItems")
        .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
        .take(MAX_DISTINCT_PRODUCTS + 1);

      if (existingItems.length >= MAX_DISTINCT_PRODUCTS) {
        throw new Error(
          `Cart limit of ${MAX_DISTINCT_PRODUCTS} distinct products reached`
        );
      }

      if (args.quantity > MAX_ITEM_QUANTITY) {
        throw new Error(
          `Cannot exceed maximum limit of ${MAX_ITEM_QUANTITY} per item`
        );
      }

      await ctx.db.insert("cartItems", {
        cartId: cart._id,
        productId: args.productId,
        quantity: args.quantity,
      });
    }

    const newRevision = cart.revision + 1;
    await ctx.db.patch(cart._id, { revision: newRevision });

    return {
      cartId: cart._id,
      revision: newRevision,
    };
  },
});

export const updateQuantity = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.int64(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cart = await getOrCreateUserCart(ctx, user._id);

    const existingItem = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id_and_product_id", (q) =>
        q.eq("cartId", cart._id).eq("productId", args.productId)
      )
      .unique();

    if (!existingItem) {
      throw new Error("Item not in cart");
    }

    if (args.quantity <= BigInt(0)) {
      await ctx.db.delete(existingItem._id);
    } else if (args.quantity > MAX_ITEM_QUANTITY) {
      throw new Error(
        `Cannot exceed maximum limit of ${MAX_ITEM_QUANTITY} per item`
      );
    } else {
      await ctx.db.patch(existingItem._id, { quantity: args.quantity });
    }

    const newRevision = cart.revision + 1;
    await ctx.db.patch(cart._id, { revision: newRevision });

    return {
      cartId: cart._id,
      revision: newRevision,
    };
  },
});

export const removeItem = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const cart = await getOrCreateUserCart(ctx, user._id);

    const existingItem = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id_and_product_id", (q) =>
        q.eq("cartId", cart._id).eq("productId", args.productId)
      )
      .unique();

    if (existingItem) {
      await ctx.db.delete(existingItem._id);
      const newRevision = cart.revision + 1;
      await ctx.db.patch(cart._id, { revision: newRevision });
      return {
        cartId: cart._id,
        revision: newRevision,
      };
    }

    return {
      cartId: cart._id,
      revision: cart.revision,
    };
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (cart) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
        .take(MAX_DISTINCT_PRODUCTS + 10);

      for (const item of items) {
        await ctx.db.delete(item._id);
      }

      const newRevision = cart.revision + 1;
      await ctx.db.patch(cart._id, { revision: newRevision });
      return {
        cartId: cart._id,
        revision: newRevision,
      };
    }

    return {
      cartId: null,
      revision: 0,
    };
  },
});

export const mergeGuestCart = mutation({
  args: {
    mergeKey: v.string(),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.int64(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const mergeKey = args.mergeKey.trim();
    if (!mergeKey) {
      throw new Error("Merge key is required for idempotency");
    }

    // Deduplicate merge retries
    const existingMerge = await ctx.db
      .query("cartMerges")
      .withIndex("by_user_id_and_key", (q) =>
        q.eq("userId", user._id).eq("key", mergeKey)
      )
      .unique();

    if (existingMerge) {
      return JSON.parse(existingMerge.result);
    }

    const cart = await getOrCreateUserCart(ctx, user._id);

    const currentItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
      .take(MAX_DISTINCT_PRODUCTS + 10);

    const currentItemMap = new Map<string, Doc<"cartItems">>(
      currentItems.map((item) => [item.productId, item])
    );

    const unavailableItems: Array<{
      productId: Id<"products">;
      name?: string;
      reason: string;
    }> = [];

    const adjustedItems: Array<{
      productId: Id<"products">;
      name: string;
      requestedQuantity: string;
      adjustedQuantity: string;
      reason: string;
    }> = [];

    for (const guestItem of args.items) {
      if (guestItem.quantity <= BigInt(0)) {
        continue;
      }

      const product = await ctx.db.get(guestItem.productId);
      if (!product || product.archived) {
        unavailableItems.push({
          productId: guestItem.productId,
          name: product?.name,
          reason: "Product is no longer available",
        });
        continue;
      }

      if (product.stock <= BigInt(0)) {
        unavailableItems.push({
          productId: guestItem.productId,
          name: product.name,
          reason: "Product is currently out of stock",
        });
        continue;
      }

      const existingCartItem = currentItemMap.get(guestItem.productId);

      if (existingCartItem) {
        // Additive merge
        const combined = existingCartItem.quantity + guestItem.quantity;
        let finalQty = combined;
        if (combined > MAX_ITEM_QUANTITY) {
          finalQty = MAX_ITEM_QUANTITY;
          adjustedItems.push({
            productId: guestItem.productId,
            name: product.name,
            requestedQuantity: combined.toString(),
            adjustedQuantity: MAX_ITEM_QUANTITY.toString(),
            reason: `Quantity capped at maximum limit of ${MAX_ITEM_QUANTITY}`,
          });
        }
        await ctx.db.patch(existingCartItem._id, { quantity: finalQty });
        currentItemMap.set(guestItem.productId, {
          ...existingCartItem,
          quantity: finalQty,
        });
      } else {
        if (currentItemMap.size >= MAX_DISTINCT_PRODUCTS) {
          unavailableItems.push({
            productId: guestItem.productId,
            name: product.name,
            reason: `Cart limit of ${MAX_DISTINCT_PRODUCTS} products reached`,
          });
          continue;
        }

        let finalQty = guestItem.quantity;
        if (guestItem.quantity > MAX_ITEM_QUANTITY) {
          finalQty = MAX_ITEM_QUANTITY;
          adjustedItems.push({
            productId: guestItem.productId,
            name: product.name,
            requestedQuantity: guestItem.quantity.toString(),
            adjustedQuantity: MAX_ITEM_QUANTITY.toString(),
            reason: `Quantity capped at maximum limit of ${MAX_ITEM_QUANTITY}`,
          });
        }

        const newId = await ctx.db.insert("cartItems", {
          cartId: cart._id,
          productId: guestItem.productId,
          quantity: finalQty,
        });

        currentItemMap.set(guestItem.productId, {
          _id: newId,
          _creationTime: Date.now(),
          cartId: cart._id,
          productId: guestItem.productId,
          quantity: finalQty,
        });
      }
    }

    const newRevision = cart.revision + 1;
    await ctx.db.patch(cart._id, { revision: newRevision });

    const result = {
      success: true,
      cartId: cart._id,
      revision: newRevision,
      mergedCount: args.items.length - unavailableItems.length,
      adjustedItems,
      unavailableItems,
    };

    await ctx.db.insert("cartMerges", {
      userId: user._id,
      key: mergeKey,
      result: JSON.stringify(result),
    });

    return result;
  },
});
