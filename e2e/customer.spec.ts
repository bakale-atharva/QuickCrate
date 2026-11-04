import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { CUSTOMER_EMAIL, CUSTOMER_STATE, PRODUCT } from "./env";
import { addProductToCart, checkOut, emptyCart } from "./journeys";

test.describe("guest shopper", () => {
  test("browses, searches, and keeps a cart without signing in", async ({ page }) => {
    await page.goto("/");
    // The header renders separate mobile and desktop search fields.
    await page
      .getByPlaceholder("Search milk, rice, apples…")
      .filter({ visible: true })
      .fill("milk");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=milk/);
    await expect(page.getByRole("link", { name: new RegExp(PRODUCT.name) }).first()).toBeVisible();

    await addProductToCart(page);
    await page.reload();
    await expect(page.getByRole("link", { name: "Cart, 1 product" })).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("button", { name: "Sign in to check out" })).toBeVisible();
  });

  test("checkout and account pages require sign-in", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /Sign in/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Place order/ })).toHaveCount(0);
  });

  test("merges the guest cart after an acknowledged sign-in", async ({ page }) => {
    // Start from an empty account cart.
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: CUSTOMER_EMAIL });
    await emptyCart(page);
    await page.goto("/");
    await clerk.signOut({ page });

    await addProductToCart(page);
    await clerk.signIn({ page, emailAddress: CUSTOMER_EMAIL });
    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "You added 1 product before signing in" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Add to my cart" }).click();
    await expect(page.getByText("Items added to your cart")).toBeVisible();
    await expect(page.getByRole("link", { name: "Cart, 1 product" })).toBeVisible();
    await emptyCart(page);
  });
});

test.describe("signed-in customer", () => {
  test.use({ storageState: CUSTOMER_STATE });

  test("places a cash-on-delivery order and cancels it while placed", async ({ page }) => {
    await emptyCart(page);
    await addProductToCart(page);
    const orderId = await checkOut(page);

    // Placing the order cleared the cart.
    await expect(page.getByRole("link", { name: "Cart, 0 products" })).toBeVisible();

    await page.goto("/account/orders");
    await expect(page.locator(`a[href="/account/orders/${orderId}"]`)).toBeVisible();

    await page.goto(`/account/orders/${orderId}`);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("button", { name: "Yes, cancel order" }).click();
    await expect(page.getByText("Order cancelled", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  });

  test("saves favorites", async ({ page }) => {
    await page.goto(`/products/${PRODUCT.slug}`);
    const favorite = page.getByRole("button", { name: /favorites/i });
    await expect(favorite).toBeVisible();
    const before = await favorite.getAttribute("aria-pressed");
    await favorite.click();
    await expect(favorite).not.toHaveAttribute("aria-pressed", before ?? "");
    // Restore the original state for the next run.
    await favorite.click();
    await expect(favorite).toHaveAttribute("aria-pressed", before ?? "false");
  });

  test("cannot open the admin area", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "You don't have access" })).toBeVisible();
  });
});
