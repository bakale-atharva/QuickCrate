import { expect, type Page } from "@playwright/test";
import { ADDRESS, PRODUCT } from "./env";

/** Empties the signed-in customer's cart so each journey starts clean. */
export async function emptyCart(page: Page) {
  await page.goto("/cart");
  const remove = page.getByRole("button", { name: /^(Remove|Decrease quantity of) / });
  await expect(
    page.getByRole("heading", { name: "Your cart is empty" }).or(remove.first())
  ).toBeVisible();
  // Quantity controls disable themselves while an update is in flight, so
  // wait for each one to settle before the next click.
  const busy = page.locator('[role="group"][aria-busy="true"]');
  while (await remove.count()) {
    await remove.first().click();
    await expect(busy).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
}

export async function addProductToCart(page: Page) {
  await page.goto(`/products/${PRODUCT.slug}`);
  await expect(page.getByRole("heading", { name: PRODUCT.name, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: `Add ${PRODUCT.name} to cart` }).click();
  await expect(page.getByRole("group", { name: `Quantity of ${PRODUCT.name}` })).toContainText(
    "1 in cart"
  );
  await expect(page.getByRole("link", { name: "Cart, 1 product" })).toBeVisible();
}

/** Checks out the current cart with cash on delivery and returns the order ID. */
export async function checkOut(page: Page) {
  await page.goto("/cart");
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  const deliverHere = page.getByRole("button", { name: "Deliver here" });
  const placeOrder = page.getByRole("button", { name: /^Place order · ₹/ });
  await expect(deliverHere.or(placeOrder)).toBeVisible();
  if (await deliverHere.isVisible()) {
    for (const [label, value] of Object.entries(ADDRESS)) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await deliverHere.click();
  }

  // The total on the button comes from the server-priced quote.
  await expect(placeOrder).toBeVisible();
  await expect(page.getByText("Cash on delivery", { exact: true })).toBeVisible();
  // The E2E customer has no QuickCrate Plus membership, so delivery is charged.
  const review = page.getByRole("complementary", { name: "3. Review your order" });
  const delivery = review
    .locator("dl > div")
    .filter({ has: page.getByText("Delivery", { exact: true }) });
  await expect(delivery.locator("dd")).toHaveText("₹49");
  await placeOrder.click();

  await expect(page).toHaveURL(/\/account\/orders\/[^/?]+\?placed=1/);
  await expect(page.getByRole("heading", { name: "Thanks! Your order is placed." })).toBeVisible();
  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  return orderId;
}
