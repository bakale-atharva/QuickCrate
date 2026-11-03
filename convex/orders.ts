import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin, requireOwner, requireUser } from "./auth";
import { orderStatusValidator } from "./schema";
import { Doc, Id } from "./_generated/dataModel";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../lib/constants";

export function getPermittedOrderTransitions(status: string): string[] {
  switch (status) {
    case "placed":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["packing", "cancelled"];
    case "packing":
      return ["out_for_delivery", "cancelled"];
    case "out_for_delivery":
      return ["delivered"];
    case "delivered":
    case "cancelled":
    default:
      return [];
  }
}

export const findOrderByUserAndKey = internalQuery({
  args: {
    userId: v.id("users"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"orders"> | null> => {
    return await ctx.db
      .query("orders")
      .withIndex("by_user_id_and_idempotency_key", (q) =>
        q.eq("userId", args.userId).eq("idempotencyKey", args.idempotencyKey)
      )
      .unique();
  },
});

export const executePlaceOrder = internalMutation({
  args: {
    quoteId: v.id("checkoutQuotes"),
    idempotencyKey: v.string(),
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    orderId: Id<"orders">;
    status: string;
    alreadyPlaced: boolean;
  }> => {
    // 1. Re-check idempotency inside transaction
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_user_id_and_idempotency_key", (q) =>
        q.eq("userId", args.userId).eq("idempotencyKey", args.idempotencyKey)
      )
      .unique();

    if (existing) {
      return {
        orderId: existing._id,
        status: existing.status,
        alreadyPlaced: true,
      };
    }

    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined) {
      throw new Error("Active user not found");
    }
    if (user.suspended) {
      throw new Error("Ordering is suspended for this account.");
    }

    // 2. Validate quote
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.userId !== args.userId) {
      throw new Error("Invalid or unowned checkout quote.");
    }

    if (Date.now() > quote.expiresAt) {
      throw new Error("Checkout quote has expired. Please review and request a new quote.");
    }

    // 3. Validate cart revision
    const cart = await ctx.db.get(quote.cartId);
    if (!cart || cart.revision !== quote.cartRevision) {
      throw new Error("Cart contents changed. Please review and request a new quote.");
    }

    // 4. Validate stock and price consistency for every item
    for (const item of quote.items) {
      const product = await ctx.db.get(item.productId);
      if (!product || product.archived) {
        throw new Error(
          `Product "${item.name}" is no longer available. Please update your cart.`
        );
      }
      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${item.name}". Available: ${product.stock}, requested: ${item.quantity}.`
        );
      }
      if (product.pricePaise !== item.unitPricePaise) {
        throw new Error(
          `Price for "${item.name}" changed. Please review and request a new quote.`
        );
      }
    }

    // 5. Calculate subtotal and totals
    let subtotalPaise = BigInt(0);
    for (const item of quote.items) {
      subtotalPaise += item.unitPricePaise * item.quantity;
    }
    const deliveryFeePaise = quote.deliveryFeePaise;
    const totalPaise = subtotalPaise + deliveryFeePaise;

    // 6. Create order
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      quoteId: args.quoteId,
      idempotencyKey: args.idempotencyKey,
      status: "placed",
      address: quote.address,
      subtotalPaise,
      deliveryFeePaise,
      totalPaise,
      codCollected: false,
    });

    // 7. Deduct inventory and record stock movements & order items
    for (const item of quote.items) {
      const product = (await ctx.db.get(item.productId))!;
      const resultingStock = product.stock - item.quantity;

      await ctx.db.patch("products", product._id, {
        stock: resultingStock,
      });

      await ctx.db.insert("stockMovements", {
        productId: product._id,
        quantityDelta: -item.quantity,
        resultingStock,
        actorId: args.userId,
        reason: "order_placed",
        orderId,
      });

      await ctx.db.insert("orderItems", {
        orderId,
        item,
      });
    }

    // 8. Record initial order event
    await ctx.db.insert("orderEvents", {
      orderId,
      status: "placed",
      actorId: args.userId,
      note: "Order placed via Cash on Delivery (COD)",
    });

    // 9. Clear matching cart and bump revision
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
      .collect();

    for (const ci of cartItems) {
      await ctx.db.delete(ci._id);
    }

    await ctx.db.patch("carts", cart._id, {
      revision: cart.revision + 1,
    });

    return {
      orderId,
      status: "placed",
      alreadyPlaced: false,
    };
  },
});

