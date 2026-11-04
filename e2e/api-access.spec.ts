import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { CUSTOMER_STATE } from "./env";

// Calls the deployed development backend directly, bypassing the UI, to prove
// authorization is enforced by Convex rather than by hidden buttons.

const convexUrl = () => process.env.NEXT_PUBLIC_CONVEX_URL!;

async function convexTokenFor(page: Page) {
  await page.goto("/");
  return await page.evaluate(async () => {
    const clerk = (window as unknown as {
      Clerk: { loaded: boolean; session?: { getToken(o: { template: string }): Promise<string> } };
    }).Clerk;
    while (!clerk?.loaded) await new Promise((r) => setTimeout(r, 100));
    return await clerk.session!.getToken({ template: "convex" });
  });
}

test("anonymous direct calls are rejected", async () => {
  const client = new ConvexHttpClient(convexUrl());
  await expect(client.query(api.cart.get, {})).rejects.toThrow(/Unauthorized/);
  await expect(client.query(api.orders.getMyOrders, {})).rejects.toThrow(/Unauthorized/);
  await expect(client.query(api.orders.adminListOrders, {})).rejects.toThrow(/Unauthorized/);
  await expect(client.query(api.users.adminListCustomers, {})).rejects.toThrow(/Unauthorized/);
  await expect(client.action(api.checkout.quote, {})).rejects.toThrow(/Unauthorized/);
  // The public catalog stays readable.
  await expect(client.query(api.products.list, { limit: 1 })).resolves.toBeDefined();
});

test.describe("customer token", () => {
  test.use({ storageState: CUSTOMER_STATE });

  test("cannot call admin functions or change roles", async ({ page }) => {
    const client = new ConvexHttpClient(convexUrl());
    client.setAuth(await convexTokenFor(page));

    const me = await client.query(api.users.me, {});
    expect(me.role).toBe("customer");

    await expect(client.query(api.orders.adminListOrders, {})).rejects.toThrow(/Forbidden/);
    await expect(client.query(api.users.adminListCustomers, {})).rejects.toThrow(/Forbidden/);
    await expect(
      client.mutation(api.users.adminSetCustomerSuspended, { userId: me.id, suspended: false })
    ).rejects.toThrow(/Forbidden/);
    await expect(client.mutation(api.products.generateUploadUrl, {})).rejects.toThrow(/Forbidden/);

    const [product] = await client.query(api.products.list, { limit: 1 });
    await expect(
      client.mutation(api.products.adjustStock, {
        productId: product._id,
        expectedStock: product.stock,
        quantityDelta: BigInt(1000),
        reason: "tampering",
      })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      client.mutation(api.products.update, { id: product._id, pricePaise: BigInt(1) })
    ).rejects.toThrow(/Forbidden/);

    // A forged quote ID cannot place an order.
    await expect(
      client.action(api.checkout.placeOrder, {
        quoteId: product._id as never,
        idempotencyKey: "forged",
      })
    ).rejects.toThrow();
    expect((await client.query(api.users.me, {})).role).toBe("customer");
  });
});
