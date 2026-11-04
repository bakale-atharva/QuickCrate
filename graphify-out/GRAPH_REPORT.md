# Graph Report - QuickCrate  (2026-11-04)

## Corpus Check
- Corpus is ~42,623 words - fits in a single context window. You may not need a graph.

## Summary
- 781 nodes · 2211 edges · 31 communities (29 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.89)
- Token cost: 127,693 input · 0 output

## Community Hubs (Navigation)
- Account Pages and Views
- Admin Detail Views and Actions
- Cart and App Shell
- Admin Shell and Pages
- Project Plan and Milestones
- CI Workflow
- Backend Test Suite
- Dev Tooling and Lint
- Catalog Backend and Admin Auth
- Addresses and Cart Backend
- Checkout UI Flow
- shadcn Component Config
- Runtime Dependencies
- Favorites and Products API
- Root TypeScript Config
- Membership and Billing Webhooks
- Orders Backend
- Convex TypeScript Config
- E2E Environment Setup
- Dev Fixtures Seeding
- Catalog Browse and Search
- Checkout Quote and Placement
- E2E User Journeys
- Package Scripts
- Clerk Webhook HTTP Router
- Identity and Access Guards
- Account Navigation
- Playwright Config
- pnpm Workspace Config
- Convex Guidelines Rule
- Graphify Usage Rules

