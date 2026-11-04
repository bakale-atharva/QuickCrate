/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { clerkBilling } from "./test.clerkMock";

// Files with more than one dot (like this one) are skipped by the Convex
// bundler, so test-only code never deploys.
export const modules = import.meta.glob("./**/*.ts");

export const ISSUER = "https://test.clerk.accounts.dev";

export const ADDRESS = {
  fullName: "Asha Rao",
  line1: "12 MG Road",
  city: "Bengaluru",
  region: "Karnataka",
  postalCode: "560001",
  country: "IN",
};

export function setupBackend() {
  return convexTest(schema, modules);
}

export type TestBackend = ReturnType<typeof setupBackend>;

export function identityFor(t: TestBackend, clerkUserId: string) {
  return t.withIdentity({
    issuer: ISSUER,
    subject: clerkUserId,
    tokenIdentifier: `${ISSUER}|${clerkUserId}`,
    email: `${clerkUserId}@example.test`,
    name: clerkUserId,
  });
}

export async function signUp(t: TestBackend, clerkUserId: string) {
  const as = identityFor(t, clerkUserId);
  const userId = await as.mutation(api.users.initialize, {});
  return { as, userId, clerkUserId };
}

export type Account = Awaited<ReturnType<typeof signUp>>;

export async function signUpAdmin(t: TestBackend, clerkUserId = "user_admin") {
  const account = await signUp(t, clerkUserId);
  await t.mutation(internal.users.bootstrapAdmin, { clerkUserId });
  return account;
}

let productCounter = 0;

export async function createProduct(
  admin: Account,
  options: { stock: number; pricePaise?: number; name?: string } = { stock: 10 }
): Promise<Id<"products">> {
  productCounter += 1;
  const slug = `qa-category-${productCounter}`;
  const categoryId = await admin.as.mutation(api.categories.create, {
    name: `QA Category ${productCounter}`,
    slug,
  });
  return await admin.as.mutation(api.products.create, {
    categoryId,
    name: options.name ?? `QA Product ${productCounter}`,
    slug: `qa-product-${productCounter}`,
    sku: `QA-${productCounter}`,
    description: "Test product",
    packLabel: "500 g",
    pricePaise: BigInt(options.pricePaise ?? 10000),
    initialStock: BigInt(options.stock),
  });
}

/** Adds items to the customer's cart and saves a default address. */
export async function fillCart(
  customer: Account,
  productId: Id<"products">,
  quantity: number
) {
  await customer.as.mutation(api.cart.addItem, {
    productId,
    quantity: BigInt(quantity),
  });
  const addresses = await customer.as.query(api.addresses.list, {});
  if (addresses.length === 0) {
    await customer.as.mutation(api.addresses.create, { address: ADDRESS });
  }
}

export async function getStock(t: TestBackend, productId: Id<"products">) {
  return await t.run(async (ctx) => (await ctx.db.get(productId))!.stock);
}

export async function countRows(
  t: TestBackend,
  table:
    | "orders"
    | "orderItems"
    | "orderEvents"
    | "stockMovements"
    | "checkoutQuotes"
    | "webhookReceipts"
    | "memberships"
) {
  return await t.run(async (ctx) => (await ctx.db.query(table).collect()).length);
}

export const billing = {
  none() {
    clerkBilling.getUserBillingSubscription.mockRejectedValue({
      status: 404,
      message: "Not Found",
    });
  },
  outage() {
    clerkBilling.getUserBillingSubscription.mockRejectedValue({
      status: 503,
      message: "Service Unavailable",
    });
  },
  subscription(status: string, periodEnd?: number) {
    clerkBilling.getUserBillingSubscription.mockResolvedValue({
      status,
      subscriptionItems: [
        {
          status,
          periodEnd,
          plan: { slug: "quickcrate_plus", features: [{ slug: "free_shipping" }] },
        },
      ],
    });
  },
  /** What Clerk returns for a user on only the default free plan. */
  freePlanOnly() {
    clerkBilling.getUserBillingSubscription.mockResolvedValue({
      status: "active",
      subscriptionItems: [
        { status: "active", plan: { slug: "free_user", features: [] } },
      ],
    });
  },
  mock: clerkBilling.getUserBillingSubscription,
};
