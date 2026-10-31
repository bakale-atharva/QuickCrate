# QuickCrate MVP — Backend First, Phase-Based Git Workflow

## Summary and Agreed Scope

Build one Next.js app with a customer storefront and protected `/admin` area using the existing stack: Next.js 16.4, React 19.3, TypeScript, Tailwind 4, shadcn/Base UI, Clerk 7, Convex, and pnpm.

Keep the design simple and responsive. Prioritize correct functionality:

- Single store, one inventory pool, fixed-size packs as separate products.
- Public browsing; persistent guest cart merged after sign-in.
- Authentication required for checkout and favorites.
- INR tax-inclusive groceries, ₹49 delivery, free delivery for members.
- Cash on delivery and a clearly labeled $4.99/month Clerk development membership.
- Admin catalog, inventory, customer, and order management.
- Development/test MVP; production payments, delivery slots, variable-weight pricing, substitutions, coupons, and returns are excluded.

## Git and Review Workflow

**Each milestone M0–M8 is a separate phase with its own branch and pull request. Use the existing checkout; do not create worktrees.**

1. Start each phase from the updated repository default branch after the preceding phase’s PR has merged.
2. Create `codex/phase-N-<description>`.
3. Implement only that phase, with focused commits and the relevant Linear issue references.
4. Run the phase’s verification checks and review the final diff.
5. Open a PR describing the changes, linked issues, test results, and any limitations.
6. **Wait for your explicit approval before merging.** Passing checks or an automated review do not authorize merging.
7. Address requested changes on the same branch and rerun affected checks. Material changes after approval require renewed approval.
8. After approval, merge the PR, update the local default branch, and begin the next phase.

Do not push implementation directly to the default branch, auto-merge, or combine multiple phases into one PR. Mark Linear issues **In Review** when their PR opens and **Done** after it merges.

## Phase 0 — Baseline and Linear Setup

**Milestone M0 · Branch `codex/phase-0-baseline`**

Create **“QuickCrate — Grocery Shopping MVP”** in the Linear **Dev / ATH** team.

- **P0-01 — Preserve and commit the baseline.** Review and commit the existing homepage, schema, and generated data-model changes before replacing unfinished work. Exclude secrets and build artifacts.
- **P0-02 — Create the Linear project.** Add milestones M0–M8, the issues below, dependency links, and a project document containing this plan and Git workflow.
- **P0-03 — Verify development services.** Reauthenticate Clerk CLI, update or invoke its current version, and confirm the existing Clerk and Convex development targets without creating replacement projects.
- **P0-04 — Establish baseline checks.** Add repeatable validation scripts, pin Clerk dependencies used for Billing, and record current check results. The previous inspection found passing TypeScript after route generation and nine lint warnings without errors.

Each Linear issue includes acceptance criteria, implementation boundaries, verification steps, priority, and dependencies. Use `backend`, `frontend`, `implementation`, and `verification` labels. Leave scheduling and assignees unset.

**Execution order:** M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8, with approval and merge between phases.

## Part 1 — Backend

### M1: Schema, Identity, and Authorization
**Branch `codex/phase-1-backend-foundation`**

Testing constraint: Do not use Vitest or add a test harness for this phase. Verify with the existing lint, type-check, and build checks.

- **BE-01:** Define users, addresses, categories, products, stock movements, carts/items, favorites, checkout quotes, orders/items/events, memberships, webhook receipts, and customer notes. Use indexed ownership lookups, pagination, integer paise, and integer quantities.
- **BE-02:** Enforce customer/admin authorization in Convex. Derive identity from authentication; bootstrap admins through an internal operation with an explicit Clerk user ID. No public role-changing API or first-user promotion.
- **BE-03:** Synchronize Clerk profiles using authenticated initialization and verified, deduplicated lifecycle webhooks. Prevent stale events from restoring deleted accounts; preserve historical orders.

Retain bare `clerkMiddleware()` and protect server resources individually. Follow current Clerk and installed Next.js Cache Components guidance; do not introduce deprecated route-matcher authentication.

### M2: Catalog, Inventory, and Shopping APIs
**Branch `codex/phase-2-catalog-shopping`**

- **BE-04:** Implement category/product CRUD and archival, unique SKUs/slugs, fixed pack labels, prices, and public active-only catalog queries.
- **BE-05:** Add validated admin image uploads through Convex storage and audited inventory adjustments. Prevent negative stock and stale edits overwriting intervening purchases.
- **BE-06:** Implement indexed product search and category browsing with bounded results.
- **BE-07:** Implement persistent carts and authenticated guest merging. Merge quantities additively, deduplicate merge retries, and report unavailable or adjusted items. Limit carts to 100 products and quantities to 99 per product.
- **BE-08:** Implement idempotent favorites and owned address CRUD with a default address.

Cart additions do not reserve stock. Unavailable items remain visible with an explanation.

