import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  billing,
  countRows,
  createProduct,
  fillCart,
  getStock,
  setupBackend,
  signUp,
  signUpAdmin,
} from "./test.helpers";
import type { Id } from "./_generated/dataModel";
import { QUOTE_TTL_MS } from "../lib/constants";

afterEach(() => {
  vi.useRealTimers();
});

describe("order placement retries", () => {
  test("a retried submission returns the original order and changes stock once", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_retry");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 2);

    const quote = await customer.as.action(api.checkout.quote, {});
    const first = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "submit-1",
    });
    const second = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "submit-1",
    });

    expect(first.alreadyPlaced).toBe(false);
    expect(second).toEqual({ orderId: first.orderId, status: "placed", alreadyPlaced: true });
    expect(await getStock(t, productId)).toBe(BigInt(3));
    expect(await countRows(t, "orders")).toBe(1);
    expect(await countRows(t, "orderItems")).toBe(1);
    // Initial inventory + one sale.
    expect(await countRows(t, "stockMovements")).toBe(2);
  });

  test("lost-response retries succeed after cart clearing, quote expiry, and a Clerk outage", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_lost_response");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 1);

    const quote = await customer.as.action(api.checkout.quote, {});
    const placed = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "lost-1",
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + QUOTE_TTL_MS * 2);
    billing.outage();

    const retry = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "lost-1",
    });
    expect(retry.orderId).toBe(placed.orderId);
    expect(retry.alreadyPlaced).toBe(true);
    expect(await getStock(t, productId)).toBe(BigInt(4));
  });

  test("a new idempotency key cannot reuse a consumed quote", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_reuse");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 1);

    const quote = await customer.as.action(api.checkout.quote, {});
    await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "first",
    });
    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "second",
      })
    ).rejects.toThrow(/Cart contents changed/);
    expect(await countRows(t, "orders")).toBe(1);
    expect(await getStock(t, productId)).toBe(BigInt(4));
  });

  test("an expired quote requires renewed review", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_expired");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 1);

    const quote = await customer.as.action(api.checkout.quote, {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(quote.expiresAt + 1);

    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "late",
      })
    ).rejects.toThrow(/expired/);
    expect(await countRows(t, "orders")).toBe(0);
    expect(await getStock(t, productId)).toBe(BigInt(5));
  });
});

describe("cart races", () => {
  test("changing the cart after review invalidates the quote without partial writes", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_cart_race");
    const productId = await createProduct(admin, { stock: 10 });
    await fillCart(customer, productId, 1);

    const quote = await customer.as.action(api.checkout.quote, {});
    // Another tab adds an item after the customer reviewed the total.
    await customer.as.mutation(api.cart.addItem, { productId, quantity: BigInt(3) });

    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "race",
      })
    ).rejects.toThrow(/Cart contents changed/);
    expect(await countRows(t, "orders")).toBe(0);
    expect(await getStock(t, productId)).toBe(BigInt(10));
    const cart = await customer.as.query(api.cart.get, {});
    expect(cart.items[0].quantity).toBe(BigInt(4));
  });

  test("concurrent cart additions are all applied and stay within limits", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_concurrent_cart");
    const productId = await createProduct(admin, { stock: 200 });

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        customer.as.mutation(api.cart.addItem, { productId, quantity: BigInt(9) })
      )
    );
    const cart = await customer.as.query(api.cart.get, {});
    const applied = results.filter((r) => r.status === "fulfilled").length;

    // 11 × 9 = 99 is the per-product maximum; the twelfth addition is refused.
    expect(applied).toBe(11);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(BigInt(99));
  });

  test("guest cart merge retries are deduplicated", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_merge");
    const productId = await createProduct(admin, { stock: 50 });
    await customer.as.mutation(api.cart.addItem, { productId, quantity: BigInt(2) });

    const merge = {
      mergeKey: "guest-merge-1",
      items: [{ productId, quantity: BigInt(3) }],
    };
    const first = await customer.as.mutation(api.cart.mergeGuestCart, merge);
    const retry = await customer.as.mutation(api.cart.mergeGuestCart, merge);

    expect(retry).toEqual(first);
    const cart = await customer.as.query(api.cart.get, {});
    expect(cart.items[0].quantity).toBe(BigInt(5));
  });
});

