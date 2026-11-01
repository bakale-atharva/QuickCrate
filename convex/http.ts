import { httpRouter } from "convex/server";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

type WebhookEmailAddress = {
  id: string;
  email_address: string;
};

type WebhookUserData = {
  id?: string;
  email_addresses?: WebhookEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  updated_at?: number;
};

type WebhookBillingData = {
  id?: string;
  user_id?: string;
  payer_id?: string;
  payer?: {
    user_id?: string;
    organization_id?: string;
  };
};

type ClerkWebhookEvent = {
  type: string;
  timestamp: number;
  data: WebhookUserData & WebhookBillingData;
};

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let event: ClerkWebhookEvent;
    try {
      event = (await verifyWebhook(request)) as unknown as ClerkWebhookEvent;
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    const eventId = request.headers.get("svix-id");
    if (!eventId) {
      return new Response("Missing event ID", { status: 400 });
    }

    const eventType = event.type;

    if (
      eventType === "user.created" ||
      eventType === "user.updated" ||
      eventType === "user.deleted"
    ) {
      const id = event.data.id;
      if (!id || !Number.isFinite(event.timestamp)) {
        return new Response("Invalid event", { status: 400 });
      }

      const userEventType: "user.created" | "user.updated" | "user.deleted" =
        eventType;

      if (userEventType === "user.deleted") {
        await ctx.runMutation(internal.users.applyClerkEvent, {
          eventId,
          type: userEventType,
          timestamp: event.timestamp,
          clerkUserId: id,
        });
      } else {
        const data = event.data;
        const email = data.email_addresses?.find(
          (e) => e.id === data.primary_email_address_id
        )?.email_address;
        const name =
          [data.first_name, data.last_name].filter(Boolean).join(" ") || undefined;
        await ctx.runMutation(internal.users.applyClerkEvent, {
          eventId,
          type: userEventType,
          timestamp: event.timestamp,
          updatedAt: data.updated_at,
          clerkUserId: id,
          email,
          name,
          imageUrl: data.image_url || undefined,
        });
      }

      return new Response("OK", { status: 200 });
    }

    const isBillingEvent =
      eventType.startsWith("subscription.") ||
      eventType.startsWith("subscriptionItem.") ||
      eventType.startsWith("paymentAttempt.");

    if (isBillingEvent) {
      const receipt = await ctx.runMutation(
        internal.memberships.recordWebhookReceipt,
        { eventId }
      );
      if (receipt.isDuplicate) {
        return new Response("OK (duplicate)", { status: 200 });
      }

      const data = event.data;
      const clerkUserId =
        data.payer?.user_id ?? data.user_id ?? data.payer_id;
      if (clerkUserId) {
        await ctx.runAction(internal.memberships.handleBillingWebhook, {
          clerkUserId,
        });
      }

      return new Response("OK", { status: 200 });
    }

    return new Response("Ignored", { status: 200 });
  }),
});

export default http;