export const cancel = mutation({
  args: {
    orderId: v.id("orders"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      throw new Error(`Cannot cancel order in terminal status "${order.status}".`);
    }

    const isAdmin = actor.role === "admin";

    if (!isAdmin) {
      requireOwner(actor._id, order);
      if (order.status !== "placed") {
        throw new Error("Customers can only cancel orders in 'placed' status.");
      }
    } else {
      if (
        order.status !== "placed" &&
        order.status !== "confirmed" &&
        order.status !== "packing"
      ) {
        throw new Error("Orders cannot be cancelled after dispatch.");
      }
    }

    // Exactly-once restocking for each order item
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const itemDoc of items) {
      const product = await ctx.db.get(itemDoc.item.productId);
      if (product) {
        const resultingStock = product.stock + itemDoc.item.quantity;
        await ctx.db.patch("products", product._id, {
          stock: resultingStock,
        });

        await ctx.db.insert("stockMovements", {
          productId: product._id,
          quantityDelta: itemDoc.item.quantity,
          resultingStock,
          actorId: actor._id,
          reason: "order_cancelled",
          orderId: order._id,
        });
      }
    }

    await ctx.db.patch("orders", order._id, {
      status: "cancelled",
    });

    await ctx.db.insert("orderEvents", {
      orderId: order._id,
      status: "cancelled",
      actorId: actor._id,
      note:
        args.note ??
        (isAdmin ? "Order cancelled by administrator" : "Order cancelled by customer"),
    });

    return {
      orderId: order._id,
      status: "cancelled",
    };
  },
});

export const adminUpdateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: orderStatusValidator,
    codCollected: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      throw new Error("Terminal states cannot transition again.");
    }

    if (args.status === "cancelled") {
      if (
        order.status !== "placed" &&
        order.status !== "confirmed" &&
        order.status !== "packing"
      ) {
        throw new Error("Orders cannot be cancelled after dispatch.");
      }

      // Restock
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
        .collect();

      for (const itemDoc of items) {
        const product = await ctx.db.get(itemDoc.item.productId);
        if (product) {
          const resultingStock = product.stock + itemDoc.item.quantity;
          await ctx.db.patch("products", product._id, {
            stock: resultingStock,
          });

          await ctx.db.insert("stockMovements", {
            productId: product._id,
            quantityDelta: itemDoc.item.quantity,
            resultingStock,
            actorId: actor._id,
            reason: "order_cancelled",
            orderId: order._id,
          });
        }
      }

      await ctx.db.patch("orders", order._id, {
        status: "cancelled",
      });

      await ctx.db.insert("orderEvents", {
        orderId: order._id,
        status: "cancelled",
        actorId: actor._id,
        note: args.note ?? "Order cancelled by administrator",
      });

      return {
        orderId: order._id,
        status: "cancelled",
      };
    }

    // Forward lifecycle validation: placed -> confirmed -> packing -> out_for_delivery -> delivered
    const allowedTransitions: Record<string, string[]> = {
      placed: ["confirmed"],
      confirmed: ["packing"],
      packing: ["out_for_delivery"],
      out_for_delivery: ["delivered"],
    };

    const nextAllowed = allowedTransitions[order.status] ?? [];
    if (!nextAllowed.includes(args.status)) {
      throw new Error(
        `Invalid status transition from "${order.status}" to "${args.status}".`
      );
    }

    if (args.status === "delivered") {
      if (!args.codCollected) {
        throw new Error("Delivery requires confirming COD collection.");
      }
      await ctx.db.patch("orders", order._id, {
        status: "delivered",
        codCollected: true,
      });
    } else {
      await ctx.db.patch("orders", order._id, {
        status: args.status,
      });
    }

    await ctx.db.insert("orderEvents", {
      orderId: order._id,
      status: args.status,
      actorId: actor._id,
      note: args.note,
    });

    return {
      orderId: order._id,
      status: args.status,
    };
  },
});

