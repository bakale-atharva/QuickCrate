import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  ADDRESS,
  createProduct,
  fillCart,
  identityFor,
  setupBackend,
  signUp,
  signUpAdmin,
} from "./test.helpers";

async function placedOrderScenario() {
  const t = setupBackend();
  const admin = await signUpAdmin(t);
  const alice = await signUp(t, "user_alice");
  const bob = await signUp(t, "user_bob");
  const productId = await createProduct(admin, { stock: 10 });
  await fillCart(alice, productId, 1);
  const quote = await alice.as.action(api.checkout.quote, {});
  const { orderId } = await alice.as.action(api.checkout.placeOrder, {
    quoteId: quote.quoteId,
    idempotencyKey: "alice-order",
  });
  const [aliceAddress] = await alice.as.query(api.addresses.list, {});
  return { t, admin, alice, bob, productId, orderId, aliceAddressId: aliceAddress._id };
}

describe("unauthenticated direct API access", () => {
  test("customer and admin APIs reject anonymous callers", async () => {
    const { t, productId, orderId } = await placedOrderScenario();
    const anonymous = [
      () => t.query(api.users.me, {}),
      () => t.query(api.cart.get, {}),
      () => t.mutation(api.cart.addItem, { productId, quantity: BigInt(1) }),
      () => t.query(api.orders.getMyOrders, {}),
      () => t.query(api.orders.getMyOrder, { orderId }),
      () => t.mutation(api.orders.cancel, { orderId }),
      () => t.query(api.favorites.list, {}),
      () => t.query(api.addresses.list, {}),
      () => t.action(api.checkout.quote, {}),
      () => t.action(api.memberships.refreshMine, {}),
      () => t.query(api.orders.adminListOrders, {}),
      () => t.query(api.users.adminListCustomers, {}),
      () => t.mutation(api.products.adjustStock, {
        productId,
        expectedStock: BigInt(9),
        quantityDelta: BigInt(100),
        reason: "anonymous",
      }),
      () => t.mutation(api.products.generateUploadUrl, {}),
    ];
    for (const call of anonymous) {
      await expect(call()).rejects.toThrow(/Unauthorized/);
    }
  });

  test("signed-in identities without an initialized account are rejected", async () => {
    const { t } = await placedOrderScenario();
    const stranger = identityFor(t, "user_never_initialized");
    await expect(stranger.query(api.cart.get, {})).rejects.toThrow(/Unauthorized/);
    await expect(
      stranger.action(api.checkout.placeOrder, {
        quoteId: (await t.run((ctx) => ctx.db.query("checkoutQuotes").first()))!._id,
        idempotencyKey: "x",
      })
    ).rejects.toThrow(/Active user not found/);
  });

  test("a token for the same subject from another issuer is rejected", async () => {
    const { t } = await placedOrderScenario();
    const impostor = t.withIdentity({
      issuer: "https://evil.example",
      subject: "user_alice",
      tokenIdentifier: "https://evil.example|user_alice",
    });
    await expect(impostor.query(api.orders.getMyOrders, {})).rejects.toThrow(/Unauthorized/);
  });
});

describe("customer data isolation", () => {
  test("customers cannot read or change another customer's orders or addresses", async () => {
    const { bob, orderId, aliceAddressId } = await placedOrderScenario();
    await expect(bob.as.query(api.orders.getMyOrder, { orderId })).rejects.toThrow(/Forbidden/);
    await expect(bob.as.mutation(api.orders.cancel, { orderId })).rejects.toThrow(/Forbidden/);
    await expect(
      bob.as.mutation(api.addresses.update, { id: aliceAddressId, address: ADDRESS })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      bob.as.mutation(api.addresses.deleteAddress, { id: aliceAddressId })
    ).rejects.toThrow(/Forbidden/);
    expect(await bob.as.query(api.orders.getMyOrders, {})).toEqual([]);
  });

  test("each customer sees only their own cart", async () => {
    const { alice, bob, productId } = await placedOrderScenario();
    await bob.as.mutation(api.cart.addItem, { productId, quantity: BigInt(2) });
    const aliceCart = await alice.as.query(api.cart.get, {});
    const bobCart = await bob.as.query(api.cart.get, {});
    expect(aliceCart.items).toHaveLength(0);
    expect(bobCart.items).toHaveLength(1);
  });
});

describe("admin-only operations", () => {
  test("customers are forbidden from every admin operation", async () => {
    const { t, alice, bob, productId, orderId } = await placedOrderScenario();
    const categoryId = (await t.run((ctx) => ctx.db.get(productId)))!.categoryId;
    const forbidden = [
      () => bob.as.query(api.orders.adminListOrders, {}),
      () => bob.as.query(api.orders.adminGetOrder, { orderId }),
      () => bob.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "confirmed" }),
      () => bob.as.query(api.users.adminListCustomers, {}),
      () => bob.as.query(api.users.adminGetCustomer, { userId: alice.userId }),
      () => bob.as.mutation(api.users.adminAddCustomerNote, { userId: alice.userId, body: "x" }),
      () =>
        bob.as.mutation(api.users.adminSetCustomerSuspended, {
          userId: alice.userId,
          suspended: true,
        }),
      () => bob.as.mutation(api.categories.create, { name: "Hack", slug: "hack" }),
      () => bob.as.mutation(api.products.update, { id: productId, pricePaise: BigInt(1) }),
      () => bob.as.mutation(api.products.archive, { id: productId, archived: true }),
      () =>
        bob.as.mutation(api.products.adjustStock, {
          productId,
          expectedStock: BigInt(9),
          quantityDelta: BigInt(100),
          reason: "x",
        }),
      () => bob.as.mutation(api.products.generateUploadUrl, {}),
      () => bob.as.query(api.products.getStockMovements, { productId }),
      () =>
        bob.as.mutation(api.products.create, {
          categoryId,
          name: "x",
          slug: "x",
          sku: "X",
          description: "",
          packLabel: "1",
          pricePaise: BigInt(1),
          initialStock: BigInt(1),
        }),
      () => bob.as.mutation(api.fixtures.seedDevelopmentFixtures, { resetStock: true }),
    ];
    for (const call of forbidden) {
      await expect(call()).rejects.toThrow(/Forbidden/);
    }
    const product = await t.run((ctx) => ctx.db.get(productId));
    expect(product?.pricePaise).toBe(BigInt(10000));
    expect(product?.archived).toBe(false);
  });

  test("an admin role cannot be granted by any public function", async () => {
    const { t, bob } = await placedOrderScenario();
    // users.initialize is the only public user write; re-running it never promotes.
    await bob.as.mutation(api.users.initialize, {});
    expect((await bob.as.query(api.users.me, {})).role).toBe("customer");
    const user = await t.run((ctx) => ctx.db.get(bob.userId));
    expect(user?.role).toBeUndefined();
  });

  test("administrators cannot be suspended", async () => {
    const { admin } = await placedOrderScenario();
    await expect(
      admin.as.mutation(api.users.adminSetCustomerSuspended, {
        userId: admin.userId,
        suspended: true,
      })
    ).rejects.toThrow(/administrator/);
  });
});
