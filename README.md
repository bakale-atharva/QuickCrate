# QuickCrate

Your friendly neighborhood grocery, online. QuickCrate is a grocery app in progress, inspired by [Sonny Sangha's Papamart](https://github.com/sonnysangha/papamart).

The app uses Next.js and React for the frontend, Clerk for authentication and test billing, and Convex for its backend. It has a customer storefront (catalog, persistent cart, cash-on-delivery checkout, orders, favorites, and a test membership with free delivery) and a protected `/admin` area for the catalog, inventory, orders, and customers.

This is a development/test MVP: it runs on a Clerk development instance and a Convex development deployment.

## Getting started

Install dependencies with pnpm:

```bash
pnpm install
```

See [docs/development.md](docs/development.md) for environment variables, fixtures, admin provisioning, webhook setup, the test membership, tests, and CI.

Start the backend and frontend in separate terminals:

```bash
pnpm backend
```

```bash
pnpm frontend
```

Open [http://localhost:3000](http://localhost:3000).

## Other commands

- `pnpm build` builds the production app.
- `pnpm start` starts the production server after a build.
- `pnpm lint` runs ESLint.
- `pnpm check` runs type checks, lint, and the backend tests.
- `pnpm test` runs the backend tests.
- `pnpm test:e2e` runs the Playwright journeys against the development deployment.

The SVG app icon is available at `app/icon.svg` and can also be reused as a logo.
