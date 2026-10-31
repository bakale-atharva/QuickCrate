import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const addressValidator = v.object({
  fullName: v.string(),
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  region: v.string(),
  postalCode: v.string(),
  country: v.string(),
  phone: v.optional(v.string()),
});

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.optional(v.literal("admin")),
    address: v.optional(addressValidator),
    createdAt: v.number(),
  }).index("by_clerk_user_id", ["clerkUserId"]),
});
