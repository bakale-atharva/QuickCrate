import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireActiveUser, requireAdmin as assertAdmin } from "./identityPolicy";

type Context = QueryCtx | MutationCtx;

export async function requireUser(ctx: Context) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  const user = await ctx.db.query("users").withIndex("by_clerk_user_id", q => q.eq("clerkUserId", identity.subject)).unique();
  const active = requireActiveUser(user);
  if (active.tokenIdentifier && active.tokenIdentifier !== identity.tokenIdentifier) throw new Error("Unauthorized");
  return active;
}

export async function requireAdmin(ctx: Context) {
  return assertAdmin(await requireUser(ctx));
}

export function requireOwner<T extends { userId: string }>(userId: string, document: T | null): T {
  if (!document || document.userId !== userId) throw new Error("Forbidden");
  return document;
}
