import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { addressValidator } from "./schema";
import { cleanAddress } from "./addresses";
import { requireOwner, requireUser } from "./auth";
import { DELIVERY_FEE_PAISE, MAX_ADDRESSES_PER_USER, QUOTE_TTL_MS } from "../lib/constants";
import { Doc, Id } from "./_generated/dataModel";

const snapshotValidator = v.object({
  productId: v.id("products"),
  name: v.string(),
  sku: v.string(),
  packLabel: v.string(),
  unitPricePaise: v.int64(),
  quantity: v.int64(),
});

type QuoteAddress = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string;
};

type QuoteItemSnapshot = {
  productId: Id<"products">;
  name: string;
  sku: string;
  packLabel: string;
  unitPricePaise: bigint;
  quantity: bigint;
};

export const prepareQuoteData = internalMutation({
  args: {
    addressId: v.optional(v.id("addresses")),
    address: v.optional(addressValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userId: Id<"users">;
    cartId: Id<"carts">;
    cartRevision: number;
    address: QuoteAddress;
    items: QuoteItemSnapshot[];
    subtotalPaise: bigint;
  }> => {
    const user = await requireUser(ctx);

    // Resolve address
    let finalAddress: QuoteAddress;

    if (args.addressId) {
      const addrDoc = await ctx.db.get(args.addressId);
      const owned = requireOwner(user._id, addrDoc);
      finalAddress = cleanAddress(owned.address);
    } else if (args.address) {
      finalAddress = cleanAddress(args.address);
    } else {
      const addresses = await ctx.db
        .query("addresses")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(MAX_ADDRESSES_PER_USER);
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (!defaultAddr) {
        throw new Error("Shipping address is required to generate a checkout quote.");
      }
      finalAddress = cleanAddress(defaultAddr.address);
    }

    // Get user cart
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!cart) {
      throw new Error("Cart is empty. Please add items before checking out.");
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_id", (q) => q.eq("cartId", cart._id))
      .collect();

    if (cartItems.length === 0) {
      throw new Error("Cart is empty. Please add items before checking out.");
    }

    let subtotalPaise = BigInt(0);
    const itemSnapshots: QuoteItemSnapshot[] = [];

    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (!product || product.archived) {
        throw new Error(
          `Product "${product?.name ?? "Item"}" is no longer available. Please update your cart.`
        );
      }
      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, in cart: ${item.quantity}.`
        );
      }

      itemSnapshots.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        packLabel: product.packLabel,
        unitPricePaise: product.pricePaise,
        quantity: item.quantity,
      });

      subtotalPaise += product.pricePaise * item.quantity;
    }

    return {
      userId: user._id,
      cartId: cart._id,
      cartRevision: cart.revision,
      address: finalAddress,
      items: itemSnapshots,
      subtotalPaise,
    };
  },
});

export const persistQuote = internalMutation({
  args: {
    userId: v.id("users"),
    cartId: v.id("carts"),
    cartRevision: v.number(),
    address: addressValidator,
    items: v.array(snapshotValidator),
    deliveryFeePaise: v.int64(),
    totalPaise: v.int64(),
    membershipEligible: v.boolean(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"checkoutQuotes">> => {
    return await ctx.db.insert("checkoutQuotes", {
      userId: args.userId,
      cartId: args.cartId,
      cartRevision: args.cartRevision,
      address: args.address,
      items: args.items,
      deliveryFeePaise: args.deliveryFeePaise,
      totalPaise: args.totalPaise,
      membershipEligible: args.membershipEligible,
      expiresAt: args.expiresAt,
    });
  },
});

export const validateQuoteBeforePlacement = internalQuery({
  args: {
    userId: v.id("users"),
    quoteId: v.id("checkoutQuotes"),
  },
  handler: async (ctx, args): Promise<Doc<"checkoutQuotes">> => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.userId !== args.userId) {
      throw new Error("Invalid checkout quote.");
    }

    if (Date.now() > quote.expiresAt) {
      throw new Error("Checkout quote has expired. Please review and request a new quote.");
    }

    const cart = await ctx.db.get(quote.cartId);
    if (!cart || cart.revision !== quote.cartRevision) {
      throw new Error("Cart contents changed. Please review and request a new quote.");
    }

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

    return quote;
  },
});

export const quote = action({
  args: {
    addressId: v.optional(v.id("addresses")),
    address: v.optional(addressValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    quoteId: Id<"checkoutQuotes">;
    cartId: Id<"carts">;
    cartRevision: number;
    address: QuoteAddress;
    items: QuoteItemSnapshot[];
    subtotalPaise: bigint;
    deliveryFeePaise: bigint;
    totalPaise: bigint;
    membershipEligible: boolean;
    expiresAt: number;
  }> => {
    const prepData: {
      userId: Id<"users">;
      cartId: Id<"carts">;
      cartRevision: number;
      address: QuoteAddress;
      items: QuoteItemSnapshot[];
      subtotalPaise: bigint;
    } = await ctx.runMutation(internal.checkout.prepareQuoteData, {
      addressId: args.addressId,
      address: args.address,
    });

    // Refresh membership authoritatively from Clerk Backend
    const membership: {
      status: string;
      paidThrough?: number;
      eligible: boolean;
      fenced: boolean;
    } = await ctx.runAction(
      internal.memberships.refreshAuthoritativeMembership,
      {
        userId: prepData.userId,
      }
    );

    const deliveryFeePaise = membership.eligible
      ? BigInt(0)
      : DELIVERY_FEE_PAISE;
    const totalPaise = prepData.subtotalPaise + deliveryFeePaise;
    const expiresAt = Date.now() + QUOTE_TTL_MS;

    const quoteId: Id<"checkoutQuotes"> = await ctx.runMutation(
      internal.checkout.persistQuote,
      {
        userId: prepData.userId,
        cartId: prepData.cartId,
        cartRevision: prepData.cartRevision,
        address: prepData.address,
        items: prepData.items,
        deliveryFeePaise,
        totalPaise,
        membershipEligible: membership.eligible,
        expiresAt,
      }
    );

    return {
      quoteId,
      cartId: prepData.cartId,
      cartRevision: prepData.cartRevision,
      address: prepData.address,
      items: prepData.items,
      subtotalPaise: prepData.subtotalPaise,
      deliveryFeePaise,
      totalPaise,
      membershipEligible: membership.eligible,
      expiresAt,
    };
  },
});

export const placeOrder = action({
  args: {
    quoteId: v.id("checkoutQuotes"),
    idempotencyKey: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    orderId: Id<"orders">;
    status: string;
    alreadyPlaced: boolean;
  }> => {
    const trimmedKey = args.idempotencyKey.trim();
    if (!trimmedKey) {
      throw new Error("Idempotency key is required.");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.memberships.getUserByClerkId,
      {
        clerkUserId: identity.subject,
      }
    );

    if (!user || user.deletedAt !== undefined) {
      throw new Error("Active user not found");
    }

    // Step 1: Before contacting Clerk, check for an existing order using customer and idempotencyKey
    const existingOrder: Doc<"orders"> | null = await ctx.runQuery(
      internal.orders.findOrderByUserAndKey,
      {
        userId: user._id,
        idempotencyKey: trimmedKey,
      }
    );

    if (existingOrder) {
      return {
        orderId: existingOrder._id,
        status: existingOrder.status,
        alreadyPlaced: true,
      };
    }

    // Step 2: Validate quote consistency before contacting Clerk
    const quoteDoc: Doc<"checkoutQuotes"> = await ctx.runQuery(
      internal.checkout.validateQuoteBeforePlacement,
      {
        userId: user._id,
        quoteId: args.quoteId,
      }
    );

    // Step 3: Refresh membership at submission
    const membership: {
      status: string;
      paidThrough?: number;
      eligible: boolean;
      fenced: boolean;
    } = await ctx.runAction(
      internal.memberships.refreshAuthoritativeMembership,
      {
        userId: user._id,
      }
    );

    if (membership.eligible !== quoteDoc.membershipEligible) {
      throw new Error(
        "Membership eligibility changed affecting delivery fee. Please review updated quote."
      );
    }

    // Step 4: Atomically place order, deduct stock, log audit event, and clear cart
    const placementResult: {
      orderId: Id<"orders">;
      status: string;
      alreadyPlaced: boolean;
    } = await ctx.runMutation(internal.orders.executePlaceOrder, {
      quoteId: args.quoteId,
      idempotencyKey: trimmedKey,
      userId: user._id,
    });

    return placementResult;
  },
});

export const getQuote = query({
  args: {
    quoteId: v.id("checkoutQuotes"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const quoteDoc = await ctx.db.get(args.quoteId);
    return requireOwner(user._id, quoteDoc);
  },
});
