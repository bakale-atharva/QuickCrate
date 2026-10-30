# QuickCrate

Your friendly neighborhood grocery, online. QuickCrate is a grocery app in progress, inspired by [Sonny Sangha's Papamart](https://github.com/sonnysangha/papamart).

The app uses Next.js and React for the frontend, Clerk for authentication, and Convex for its backend. The current homepage is still the Next.js starter page.

## Getting started

Install dependencies with pnpm:

```bash
pnpm install
```

Configure a Clerk application and a Convex deployment. Add your Clerk publishable and secret keys and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Configure Clerk's Convex JWT template and set `CLERK_FRONTEND_API_URL` on the Convex deployment for authentication.

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

The SVG app icon is available at `app/icon.svg` and can also be reused as a logo.
