import { httpRouter } from "convex/server";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
http.route({
  path: "/clerk-webhook", method: "POST",
  handler: httpAction(async (ctx, request) => {
    let event;
    try { event = await verifyWebhook(request); }
    catch { return new Response("Invalid webhook signature", { status: 400 }); }
    if (event.type !== "user.created" && event.type !== "user.updated" && event.type !== "user.deleted") return new Response("Ignored", { status: 200 });
    const eventId = request.headers.get("svix-id");
    const id = event.data.id;
    if (!eventId || !id || !Number.isFinite(event.timestamp)) return new Response("Invalid event", { status: 400 });
    if (event.type === "user.deleted") {
      await ctx.runMutation(internal.users.applyClerkEvent, { eventId, type: event.type, timestamp: event.timestamp, clerkUserId: id });
    } else {
      const data = event.data;
      const email = data.email_addresses.find(e => e.id === data.primary_email_address_id)?.email_address;
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || undefined;
      await ctx.runMutation(internal.users.applyClerkEvent, { eventId, type: event.type, timestamp: event.timestamp, updatedAt: data.updated_at, clerkUserId: id, email, name, imageUrl: data.image_url || undefined });
    }
    return new Response("OK", { status: 200 });
  }),
});
export default http;
