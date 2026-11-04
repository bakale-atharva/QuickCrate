import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  billing,
  countRows,
  createProduct,
  fillCart,
  setupBackend,
  signUp,
  signUpAdmin,
  type TestBackend,
} from "./test.helpers";

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

/** Builds a Svix-signed Clerk webhook request with the test signing secret. */
async function signedDelivery(eventId: string, payload: unknown, secret?: string) {
  const signingSecret = secret ?? process.env.CLERK_WEBHOOK_SIGNING_SECRET!;
  const key = Uint8Array.from(atob(signingSecret.replace(/^whsec_/, "")), (c) =>
    c.charCodeAt(0)
  );
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${eventId}.${timestamp}.${body}`)
  );
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": eventId,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${base64(new Uint8Array(signature))}`,
    },
  };
}

function userEvent(
  type: "user.created" | "user.updated" | "user.deleted",
  clerkUserId: string,
  timestamp: number,
  email = `${clerkUserId}@example.test`
) {
  return {
    type,
    timestamp,
    data:
      type === "user.deleted"
        ? { id: clerkUserId, deleted: true }
        : {
            id: clerkUserId,
            email_addresses: [{ id: "email_1", email_address: email }],
            primary_email_address_id: "email_1",
            first_name: "Webhook",
            updated_at: timestamp,
          },
  };
}

async function deliver(t: TestBackend, eventId: string, payload: unknown) {
  return await t.fetch("/clerk-webhook", await signedDelivery(eventId, payload));
}

async function findUser(t: TestBackend, clerkUserId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique()
  );
}

describe("Clerk profile webhooks", () => {
  test("unsigned or tampered deliveries are rejected without writes", async () => {
    const t = setupBackend();
    const payload = userEvent("user.created", "user_forged", 1000);

    const unsigned = await t.fetch("/clerk-webhook", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    });
    const wrongSecret = await t.fetch(
      "/clerk-webhook",
      await signedDelivery("msg_forged", payload, "whsec_d3Jvbmctc2VjcmV0LXdyb25nLXNlY3JldA==")
    );
    const tampered = await signedDelivery("msg_tampered", payload);
    tampered.body = JSON.stringify({ ...payload, data: { ...payload.data, id: "user_victim" } });
    const tamperedResponse = await t.fetch("/clerk-webhook", tampered);

    expect(unsigned.status).toBe(400);
    expect(wrongSecret.status).toBe(400);
    expect(tamperedResponse.status).toBe(400);
    expect(await findUser(t, "user_forged")).toBeNull();
    expect(await findUser(t, "user_victim")).toBeNull();
    expect(await countRows(t, "webhookReceipts")).toBe(0);
  });

  test("duplicate deliveries are applied once", async () => {
    const t = setupBackend();
    const created = userEvent("user.created", "user_dup", 1000, "first@example.test");
    expect((await deliver(t, "msg_1", created)).status).toBe(200);
    expect((await deliver(t, "msg_1", created)).status).toBe(200);
    expect(await countRows(t, "webhookReceipts")).toBe(1);
    expect((await findUser(t, "user_dup"))?.email).toBe("first@example.test");
  });

  test("out-of-order updates and delayed events cannot restore a deleted account", async () => {
    const t = setupBackend();
    await deliver(t, "msg_a", userEvent("user.created", "user_gone", 1000));
    await deliver(t, "msg_b", userEvent("user.updated", "user_gone", 3000, "new@example.test"));
    // An older update arrives late and is ignored.
    await deliver(t, "msg_c", userEvent("user.updated", "user_gone", 2000, "old@example.test"));
    expect((await findUser(t, "user_gone"))?.email).toBe("new@example.test");

    await deliver(t, "msg_d", userEvent("user.deleted", "user_gone", 4000));
    // A delayed update after deletion must not resurrect the profile.
    await deliver(t, "msg_e", userEvent("user.updated", "user_gone", 5000, "zombie@example.test"));

    const user = await findUser(t, "user_gone");
    expect(user?.deletedAt).toBe(4000);
    expect(user?.email).toBe("");
  });

  test("deleted customers lose access but their orders are preserved", async () => {
    const t = setupBackend();
    const admin = await signUpAdmin(t);
    const customer = await signUp(t, "user_deleted_buyer");
    const productId = await createProduct(admin, { stock: 3 });
    await fillCart(customer, productId, 1);
    const quote = await customer.as.action(api.checkout.quote, {});
    const { orderId } = await customer.as.action(api.checkout.placeOrder, {
      quoteId: quote.quoteId,
      idempotencyKey: "pre-delete",
    });

    await deliver(t, "msg_delete", userEvent("user.deleted", "user_deleted_buyer", Date.now()));

    await expect(customer.as.query(api.users.me, {})).rejects.toThrow(/Unauthorized/);
    await expect(customer.as.mutation(api.users.initialize, {})).rejects.toThrow(/Unauthorized/);
    const order = await admin.as.query(api.orders.adminGetOrder, { orderId });
    expect(order.userId).toBe(customer.userId);
    expect(order.items).toHaveLength(1);
  });
});

describe("Clerk billing webhooks", () => {
  const subscriptionEvent = (clerkUserId: string) => ({
    type: "subscription.updated",
    timestamp: Date.now(),
    data: { id: "sub_1", payer: { user_id: clerkUserId } },
  });

  test("a billing event refreshes membership from Clerk, and duplicates are skipped", async () => {
    const t = setupBackend();
    const customer = await signUp(t, "user_billing");
    billing.subscription("active");

    expect((await deliver(t, "msg_sub_1", subscriptionEvent("user_billing"))).status).toBe(200);
    expect((await deliver(t, "msg_sub_1", subscriptionEvent("user_billing"))).status).toBe(200);

    expect(billing.mock).toHaveBeenCalledTimes(1);
    const membership = await customer.as.query(api.memberships.getMyMembership, {});
    expect(membership.eligible).toBe(true);
  });

  test("a delivery that fails during a Clerk outage is retryable and applied on redelivery", async () => {
    const t = setupBackend();
    const customer = await signUp(t, "user_billing_outage");

    billing.outage();
    const failed = await deliver(t, "msg_sub_outage", subscriptionEvent("user_billing_outage"));
    expect(failed.status).toBe(500);
    expect(await countRows(t, "webhookReceipts")).toBe(0);
    expect(await countRows(t, "memberships")).toBe(0);

    billing.subscription("active");
    const retried = await deliver(t, "msg_sub_outage", subscriptionEvent("user_billing_outage"));
    expect(retried.status).toBe(200);
    const membership = await customer.as.query(api.memberships.getMyMembership, {});
    expect(membership.status).toBe("active");
    expect(await countRows(t, "webhookReceipts")).toBe(1);
  });

  test("billing events for unknown users are acknowledged without writes", async () => {
    const t = setupBackend();
    const response = await deliver(t, "msg_unknown", subscriptionEvent("user_nobody"));
    expect(response.status).toBe(200);
    expect(await countRows(t, "memberships")).toBe(0);
  });
});
