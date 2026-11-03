import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { createClerkClient } from "@clerk/backend";
import { requireUser } from "./auth";
import { MEMBERSHIP_PLAN_SLUG, MEMBERSHIP_FEATURE_SLUG } from "../lib/constants";
import { Doc } from "./_generated/dataModel";

type SubscriptionFeature = {
  slug?: string;
};

type SubscriptionItem = {
  status?: string;
  periodEnd?: number | string;
  period_end?: number | string;
  plan?: {
    slug?: string;
    features?: (string | SubscriptionFeature)[];
  };
};

type BillingSubscriptionResponse = {
  status?: string;
  subscriptionItems?: SubscriptionItem[];
};

export function isMembershipActiveAndEligible(
  status: string,
  paidThrough?: number,
  now: number = Date.now()
): boolean {
  if (status === "active") {
    return true;
  }
  if (
    (status === "canceled" || status === "cancelled") &&
    paidThrough !== undefined &&
    paidThrough > now
  ) {
    return true;
  }
  return false;
}

export const getMyMembership = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    if (!membership) {
      return {
        status: "none",
        paidThrough: undefined,
        eligible: false,
        refreshedAt: 0,
      };
    }

    return {
      status: membership.status,
      paidThrough: membership.paidThrough,
      eligible: isMembershipActiveAndEligible(
        membership.status,
        membership.paidThrough
      ),
      refreshedAt: membership.refreshedAt,
    };
  },
});

export const recordWebhookReceipt = internalMutation({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args): Promise<{ isDuplicate: boolean }> => {
    const existing = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_provider_and_event_id", (q) =>
        q.eq("provider", "clerk").eq("eventId", args.eventId)
      )
      .unique();

    if (existing) {
      return { isDuplicate: true };
    }

    await ctx.db.insert("webhookReceipts", {
      provider: "clerk",
      eventId: args.eventId,
      receivedAt: Date.now(),
    });

    return { isDuplicate: false };
  },
});

export const applyMembershipUpdate = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.string(),
    paidThrough: v.optional(v.number()),
    refreshedAt: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    status: string;
    paidThrough?: number;
    eligible: boolean;
    fenced: boolean;
  }> => {
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    // Fence overlapping refreshes: ignore older refreshedAt timestamps
    if (existing && existing.refreshedAt > args.refreshedAt) {
      return {
        status: existing.status,
        paidThrough: existing.paidThrough,
        eligible: isMembershipActiveAndEligible(
          existing.status,
          existing.paidThrough
        ),
        fenced: true,
      };
    }

    const refreshVersion = (existing?.refreshVersion ?? 0) + 1;

    if (existing) {
      await ctx.db.patch("memberships", existing._id, {
        status: args.status,
        paidThrough: args.paidThrough,
        refreshedAt: args.refreshedAt,
        refreshVersion,
      });
    } else {
      await ctx.db.insert("memberships", {
        userId: args.userId,
        status: args.status,
        paidThrough: args.paidThrough,
        refreshedAt: args.refreshedAt,
        refreshVersion: 1,
      });
    }

    return {
      status: args.status,
      paidThrough: args.paidThrough,
      eligible: isMembershipActiveAndEligible(
        args.status,
        args.paidThrough,
        args.refreshedAt
      ),
      fenced: false,
    };
  },
});

export const getUserForRefresh = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByClerkId = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

export const refreshAuthoritativeMembership = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    status: string;
    paidThrough?: number;
    eligible: boolean;
    fenced: boolean;
  }> => {
    const refreshedAt = Date.now();
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.memberships.getUserForRefresh,
      {
        userId: args.userId,
      }
    );

    if (!user || !user.clerkUserId) {
      throw new Error("Active user not found");
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Clerk secret key is not configured");
    }

    const clerk = createClerkClient({ secretKey });
    let subscription: BillingSubscriptionResponse | null = null;

    try {
      subscription = (await clerk.billing.getUserBillingSubscription(
        user.clerkUserId
      )) as unknown as BillingSubscriptionResponse;
    } catch (err: unknown) {
      const clerkErr = err as {
        status?: number;
        code?: string;
        message?: string;
        errors?: Array<{ code?: string }>;
      };

      // 404 or resource_not_found means user has no subscription in Clerk
      const isNotFound =
        clerkErr?.status === 404 ||
        clerkErr?.code === "resource_not_found" ||
        clerkErr?.errors?.[0]?.code === "resource_not_found" ||
        (typeof clerkErr?.message === "string" &&
          clerkErr.message.toLowerCase().includes("not found"));

      if (!isNotFound) {
        // Verification outages produce retryable errors rather than silently charging delivery
        throw new Error(
          `Membership verification failed due to external outage: ${clerkErr?.message ?? "Unknown error"}`
        );
      }
    }

    let status = "none";
    let paidThrough: number | undefined = undefined;

    if (subscription) {
      const items = subscription.subscriptionItems || [];
      const item =
        items.find(
          (i) =>
            i.plan?.slug === MEMBERSHIP_PLAN_SLUG ||
            i.plan?.features?.some(
              (f) =>
                f === MEMBERSHIP_FEATURE_SLUG ||
                (typeof f === "object" && f.slug === MEMBERSHIP_FEATURE_SLUG)
            )
        ) || items[0];

      if (item) {
        status = item.status ?? subscription.status ?? "none";
        const rawPeriodEnd = item.periodEnd ?? item.period_end;
        if (rawPeriodEnd) {
          paidThrough =
            typeof rawPeriodEnd === "number"
              ? rawPeriodEnd
              : new Date(rawPeriodEnd).getTime();
        }
      } else if (subscription.status) {
        status = subscription.status;
      }
    }

    const result: {
      status: string;
      paidThrough?: number;
      eligible: boolean;
      fenced: boolean;
    } = await ctx.runMutation(internal.memberships.applyMembershipUpdate, {
      userId: args.userId,
      status,
      paidThrough,
      refreshedAt,
    });

    return result;
  },
});

export const handleBillingWebhook = internalAction({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.memberships.getUserByClerkId,
      { clerkUserId: args.clerkUserId }
    );
    if (!user) {
      return null;
    }
    await ctx.runAction(internal.memberships.refreshAuthoritativeMembership, {
      userId: user._id,
    });
    return null;
  },
});

// Lets the signed-in customer pull their membership from Clerk right after a
// subscription change, without waiting for the billing webhook.
export const refreshMine = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{ status: string; paidThrough?: number; eligible: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.memberships.getUserByClerkId,
      { clerkUserId: identity.subject }
    );
    if (!user || user.deletedAt !== undefined) {
      throw new Error("Active user not found");
    }
    const result: {
      status: string;
      paidThrough?: number;
      eligible: boolean;
      fenced: boolean;
    } = await ctx.runAction(internal.memberships.refreshAuthoritativeMembership, {
      userId: user._id,
    });
    return {
      status: result.status,
      paidThrough: result.paidThrough,
      eligible: result.eligible,
    };
  },
});
