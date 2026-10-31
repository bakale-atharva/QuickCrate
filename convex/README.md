# Phase 1 backend foundation

The application initializes its Convex user from the authenticated Clerk identity when a session connects. Convex functions must use `requireUser`, `requireAdmin`, and `requireOwner` from `auth.ts` before accessing protected data. Role changes are not exposed to clients.

To provision an administrator, first sign in as that Clerk user so their profile exists, then invoke the internal `users:bootstrapAdmin` mutation from the Convex dashboard or CLI with the explicit `clerkUserId`. Never promote a first user automatically.

Configure a Clerk webhook endpoint at `https://<deployment>.convex.site/clerk-webhook` for `user.created`, `user.updated`, and `user.deleted`. Set its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` in the same Convex deployment. The endpoint verifies signatures before writing, stores delivery IDs transactionally, orders profile updates by Clerk's object update time and event time, and keeps deleted-user tombstones so delayed events cannot restore an account. Orders retain their user reference after deletion. Webhook setup and actual delivery require the Clerk dashboard and signing secret; a successful code deployment alone does not configure them.

Amounts in paise and product quantities are stored as Convex `int64` values. Future write APIs must also enforce business bounds and validate all amounts and quantities before writing. Ownership indexes support bounded or paginated access; indexes do not themselves enforce uniqueness or authorization.
