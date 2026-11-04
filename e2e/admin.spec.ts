import { expect, test } from "@playwright/test";
import { ADMIN_STATE, CUSTOMER_STATE, PRODUCT } from "./env";
import { addProductToCart, checkOut, emptyCart } from "./journeys";

test("admin fulfills a customer's order through delivery with COD confirmation", async ({
  browser,
}) => {
  const customerContext = await browser.newContext({ storageState: CUSTOMER_STATE });
  const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
  const customer = await customerContext.newPage();
  const admin = await adminContext.newPage();

  await emptyCart(customer);
  await addProductToCart(customer);
  const orderId = await checkOut(customer);

  await admin.goto("/admin/orders");
  await admin.getByRole("button", { name: "Placed", exact: true }).click();
  await admin.locator(`a[href="/admin/orders/${orderId}"]`).click();
  await expect(admin.getByRole("heading", { level: 1 })).toContainText("Order #");

  for (const action of ["Confirm order", "Start packing", "Send out for delivery"]) {
    await admin.getByRole("button", { name: action }).click();
    await expect(admin.getByRole("button", { name: action })).toHaveCount(0);
  }

  // Delivery cannot be recorded until cash collection is confirmed.
  await admin.getByRole("button", { name: "Mark delivered" }).click();
  await expect(
    admin.getByText("Confirm the cash was collected before marking the order delivered.")
  ).toBeVisible();
  await admin.getByRole("checkbox", { name: /was collected in cash/ }).check();
  await admin.getByRole("button", { name: "Mark delivered" }).click();
  await expect(admin.getByText("Cash collected", { exact: true })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Mark delivered" })).toHaveCount(0);

  // The customer sees the delivered status and can no longer cancel.
  await customer.goto(`/account/orders/${orderId}`);
  await expect(customer.getByText("Delivered").first()).toBeVisible();
  await expect(customer.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

  await customerContext.close();
  await adminContext.close();
});

test.describe("admin catalog and customers", () => {
  test.use({ storageState: ADMIN_STATE });

  test("shows the product's stock history", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByRole("link", { name: new RegExp(PRODUCT.name) }).first().click();
    await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/);
    await expect(page.getByText(/stock/i).first()).toBeVisible();
  });

  test("finds the E2E customer", async ({ page }) => {
    await page.goto("/admin/customers");
    await page.getByRole("searchbox").or(page.getByRole("textbox")).first().fill("quickcrate-e2e-customer");
    await expect(page.getByText(/quickcrate-e2e-customer/).first()).toBeVisible();
  });
});