export const getMyOrders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const bound = Math.min(Math.max(args.limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(bound);

    return await Promise.all(
      orders.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .collect();
        const events = await ctx.db
          .query("orderEvents")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .order("desc")
          .collect();

        return {
          ...order,
          items: items.map((i) => i.item),
          events,
        };
      })
    );
  },
});

export const getMyOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const order = requireOwner(user._id, await ctx.db.get(args.orderId));

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .collect();

    const events = await ctx.db
      .query("orderEvents")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .collect();

    return {
      ...order,
      items: items.map((i) => i.item),
      events,
    };
  },
});

export const adminGetOrder = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const customer = await ctx.db.get(order.userId);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .collect();

    const rawEvents = await ctx.db
      .query("orderEvents")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .collect();

    const events = await Promise.all(
      rawEvents.map(async (event) => {
        const actor = await ctx.db.get(event.actorId);
        return {
          ...event,
          actor: actor
            ? {
                id: actor._id,
                name: actor.name,
                email: actor.email,
                role: actor.role ?? "customer",
              }
            : null,
        };
      })
    );

    return {
      ...order,
      customer: customer
        ? {
            id: customer._id,
            email: customer.email,
            name: customer.name,
            clerkUserId: customer.clerkUserId,
            suspended: customer.suspended ?? false,
          }
        : null,
      items: items.map((i) => i.item),
      events,
      permittedTransitions: getPermittedOrderTransitions(order.status),
    };
  },
});

export const adminGetOrderHistory = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const events = await ctx.db
      .query("orderEvents")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .order("asc")
      .collect();

    return await Promise.all(
      events.map(async (event) => {
        const actor = await ctx.db.get(event.actorId);
        return {
          ...event,
          actor: actor
            ? {
                id: actor._id,
                name: actor.name,
                email: actor.email,
                role: actor.role ?? "customer",
              }
            : null,
        };
      })
    );
  },
});

export const adminGetPermittedTransitions = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    return getPermittedOrderTransitions(order.status);
  },
});

export const adminListOrders = query({
  args: {
    status: v.optional(orderStatusValidator),
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const bound = Math.min(Math.max(args.limit ?? DEFAULT_PAGE_LIMIT, 1), MAX_PAGE_LIMIT);

    let orders;
    if (args.status) {
      const statusFilter = args.status;
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", statusFilter))
        .order("desc")
        .take(bound);
    } else if (args.userId) {
      const userFilter = args.userId;
      orders = await ctx.db
        .query("orders")
        .withIndex("by_user_id", (q) => q.eq("userId", userFilter))
        .order("desc")
        .take(bound);
    } else {
      orders = await ctx.db.query("orders").order("desc").take(bound);
    }

    return await Promise.all(
      orders.map(async (order) => {
        const customer = await ctx.db.get(order.userId);
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .collect();

        return {
          ...order,
          customer: customer
            ? {
                id: customer._id,
                email: customer.email,
                name: customer.name,
                clerkUserId: customer.clerkUserId,
                suspended: customer.suspended ?? false,
              }
            : null,
          items: items.map((i) => i.item),
          permittedTransitions: getPermittedOrderTransitions(order.status),
        };
      })
    );
  },
});

export const adminListOrdersPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let paginatedOrders;
    if (args.status) {
      const statusFilter = args.status;
      paginatedOrders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", statusFilter))
        .order("desc")
        .paginate(args.paginationOpts);
    } else if (args.userId) {
      const userFilter = args.userId;
      paginatedOrders = await ctx.db
        .query("orders")
        .withIndex("by_user_id", (q) => q.eq("userId", userFilter))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      paginatedOrders = await ctx.db
        .query("orders")
        .order("desc")
        .paginate(args.paginationOpts);
    }

    const pageWithDetails = await Promise.all(
      paginatedOrders.page.map(async (order) => {
        const customer = await ctx.db.get(order.userId);
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order_id", (q) => q.eq("orderId", order._id))
          .collect();

        return {
          ...order,
          customer: customer
            ? {
                id: customer._id,
                email: customer.email,
                name: customer.name,
                clerkUserId: customer.clerkUserId,
                suspended: customer.suspended ?? false,
              }
            : null,
          items: items.map((i) => i.item),
          permittedTransitions: getPermittedOrderTransitions(order.status),
        };
      })
    );

    return {
      ...paginatedOrders,
      page: pageWithDetails,
    };
  },
});
