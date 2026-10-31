# Phase 0 baseline

Recorded 2026-10-31 for the development MVP.

- `pnpm run check` generates Next.js route types, runs TypeScript without emitting files, and runs ESLint. It passed with no type errors or lint errors and nine existing lint warnings: five unused imports on the unfinished homepage and four unused disable directives in generated Convex files.
- `@clerk/nextjs` is pinned to 7.9.22, the version already resolved by the lockfile. Reassess the version when implementing Billing.
- Clerk's existing QuickCrate development instance was reachable and the CLI's existing authentication was valid. The installed CLI was 3.4.1; `pnpm dlx clerk@latest --version` invoked 4.1.0. No new application was created.
- Convex's configured development deployment is `tangible-snail-264`; a read-only `convex data --deployment dev` returned the `users` table. No deployment was performed.

The homepage and schema are preserved unfinished work, not the completed storefront or M1 schema. Backend tests, end-to-end tests, and CI are scheduled for later phases.