### M3: Membership, Checkout, and Orders
**Branch `codex/phase-3-checkout-orders`**

- **BE-09:** Configure the Clerk development user plan `quickcrate_plus` with `free_shipping`, $4.99 monthly pricing, and no trial.
- **BE-10:** Verify membership webhooks through the Clerk Backend SDK, deduplicate deliveries, refresh authoritative state, and fence overlapping refreshes against stale writes.
- **BE-11:** Implement an authenticated Convex checkout action producing a five-minute persisted quote with cart revision, address/item snapshots, verified membership, delivery fee, and total.
- **BE-12:** Implement idempotent COD placement through a Convex action and internal transactional mutation.
- **BE-13:** Implement audited fulfillment transitions and eligible cancellation with exactly-once restocking.

Public checkout interfaces are `checkout.quote` and `checkout.placeOrder({ quoteId, idempotencyKey })`. Customers never supply authoritative prices, roles, entitlement flags, or acting-user identities.

Before contacting Clerk, placement checks for an existing order using the authenticated customer and idempotency key. The final mutation repeats that check, validates stock and quote/cart consistency, and atomically creates the order, deducts inventory, records history, and clears the matching cart.

Changed prices, cart contents, delivery fees, or expired quotes require renewed review. Failures cause no partial writes. Lost-response retries return the original order even after cart clearing, quote expiry, or a subsequent Clerk outage.

Refresh membership at submission. Active membership and canceled membership within its paid period qualify; past-due, incomplete, expired, and ended subscriptions do not. Verification outages produce retryable errors rather than silently charging delivery.

Order lifecycle:

`placed → confirmed → packing → out_for_delivery → delivered`

Customers cancel only while `placed`; admins cancel before dispatch. Delivery requires confirming COD collection. Terminal states cannot transition again. Order snapshots remain immutable.

### M4: Admin APIs and Backend Acceptance
**Branch `codex/phase-4-backend-acceptance`**

- **BE-14:** Add paginated admin order lists, filters, details, permitted transitions, and history.
- **BE-15:** Add customer search, order/membership visibility, internal notes, and ordering suspension. Suspended customers retain account and existing-order access.
- **BE-16:** Add idempotent development fixtures and comprehensive backend tests.
- **BE-17:** Verify the deployed development backend, including competing purchases of the final stock unit.

**Gate:** backend tests, type checking, development integration checks, and the approved M4 PR must pass before frontend implementation.

## Part 2 — Frontend

### M5: Storefront and Cart
**Branch `codex/phase-5-storefront`**

- **FE-01:** Build separate storefront/admin shells with Geist, neutral surfaces, one accent, responsive navigation, search, account access, and cart count.
- **FE-02:** Build home, category, search, and product-detail pages with URL-based search/filter state, prices, pack sizes, availability, and quantity controls.
- **FE-03:** Implement local-storage guest carts, cross-tab synchronization, acknowledged sign-in merging, and reactive authenticated carts. Prevent account switching from exposing another user’s cart.

### M6: Checkout and Customer Account
**Branch `codex/phase-6-customer-checkout`**

- **FE-04:** Build address selection, server-priced review, COD submission, confirmation, and retry/error handling. Preserve submission idempotency keys across retries.
- **FE-05:** Build favorites, order history/details, status history, and eligible cancellation.
- **FE-06:** Integrate Clerk `PricingTable` and `UserProfile`, label USD test membership clearly, and refresh shipping quotes after subscription changes.

### M7: Admin Interface
**Branch `codex/phase-7-admin`**

- **FE-07:** Build product/category management, image uploads, archival, stock adjustments, and stock history.
- **FE-08:** Build order filtering, fulfillment controls, delivery details, COD confirmation, and cancellation.
- **FE-09:** Build customer search/details, internal notes, membership visibility, and suspend/reinstate controls.

All screens require loading, empty, error, and success states; accessible forms, keyboard navigation, and usable mobile layouts.

### M8: End-to-End Verification and Handoff
**Branch `codex/phase-8-verification`**

- **QA-01:** Add Playwright customer/admin journeys using Clerk testing utilities.
- **QA-02:** Verify retries, cart races, stock contention, membership expiry, webhook failures, and direct unauthorized API access.
- **QA-03:** Complete CI and document development setup, fixtures, admin provisioning, webhook configuration, and test membership.

Required checks include route generation, TypeScript, lint, backend tests, production build, and configured end-to-end tests.

Acceptance must prove that duplicate operations cannot duplicate orders or stock changes; concurrent purchases cannot oversell; customer data remains isolated; manipulated client inputs cannot change authorization or totals; and historical orders survive catalog edits.

Use the appropriate installed service skills and refresh Context7 documentation at integration milestones. No additional plugin installation is currently required; add testing and backend helper packages during their relevant implementation phases.
