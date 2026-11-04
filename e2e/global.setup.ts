import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { chromium, type FullConfig } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_STATE,
  AUTH_DIR,
  CUSTOMER_EMAIL,
  CUSTOMER_STATE,
  assertDevelopmentKeys,
} from "./env";

/** Finds or creates a passwordless Clerk test user and returns its ID. */
async function ensureClerkUser(email: string, firstName: string) {
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const existing = await client.users.getUserList({ emailAddress: [email] });
  if (existing.data[0]) return existing.data[0].id;
  const user = await client.users.createUser({
    emailAddress: [email],
    firstName,
    lastName: "E2E",
    skipPasswordRequirement: true,
    skipLegalChecks: true,
  });
  return user.id;
}

/** Runs a Convex function against the configured development deployment. */
function convexRun(fn: string, args: Record<string, unknown>) {
  execFileSync("pnpm", ["exec", "convex", "run", fn, JSON.stringify(args)], {
    stdio: "pipe",
    env: process.env,
  });
}

async function signInAndSave(baseURL: string, email: string, statePath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  // Loading the storefront signed in runs users.initialize, which creates the
  // Convex profile for this Clerk user.
  await page.goto("/account");
  await page.getByRole("link", { name: "Orders" }).first().waitFor();
  await page.context().storageState({ path: statePath });
  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  assertDevelopmentKeys();
  await clerkSetup();

  const baseURL = config.projects[0].use.baseURL!;
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Development fixtures are idempotent and keep existing stock levels.
  convexRun("fixtures:seedInternalFixtures", {});

  await ensureClerkUser(CUSTOMER_EMAIL, "Customer");
  const adminId = await ensureClerkUser(ADMIN_EMAIL, "Admin");

  await signInAndSave(baseURL, CUSTOMER_EMAIL, CUSTOMER_STATE);
  await signInAndSave(baseURL, ADMIN_EMAIL, ADMIN_STATE);

  // Admins are provisioned only through the internal operation, with an
  // explicit Clerk user ID; there is no public way to grant the role.
  convexRun("users:bootstrapAdmin", { clerkUserId: adminId });
}
