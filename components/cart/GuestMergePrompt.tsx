"use client";

import { ShoppingBasketIcon } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";

// Shown after sign-in when items were added while signed out. Nothing merges
// until the customer explicitly chooses to add or discard them.
export default function GuestMergePrompt() {
  const { pendingGuestItems, merging, mergeGuestCart, discardGuestCart } = useCart();
  if (pendingGuestItems === 0) return null;

  return (
    <section
      aria-labelledby="guest-merge-title"
      className="border-b bg-primary/5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <ShoppingBasketIcon aria-hidden className="hidden size-5 shrink-0 text-primary sm:block" />
        <div className="flex-1 text-sm">
          <h2 id="guest-merge-title" className="font-medium">
            You added {pendingGuestItems} {pendingGuestItems === 1 ? "product" : "products"} before signing in
          </h2>
          <p className="text-muted-foreground">
            Add them to your account cart? Quantities combine with anything already there.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={discardGuestCart} disabled={merging}>
            Discard
          </Button>
          <Button onClick={() => void mergeGuestCart()} disabled={merging}>
            {merging ? "Adding…" : "Add to my cart"}
          </Button>
        </div>
      </div>
    </section>
  );
}
