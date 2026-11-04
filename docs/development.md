# Development and verification guide

QuickCrate is a development/test MVP. It uses a Clerk **development** instance and a Convex **development** deployment. Nothing in this guide touches production payments.

## 1. Local setup

Requirements: Node 24 and pnpm 12.

```bash
pnpm install
```

Create `.env.local` (it is git-ignored):

| Variable | Where it comes from |
| --- | --- |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | Written by `pnpm backend` (`convex dev`) the first time it runs |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard → API keys (development, `pk_test_`/`sk_test_`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` | Fixed values |

Set these on the Convex deployment (dashboard → Settings → Environment variables, or `npx convex env set`):

| Variable | Purpose |
| --- | --- |
| `CLERK_FRONTEND_API_URL` | Clerk Frontend API URL; `convex/auth.config.ts` trusts JWTs from this issuer |
| `CLERK_SECRET_KEY` | Lets Convex read Clerk Billing subscriptions |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifies Clerk webhook deliveries |

In Clerk, enable the **Convex** integration (it creates the `convex` JWT template).

Run the backend and frontend in separate terminals:

```bash
pnpm backend
```

```bash
pnpm frontend
```

## 2. Development fixtures

The fixtures create 5 categories and 21 fixed-pack products. Seeding is idempotent: it matches products by slug and SKU, and it keeps current stock unless you pass `resetStock`.

```bash
npx convex run fixtures:seedInternalFixtures
```

```bash
npx convex run fixtures:seedInternalFixtures '{"resetStock": true}'
```

Seeding also schedules `fixtures:attachFixtureImages`, which downloads stock photos into Convex storage for products without an image.

## 3. Admin provisioning

There is no public way to grant the admin role, and the first user is not promoted automatically.

1. Sign in to the storefront once as the person who should be an admin. This creates their Convex profile.
2. Copy their Clerk user ID (`user_…`) from the Clerk dashboard.
3. Run the internal mutation:

```bash
npx convex run users:bootstrapAdmin '{"clerkUserId": "user_..."}'
```

The admin area is at `/admin`. Every admin function also checks the role on the server.

## 4. Clerk webhooks

Create one endpoint in Clerk → Webhooks:

- **URL:** `https://<deployment>.convex.site/clerk-webhook`
- **Events:** `user.created`, `user.updated`, `user.deleted`, and the Billing events `subscription.*`, `subscriptionItem.*`, `paymentAttempt.*`
- Copy the endpoint's signing secret into the Convex variable `CLERK_WEBHOOK_SIGNING_SECRET`.

Behavior:

- Every delivery's signature is verified before anything is written. Unsigned or tampered requests get a 400.
- Delivery IDs (`svix-id`) are stored so retries are applied once.
- Profile events are ordered by Clerk's update time. A deleted account stays deleted even if older or delayed events arrive later, and its orders are kept.
- Billing events trigger an authoritative membership refresh from Clerk. If Clerk can't be reached, the endpoint returns 500 and releases the delivery ID, so Clerk's retry is processed.

To test webhooks locally, use the Clerk CLI's webhook forwarding, or send a test event from the Clerk dashboard.

## 5. Test membership (QuickCrate Plus)

QuickCrate Plus is a Clerk Billing **development** plan, so no real money moves:

- Plan slug `quickcrate_plus`, feature `free_shipping`, $4.99/month (USD), no trial.
- Subscribe from `/account/membership` with Clerk's test card `4242 4242 4242 4242`, any future expiry date, and any CVC.
- Members get free delivery (non-members pay ₹49). A canceled membership still qualifies until its paid period ends. Past-due, incomplete, expired, and ended subscriptions don't qualify, and neither does Clerk's default free plan.
- Membership is checked against Clerk when the quote is made and again when the order is submitted. If Clerk can't be reached, checkout shows a retryable error rather than charging delivery.

## 6. Checks

| Command | What it runs |
| --- | --- |
| `pnpm run typecheck` | Next.js route type generation and TypeScript |
| `pnpm exec tsc --noEmit -p convex` | TypeScript for Convex functions |
| `pnpm run lint` | ESLint |
| `pnpm run test` | Backend tests (Vitest + `convex-test`, in-memory, with Clerk Billing mocked) |
| `pnpm run check` | Type check, lint, and backend tests |
| `pnpm build` | Production build |
| `pnpm run test:e2e` | Playwright journeys against the development deployment |

### Backend tests

These are in `convex/*.test.ts`. They run in memory and never contact Clerk or Convex Cloud. They cover:

- idempotent retries, including lost responses after the cart is cleared, the quote expires, or Clerk is down
- cart races, guest-cart merge retries, and stock contention for the final unit
- stale admin stock edits and exactly-once restocking
- membership states, expiry between review and submission, verification outages, and refresh fencing
- manipulated client inputs (another customer's quote or address, changed prices)
- snapshots that survive catalog edits, and the order lifecycle
- webhook signatures, duplicates, ordering, deletion tombstones, and billing-refresh failures
- direct unauthenticated, cross-customer, and non-admin API calls

Test-only modules have names with more than one dot (`test.helpers.ts`), so the Convex bundler skips them and they never deploy.

### End-to-end tests

The Playwright journeys are in `e2e/`. They sign in with `@clerk/testing` helpers instead of the UI.

- `global.setup.ts` refuses to run unless the Clerk keys are development keys. It then seeds fixtures and creates two passwordless Clerk test users (`quickcrate-e2e-customer+clerk_test@example.com` and `quickcrate-e2e-admin+clerk_test@example.com`; override them with `E2E_CUSTOMER_EMAIL`/`E2E_ADMIN_EMAIL`). It signs both in, saves their sessions to `e2e/.auth/`, and promotes the admin with `users:bootstrapAdmin`.
- The journeys cover guest browsing and search, the persistent guest cart, acknowledged guest-cart merging, checkout with the ₹49 delivery fee, customer cancellation, favorites, the admin fulfillment flow through COD-confirmed delivery, admin catalog and customer pages, and direct API calls using a real customer token.
- Runs place real (development) orders. The customer journey cancels its order, but the admin journey delivers one unit of whole milk on every run. Reseed with `resetStock` if stock runs low.

By default Playwright starts `pnpm frontend` on port 3100. To reuse a dev server that's already running:

```bash
E2E_BASE_URL=http://localhost:3000 pnpm test:e2e
```

## 7. Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`.

- **checks:** route types, TypeScript (app and Convex), lint, backend tests, and a production build. It needs the repository **variables** `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Both are public values.
- **e2e:** runs only when the repository variable `E2E_ENABLED` is `true`. It needs the **secrets** `CLERK_SECRET_KEY` (development `sk_test_` key) and `CONVEX_DEV_DEPLOY_KEY` (a deploy key for the development deployment, from Convex dashboard → Settings → Deploy keys). It builds the app, runs the journeys against `pnpm start`, and uploads the Playwright report when it fails. Only one E2E run happens at a time, because every run shares the development deployment.
