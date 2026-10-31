import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const addressValidator = v.object({
  fullName: v.string(), line1: v.string(), line2: v.optional(v.string()),
  city: v.string(), region: v.string(), postalCode: v.string(), country: v.string(), phone: v.optional(v.string()),
});
export const orderStatusValidator = v.union(v.literal("placed"), v.literal("confirmed"), v.literal("packing"), v.literal("out_for_delivery"), v.literal("delivered"), v.literal("cancelled"));
const snapshot = v.object({ productId: v.id("products"), name: v.string(), sku: v.string(), packLabel: v.string(), unitPricePaise: v.int64(), quantity: v.int64() });

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(), email: v.string(), name: v.optional(v.string()), imageUrl: v.optional(v.string()),
    role: v.optional(v.literal("admin")), address: v.optional(addressValidator), createdAt: v.number(),
    tokenIdentifier: v.optional(v.string()), lastEventAt: v.optional(v.number()), lastProfileUpdatedAt: v.optional(v.number()), deletedAt: v.optional(v.number()), suspended: v.optional(v.boolean()),
  }).index("by_clerk_user_id", ["clerkUserId"]).index("by_token_identifier", ["tokenIdentifier"]),
  addresses: defineTable({ userId: v.id("users"), address: addressValidator, isDefault: v.boolean() }).index("by_user_id", ["userId"]),
  categories: defineTable({ name: v.string(), slug: v.string(), archived: v.boolean() }).index("by_slug", ["slug"]).index("by_archived", ["archived"]),
  products: defineTable({ categoryId: v.id("categories"), name: v.string(), slug: v.string(), sku: v.string(), description: v.string(), packLabel: v.string(), pricePaise: v.int64(), stock: v.int64(), archived: v.boolean(), imageId: v.optional(v.id("_storage")) })
    .index("by_slug", ["slug"]).index("by_sku", ["sku"]).index("by_category_id_and_archived", ["categoryId", "archived"]).index("by_archived", ["archived"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["archived", "categoryId"] }),
  stockMovements: defineTable({ productId: v.id("products"), quantityDelta: v.int64(), resultingStock: v.int64(), actorId: v.id("users"), reason: v.string(), orderId: v.optional(v.id("orders")) }).index("by_product_id", ["productId"]).index("by_order_id", ["orderId"]),
  carts: defineTable({ userId: v.id("users"), revision: v.number() }).index("by_user_id", ["userId"]),
  cartItems: defineTable({ cartId: v.id("carts"), productId: v.id("products"), quantity: v.int64() }).index("by_cart_id", ["cartId"]).index("by_cart_id_and_product_id", ["cartId", "productId"]),
  cartMerges: defineTable({ userId: v.id("users"), key: v.string(), result: v.string() }).index("by_user_id_and_key", ["userId", "key"]),
  favorites: defineTable({ userId: v.id("users"), productId: v.id("products") }).index("by_user_id", ["userId"]).index("by_user_id_and_product_id", ["userId", "productId"]),
  checkoutQuotes: defineTable({ userId: v.id("users"), cartId: v.id("carts"), cartRevision: v.number(), address: addressValidator, items: v.array(snapshot), deliveryFeePaise: v.int64(), totalPaise: v.int64(), membershipEligible: v.boolean(), expiresAt: v.number() }).index("by_user_id", ["userId"]),
  orders: defineTable({ userId: v.id("users"), quoteId: v.id("checkoutQuotes"), idempotencyKey: v.string(), status: orderStatusValidator, address: addressValidator, subtotalPaise: v.int64(), deliveryFeePaise: v.int64(), totalPaise: v.int64(), codCollected: v.boolean() }).index("by_user_id", ["userId"]).index("by_user_id_and_idempotency_key", ["userId", "idempotencyKey"]).index("by_status", ["status"]),
  orderItems: defineTable({ orderId: v.id("orders"), item: snapshot }).index("by_order_id", ["orderId"]),
  orderEvents: defineTable({ orderId: v.id("orders"), status: orderStatusValidator, actorId: v.id("users"), note: v.optional(v.string()) }).index("by_order_id", ["orderId"]),
  memberships: defineTable({ userId: v.id("users"), status: v.string(), paidThrough: v.optional(v.number()), refreshedAt: v.number(), refreshVersion: v.number() }).index("by_user_id", ["userId"]),
  webhookReceipts: defineTable({ provider: v.string(), eventId: v.string(), receivedAt: v.number() }).index("by_provider_and_event_id", ["provider", "eventId"]),
  customerNotes: defineTable({ userId: v.id("users"), authorId: v.id("users"), body: v.string() }).index("by_user_id", ["userId"]),
});