describe("stock contention", () => {
  test("competing purchases of the final unit cannot oversell", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const productId = await createProduct(admin, { stock: 1 });
    const buyers = await Promise.all(
      ["user_buyer_a", "user_buyer_b", "user_buyer_c"].map((id) => signUp(t, id))
    );

    const quotes: Array<{ quoteId: Id<"checkoutQuotes"> }> = [];
    for (const buyer of buyers) {
      await fillCart(buyer, productId, 1);
      quotes.push(await buyer.as.action(api.checkout.quote, {}));
    }

    const results = await Promise.allSettled(
      buyers.map((buyer, i) =>
        buyer.as.action(api.checkout.placeOrder, {
          quoteId: quotes[i].quoteId,
          idempotencyKey: `final-unit-${i}`,
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(2);
    for (const failure of failed) {
      expect(String((failure as PromiseRejectedResult).reason)).toMatch(/Insufficient stock/);
    }
    expect(await getStock(t, productId)).toBe(BigInt(0));
    expect(await countRows(t, "orders")).toBe(1);
  });

  test("a stale admin stock edit cannot overwrite an intervening purchase", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_stale_edit");
    const productId = await createProduct(admin, { stock: 5 });

    // The admin opens the editor while stock reads 5...
    const expectedStock = await getStock(t, productId);
    // ...a customer buys two units...
    await fillCart(customer, productId, 2);
    const quote = await customer.as.action(api.checkout.quote, {});
    await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "intervening",
    });
    // ...and the admin's stale adjustment is rejected.
    await expect(
      admin.as.mutation(api.products.adjustStock, {
        productId,
        expectedStock,
        quantityDelta: BigInt(10),
        reason: "Restock",
      })
    ).rejects.toThrow(/Stock conflict/);
    expect(await getStock(t, productId)).toBe(BigInt(3));
  });

  test("stock adjustments cannot go negative", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const productId = await createProduct(admin, { stock: 2 });
    await expect(
      admin.as.mutation(api.products.adjustStock, {
        productId,
        expectedStock: BigInt(2),
        quantityDelta: BigInt(-3),
        reason: "Damaged",
      })
    ).rejects.toThrow(/cannot be negative/);
    expect(await getStock(t, productId)).toBe(BigInt(2));
  });

  test("cancellation restocks exactly once", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_cancel");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 3);
    const quote = await customer.as.action(api.checkout.quote, {});
    const { orderId } = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "cancel-me",
    });

    await customer.as.mutation(api.orders.cancel, { orderId });
    await expect(customer.as.mutation(api.orders.cancel, { orderId })).rejects.toThrow(
      /terminal/
    );
    await expect(
      admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "cancelled" })
    ).rejects.toThrow(/Terminal/);
    expect(await getStock(t, productId)).toBe(BigInt(5));
  });
});

describe("membership and delivery fees", () => {
  async function quoteWith(setBilling: () => void) {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_member");
    const productId = await createProduct(admin, { stock: 5, pricePaise: 20000 });
    await fillCart(customer, productId, 1);
    setBilling();
    return { t, customer, quote: await customer.as.action(api.checkout.quote, {}) };
  }

  test("active members get free delivery", async () => {
    const { quote } = await quoteWith(() => billing.subscription("active"));
    expect(quote.deliveryFeePaise).toBe(BigInt(0));
    expect(quote.totalPaise).toBe(BigInt(20000));
  });

  test("canceled members keep free delivery until the paid period ends", async () => {
    const { quote } = await quoteWith(() =>
      billing.subscription("canceled", Date.now() + 86_400_000)
    );
    expect(quote.membershipEligible).toBe(true);
    expect(quote.deliveryFeePaise).toBe(BigInt(0));
  });

  test.each([
    ["expired canceled", "canceled", -86_400_000],
    ["past_due", "past_due", 86_400_000],
    ["incomplete", "incomplete", 86_400_000],
    ["ended", "ended", -86_400_000],
  ])("%s subscriptions pay the ₹49 delivery fee", async (_label, status, offset) => {
    const { quote } = await quoteWith(() => billing.subscription(status, Date.now() + offset));
    expect(quote.membershipEligible).toBe(false);
    expect(quote.deliveryFeePaise).toBe(BigInt(4900));
    expect(quote.totalPaise).toBe(BigInt(24900));
  });

  test("Clerk's default free plan does not grant free delivery", async () => {
    const { quote } = await quoteWith(() => billing.freePlanOnly());
    expect(quote.membershipEligible).toBe(false);
    expect(quote.deliveryFeePaise).toBe(BigInt(4900));
  });

  test("a verification outage fails the quote instead of charging delivery", async () => {
    const { t, customer } = await quoteWith(() => billing.none());
    billing.outage();
    await expect(customer.as.action(api.checkout.quote, {})).rejects.toThrow(
      /Membership verification failed/
    );
    // Only the first (successful) quote exists.
    expect(await countRows(t, "checkoutQuotes")).toBe(1);
  });

  test("membership expiring between review and submission requires renewed review", async () => {
    const { t, customer, quote } = await quoteWith(() => billing.subscription("active"));
    billing.subscription("canceled", Date.now() - 1000);
    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "expiry",
      })
    ).rejects.toThrow(/Membership eligibility changed/);
    expect(await countRows(t, "orders")).toBe(0);
  });

  test("an outage at submission is retryable and writes nothing", async () => {
    const { t, customer, quote } = await quoteWith(() => billing.none());
    billing.outage();
    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "outage",
      })
    ).rejects.toThrow(/Membership verification failed/);
    expect(await countRows(t, "orders")).toBe(0);

    billing.none();
    const placed = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "outage",
    });
    expect(placed.alreadyPlaced).toBe(false);
  });

  test("overlapping refreshes are fenced against stale writes", async () => {
    const { t, customer } = await quoteWith(() => billing.subscription("active"));
    const newer = Date.now() + 10_000;
    await t.mutation(internal.memberships.applyMembershipUpdate, {
      userId: customer.userId,
      status: "canceled",
      paidThrough: Date.now() - 1,
      refreshedAt: newer,
    });
    const stale = await t.mutation(internal.memberships.applyMembershipUpdate, {
      userId: customer.userId,
      status: "active",
      refreshedAt: newer - 5_000,
    });
    expect(stale.fenced).toBe(true);
    const membership = await customer.as.query(api.memberships.getMyMembership, {});
    expect(membership.status).toBe("canceled");
    expect(membership.eligible).toBe(false);
  });
});

