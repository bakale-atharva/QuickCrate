import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser } from "./auth";
import { addressValidator } from "./schema";

function cleanAddress(addr: {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string;
}) {
  const fullName = addr.fullName.trim();
  const line1 = addr.line1.trim();
  const city = addr.city.trim();
  const region = addr.region.trim();
  const postalCode = addr.postalCode.trim();
  const country = addr.country.trim();

  if (!fullName || !line1 || !city || !region || !postalCode || !country) {
    throw new Error(
      "Full name, address line 1, city, region, postal code, and country are required."
    );
  }

  return {
    fullName,
    line1,
    line2: addr.line2?.trim() || undefined,
    city,
    region,
    postalCode,
    country,
    phone: addr.phone?.trim() || undefined,
  };
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const bound = Math.min(Math.max(args.limit ?? 50, 1), 50);

    return await ctx.db
      .query("addresses")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(bound);
  },
});

export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(50);

    const defaultAddr = addresses.find((a) => a.isDefault);
    return defaultAddr ?? (addresses.length > 0 ? addresses[0] : null);
  },
});

export const getById = query({
  args: {
    id: v.id("addresses"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const addressDoc = await ctx.db.get(args.id);
    return requireOwner(user._id, addressDoc);
  },
});

export const create = mutation({
  args: {
    address: addressValidator,
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const sanitizedAddress = cleanAddress(args.address);

    const existingAddresses = await ctx.db
      .query("addresses")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(50);

    // If first address or explicitly marked default, it becomes the default
    const isDefault = existingAddresses.length === 0 || !!args.isDefault;

    if (isDefault) {
      for (const existing of existingAddresses) {
        if (existing.isDefault) {
          await ctx.db.patch(existing._id, { isDefault: false });
        }
      }
    }

    return await ctx.db.insert("addresses", {
      userId: user._id,
      address: sanitizedAddress,
      isDefault,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("addresses"),
    address: v.optional(addressValidator),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const addressDoc = await ctx.db.get(args.id);
    requireOwner(user._id, addressDoc);

    const updates: {
      address?: typeof args.address;
      isDefault?: boolean;
    } = {};

    if (args.address !== undefined) {
      updates.address = cleanAddress(args.address);
    }

    if (args.isDefault !== undefined) {
      if (args.isDefault) {
        // Set all other addresses for this user to not default
        const existingAddresses = await ctx.db
          .query("addresses")
          .withIndex("by_user_id", (q) => q.eq("userId", user._id))
          .take(50);

        for (const existing of existingAddresses) {
          if (existing._id !== args.id && existing.isDefault) {
            await ctx.db.patch(existing._id, { isDefault: false });
          }
        }
        updates.isDefault = true;
      } else {
        // If unsetting default, make another address default if available
        if (addressDoc!.isDefault) {
          const otherAddresses = await ctx.db
            .query("addresses")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .take(50);

          const candidate = otherAddresses.find((a) => a._id !== args.id);
          if (candidate) {
            await ctx.db.patch(candidate._id, { isDefault: true });
            updates.isDefault = false;
          } else {
            // Cannot unset default if it is the only address
            updates.isDefault = true;
          }
        }
      }
    }

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const deleteAddress = mutation({
  args: {
    id: v.id("addresses"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const addressDoc = await ctx.db.get(args.id);
    requireOwner(user._id, addressDoc);

    const wasDefault = addressDoc!.isDefault;
    await ctx.db.delete(args.id);

    if (wasDefault) {
      const remaining = await ctx.db
        .query("addresses")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .take(1);

      if (remaining.length > 0) {
        await ctx.db.patch(remaining[0]._id, { isDefault: true });
      }
    }

    return null;
  },
});

export const setDefault = mutation({
  args: {
    id: v.id("addresses"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const addressDoc = await ctx.db.get(args.id);
    requireOwner(user._id, addressDoc);

    const existingAddresses = await ctx.db
      .query("addresses")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .take(50);

    for (const existing of existingAddresses) {
      const isTarget = existing._id === args.id;
      if (existing.isDefault !== isTarget) {
        await ctx.db.patch(existing._id, { isDefault: isTarget });
      }
    }

    return null;
  },
});
