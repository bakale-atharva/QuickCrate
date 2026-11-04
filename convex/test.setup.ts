import { beforeEach, vi } from "vitest";
import { clerkBilling } from "./test.clerkMock";

vi.mock("@clerk/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/backend")>();
  const { clerkBilling: billing } = await import("./test.clerkMock");
  return {
    ...actual,
    createClerkClient: () => ({ billing }),
  };
});

beforeEach(() => {
  clerkBilling.getUserBillingSubscription.mockReset();
  // Default: the customer has no subscription (Clerk answers 404).
  clerkBilling.getUserBillingSubscription.mockRejectedValue({
    status: 404,
    message: "Not Found",
  });
});