describe("manipulated client inputs", () => {
  test("price changes after review are rejected; totals come from the server", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_price");
    const productId = await createProduct(admin, { stock: 5, pricePaise: 10000 });
    await fillCart(customer, productId, 2);
    const quote = await customer.as.action(api.checkout.quote, {});
    expect(quote.subtotalPaise).toBe(BigInt(20000));

    await admin.as.mutation(api.products.update, { id: productId, pricePaise: BigInt(15000) });
    await expect(
      customer.as.action(api.checkout.placeOrder, {
        quoteId: quote.quoteId,
        idempotencyKey: "price",
      })
    ).rejects.toThrow(/Price .* changed/);
    expect(await countRows(t, "orders")).toBe(0);
  });

  test("a customer cannot place an order with another customer's quote or address", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const alice = await signUp(t, "user_alice");
    const mallory = await signUp(t, "user_mallory");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(alice, productId, 1);
    await fillCart(mallory, productId, 1);
    const aliceQuote = await alice.as.action(api.checkout.quote, {});
    const [aliceAddress] = await alice.as.query(api.addresses.list, {});

    await expect(
      mallory.as.action(api.checkout.placeOrder, {
        quoteId: aliceQuote.quoteId,
        idempotencyKey: "steal",
      })
    ).rejects.toThrow(/Invalid checkout quote/);
    await expect(
      mallory.as.action(api.checkout.quote, { addressId: aliceAddress._id })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      mallory.as.query(api.checkout.getQuote, { quoteId: aliceQuote.quoteId })
    ).rejects.toThrow(/Forbidden/);
    expect(await countRows(t, "orders")).toBe(0);
  });

  test("suspended customers cannot order but keep access to existing orders", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_suspended");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 1);
    const quote = await customer.as.action(api.checkout.quote, {});
    const { orderId } = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "before-suspension",
    });

    await admin.as.mutation(api.users.adminSetCustomerSuspended, {
      userId: customer.userId,
      suspended: true,
    });
    await fillCart(customer, productId, 1);
    await expect(customer.as.action(api.checkout.quote, {})).rejects.toThrow(/suspended/);
    const order = await customer.as.query(api.orders.getMyOrder, { orderId });
    expect(order._id).toBe(orderId);
  });
});

describe("order history", () => {
  test("historical orders keep their snapshots after catalog edits and archival", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_history");
    const productId = await createProduct(admin, {
      stock: 5,
      pricePaise: 12500,
      name: "Basmati Rice",
    });
    await fillCart(customer, productId, 2);
    const quote = await customer.as.action(api.checkout.quote, {});
    const { orderId } = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "history",
    });

    await admin.as.mutation(api.products.update, {
      id: productId,
      name: "Renamed Rice",
      pricePaise: BigInt(99900),
    });
    await admin.as.mutation(api.products.archive, { id: productId, archived: true });

    const order = await customer.as.query(api.orders.getMyOrder, { orderId });
    expect(order.items[0]).toMatchObject({
      name: "Basmati Rice",
      unitPricePaise: BigInt(12500),
      quantity: BigInt(2),
    });
    expect(order.totalPaise).toBe(BigInt(25000 + 4900));
  });

  test("fulfillment follows the lifecycle and delivery requires COD confirmation", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_lifecycle");
    const productId = await createProduct(admin, { stock: 5 });
    await fillCart(customer, productId, 1);
    const quote = await customer.as.action(api.checkout.quote, {});
    const { orderId } = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "lifecycle",
    });

    await expect(
      admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "packing" })
    ).rejects.toThrow(/Invalid status transition/);
    await admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "confirmed" });
    await expect(customer.as.mutation(api.orders.cancel, { orderId })).rejects.toThrow(
      /only cancel orders in 'placed'/
    );
    await admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "packing" });
    await admin.as.mutation(api.orders.adminUpdateStatus, {
      orderId,
      status: "out_for_delivery",
    });
    await expect(
      admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "cancelled" })
    ).rejects.toThrow(/after dispatch/);
    await expect(
      admin.as.mutation(api.orders.adminUpdateStatus, { orderId, status: "delivered" })
    ).rejects.toThrow(/COD collection/);
    await admin.as.mutation(api.orders.adminUpdateStatus, {
      orderId,
      status: "delivered",
      codCollected: true,
    });

    const order = await customer.as.query(api.orders.getMyOrder, { orderId });
    expect(order.status).toBe("delivered");
    expect(order.codCollected).toBe(true);
    expect(order.events.map((e) => e.status)).toEqual([
      "placed",
      "confirmed",
      "packing",
      "out_for_delivery",
      "delivered",
    ]);
  });
});
