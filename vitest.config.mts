import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    setupFiles: ["convex/test.setup.ts"],
    server: { deps: { inline: ["convex-test"] } },
    // Backend tests never reach real services: Clerk Billing is mocked and
    // webhooks are signed locally with this throwaway secret.
    env: {
      CLERK_FRONTEND_API_URL: "https://test.clerk.accounts.dev",
      CLERK_SECRET_KEY: "sk_test_backend_tests_only",
      CLERK_WEBHOOK_SIGNING_SECRET: "whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0",
    },
  },
});