## God Nodes (most connected - your core abstractions)
1. `Skeleton()` - 69 edges
2. `next` - 55 edges
3. `Button()` - 53 edges
4. `errorMessage()` - 49 edges
5. `convex` - 44 edges
6. `react` - 37 edges
7. `buttonVariants` - 34 edges
8. `requireUser()` - 33 edges
9. `requireAdmin()` - 33 edges
10. `lucide-react` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Clerk Webhooks (user + billing events)` --semantically_similar_to--> `Clerk Webhook Endpoint (/clerk-webhook)`  [INFERRED] [semantically similar]
  docs/development.md → convex/README.md
- `run()` --calls--> `errorMessage()`  [EXTRACTED]
  components/account/AddressesView.tsx → lib/errors.ts
- `AddressesPage()` --calls--> `AddressesView()`  [EXTRACTED]
  app/(client)/account/addresses/page.tsx → components/account/AddressesView.tsx
- `FavoritesPage()` --calls--> `FavoritesView()`  [EXTRACTED]
  app/(client)/account/favorites/page.tsx → components/account/FavoritesView.tsx
- `OrdersPage()` --calls--> `OrdersView()`  [EXTRACTED]
  app/(client)/account/orders/page.tsx → components/account/OrdersView.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **QuickCrate Phased Milestones M0-M8** — _claude_plans_plan_m0_baseline, _claude_plans_plan_m1_schema_identity_auth, _claude_plans_plan_m2_catalog_shopping, _claude_plans_plan_m3_checkout_orders, _claude_plans_plan_m4_backend_acceptance, _claude_plans_plan_m5_storefront, _claude_plans_plan_m6_customer_checkout, _claude_plans_plan_m7_admin_interface, _claude_plans_plan_m8_verification [EXTRACTED 1.00]
- **Checkout, Membership and Order Placement Flow** — _claude_plans_plan_checkout_quote, _claude_plans_plan_checkout_placeorder, _claude_plans_plan_membership_eligibility, _claude_plans_plan_order_lifecycle, docs_development_quickcrate_plus [INFERRED 0.85]
- **Verification Stack (backend tests, E2E, CI, fixtures)** — docs_development_backend_tests, docs_development_e2e_tests, docs_development_ci, docs_development_fixtures [INFERRED 0.85]

## Communities (31 total, 2 thin omitted)

### Community 0 - "Account Pages and Views"
Cohesion: 0.07
Nodes (59): AddressesPage(), metadata, FavoritesPage(), metadata, metadata, OrdersPage(), StorefrontError(), HomePage() (+51 more)

### Community 1 - "Admin Detail Views and Actions"
Cohesion: 0.07
Nodes (68): metadata, NewProductPage(), AddressForm(), handleSubmit(), AccountFavoriteButton(), handleClick(), RemoveFavorite(), handleRemove() (+60 more)

### Community 2 - "Cart and App Shell"
Cohesion: 0.05
Nodes (54): CartPage(), metadata, StorefrontLayout(), geistMono, geistSans, metadata, RootLayout(), AccountContext (+46 more)

### Community 3 - "Admin Shell and Pages"
Cohesion: 0.07
Nodes (41): AdminCategoriesPage(), metadata, AdminCustomersPage(), metadata, AdminCustomerPage(), metadata, AdminLayout(), metadata (+33 more)

### Community 4 - "Project Plan and Milestones"
Cohesion: 0.07
Nodes (37): checkout.placeOrder({ quoteId, idempotencyKey }), checkout.quote (five-minute persisted quote), Guest Cart Merge after Sign-in, Linear Project: QuickCrate - Grocery Shopping MVP (Dev/ATH), M0: Baseline and Linear Setup, M1: Schema, Identity, and Authorization, M2: Catalog, Inventory, and Shopping APIs, M3: Membership, Checkout, and Orders (+29 more)

### Community 5 - "CI Workflow"
Cohesion: 0.06
Nodes (40): env, name, runs-on, steps, concurrency, cancel-in-progress, group, concurrency (+32 more)

### Community 6 - "Backend Test Suite"
Cohesion: 0.15
Nodes (21): placedOrderScenario(), quoteWith(), clerkBilling, Account, ADDRESS, billing, countRows(), createProduct() (+13 more)

### Community 7 - "Dev Tooling and Lint"
Cohesion: 0.09
Nodes (31): eslintConfig, devDependencies, @clerk/testing@2.2.52, convex-test@0.0.67, @edge-runtime/vm@5.0.0, eslint@10.13.0, eslint-config-next@16.4.3, @playwright/test@1.64.1 (+23 more)

### Community 8 - "Catalog Backend and Admin Auth"
Cohesion: 0.11
Nodes (25): requireAdmin(), archive, create, getById, getBySlug, list, listAllAdmin, normalizeSlug() (+17 more)

### Community 9 - "Addresses and Cart Backend"
Cohesion: 0.20
Nodes (21): cleanAddress(), create, deleteAddress, getById, getDefault, list, setDefault, update (+13 more)

### Community 10 - "Checkout UI Flow"
Cohesion: 0.19
Nodes (18): CheckoutPage(), metadata, Account, AddressOption(), Checkout(), startNewCheckout(), submit(), CheckoutSkeleton() (+10 more)

### Community 11 - "shadcn Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @base-ui/react@^1.9.0, class-variance-authority@^0.7.1, @clerk/nextjs@7.9.22, cn@^0.5.0, convex@^1.48.0, lucide-react@^1.64.0, next@16.4.3 (+13 more)

### Community 13 - "Favorites and Products API"
Cohesion: 0.16
Nodes (14): isFavorite, list, toggle, create, getById, getBySlug, list, normalizeSku() (+6 more)

### Community 14 - "Root TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 15 - "Membership and Billing Webhooks"
Cohesion: 0.12
Nodes (16): applyMembershipUpdate, BillingSubscriptionResponse, getMyMembership, getUserByClerkId, getUserForRefresh, handleBillingWebhook, isMembershipActiveAndEligible(), recordWebhookReceipt (+8 more)

### Community 16 - "Orders Backend"
Cohesion: 0.17
Nodes (13): adminGetOrder, adminGetOrderHistory, adminGetPermittedTransitions, adminListOrders, adminListOrdersPaginated, adminUpdateStatus, executePlaceOrder, findOrderByUserAndKey (+5 more)

### Community 17 - "Convex TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+7 more)

### Community 18 - "E2E Environment Setup"
Cohesion: 0.21
Nodes (11): ADDRESS, ADMIN_EMAIL, ADMIN_STATE, assertDevelopmentKeys(), AUTH_DIR, CUSTOMER_EMAIL, requireEnv(), convexRun() (+3 more)

### Community 19 - "Dev Fixtures Seeding"
Cohesion: 0.15
Nodes (11): attachFixtureImages, CategoryFixture, executeSeeding(), FIXTURE_CATEGORIES, FIXTURE_IMAGE_URLS, FIXTURE_PRODUCTS, listFixtureSkusWithoutImage, ProductFixture (+3 more)

### Community 20 - "Catalog Browse and Search"
Cohesion: 0.27
Nodes (9): CategoryPage(), metadata, metadata, SearchPage(), CatalogProduct, ProductGrid(), ProductGridSkeleton(), CategoryView() (+1 more)

### Community 21 - "Checkout Quote and Placement"
Cohesion: 0.21
Nodes (10): persistQuote, placeOrder, quote, QuoteAddress, QuoteItemSnapshot, snapshotValidator, validateQuoteBeforePlacement, DELIVERY_FEE_PAISE (+2 more)

### Community 22 - "E2E User Journeys"
Cohesion: 0.35
Nodes (6): CUSTOMER_STATE, PRODUCT, addProductToCart(), checkOut(), emptyCart(), @playwright/test

### Community 23 - "Package Scripts"
Cohesion: 0.18
Nodes (11): scripts, backend, build, check, frontend, lint, start, test (+3 more)

### Community 24 - "Clerk Webhook HTTP Router"
Cohesion: 0.22
Nodes (7): ClerkWebhookEvent, http, WebhookBillingData, WebhookEmailAddress, WebhookUserData, @clerk/backend@3.26.4, @clerk/backend

### Community 25 - "Identity and Access Guards"
Cohesion: 0.43
Nodes (3): Context, requireActiveUser(), requireAdmin()

### Community 26 - "Account Navigation"
Cohesion: 0.67
Nodes (4): AccountLayout(), AccountNav(), AccountNavLinks(), LINKS

### Community 27 - "Playwright Config"
Cohesion: 0.50
Nodes (3): dotenv@^18.0.9, PORT, dotenv

### Community 28 - "pnpm Workspace Config"
Cohesion: 0.50
Nodes (3): allowBuilds, esbuild, unrs-resolver

## Knowledge Gaps
- **13 isolated node(s):** `Linear Project: QuickCrate - Grocery Shopping MVP (Dev/ATH)`, `M6: Checkout and Customer Account`, `M7: Admin Interface`, `Order Lifecycle (placed -> confirmed -> packing -> out_for_delivery -> delivered)`, `Next.js Agent Feedback Pass (experimental.agentFeedback)` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 232 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `convex` connect `Account Pages and Views` to `Admin Detail Views and Actions`, `Cart and App Shell`, `Dev Tooling and Lint`, `Catalog Backend and Admin Auth`, `Addresses and Cart Backend`, `Checkout UI Flow`, `Runtime Dependencies`, `Favorites and Products API`, `Membership and Billing Webhooks`, `Orders Backend`, `Dev Fixtures Seeding`, `Catalog Browse and Search`, `Checkout Quote and Placement`, `E2E User Journeys`, `Clerk Webhook HTTP Router`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **What connects `Linear Project: QuickCrate - Grocery Shopping MVP (Dev/ATH)`, `M6: Checkout and Customer Account`, `M7: Admin Interface` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Account Pages and Views` be split into smaller, more focused modules?**
  _Cohesion score 0.07159231176159407 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Account Pages and Views` to `Admin Detail Views and Actions`, `Cart and App Shell`, `Admin Shell and Pages`, `Dev Tooling and Lint`, `Checkout UI Flow`, `Runtime Dependencies`, `Catalog Browse and Search`, `Account Navigation`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Should `Admin Detail Views and Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06740506329113924 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Admin Shell and Pages` to `Account Pages and Views`, `Admin Detail Views and Actions`, `Cart and App Shell`, `Dev Tooling and Lint`, `Checkout UI Flow`, `Runtime Dependencies`, `Catalog Browse and Search`, `Account Navigation`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `Cart and App Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.05251141552511415 - nodes in this community are weakly interconnected._