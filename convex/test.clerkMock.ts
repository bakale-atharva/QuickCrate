import { vi } from "vitest";

// Clerk Billing is the only external service the backend calls. Every test
// controls its responses through this mock; nothing reaches Clerk.
export const clerkBilling = {
  getUserBillingSubscription: vi.fn(),
};
