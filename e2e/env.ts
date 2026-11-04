import path from "node:path";

export const AUTH_DIR = path.join(__dirname, ".auth");
export const CUSTOMER_STATE = path.join(AUTH_DIR, "customer.json");
export const ADMIN_STATE = path.join(AUTH_DIR, "admin.json");

// `+clerk_test` addresses are Clerk development test identities: they never
// receive email and can only exist on development instances.
export const CUSTOMER_EMAIL =
  process.env.E2E_CUSTOMER_EMAIL ?? "quickcrate-e2e-customer+clerk_test@example.com";
export const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL ?? "quickcrate-e2e-admin+clerk_test@example.com";

/** A development fixture product (see convex/fixtures.ts). */
export const PRODUCT = {
  slug: "farm-fresh-whole-milk-1l",
  name: "Farm Fresh Whole Milk 1L",
};

export const ADDRESS = {
  "Full name": "E2E Customer",
  "Address line 1": "1 Test Street",
  City: "Bengaluru",
  State: "Karnataka",
  "PIN code": "560001",
  Country: "India",
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to run end-to-end tests.`);
  }
  return value;
}

/** Refuses to run against anything but a Clerk development instance. */
export function assertDevelopmentKeys() {
  const secret = requireEnv("CLERK_SECRET_KEY");
  const publishable = requireEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!secret.startsWith("sk_test_") || !publishable.startsWith("pk_test_")) {
    throw new Error("End-to-end tests only run against Clerk development keys (sk_test_/pk_test_).");
  }
  requireEnv("NEXT_PUBLIC_CONVEX_URL");
}
