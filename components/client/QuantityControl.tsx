"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_ITEM_QUANTITY } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function QuantityControl({
  productId,
  productName,
  stock,
  size = "default",
  className,
}: {
  productId: Id<"products">;
  productName: string;
  stock: bigint;
  size?: "default" | "lg";
  className?: string;
}) {
  const { status, quantityOf, isPending, setQuantity } = useCart();
  const quantity = quantityOf(productId);
  const max = Math.max(0, Math.min(Number(MAX_ITEM_QUANTITY), Number(stock)));
  const busy = status === "loading" || isPending(productId);
  const height = size === "lg" ? "h-10" : "h-8";

  if (quantity === 0) {
    const outOfStock = max === 0;
    return (
      <Button
        className={cn(height, "w-full", className)}
        variant={outOfStock ? "secondary" : "default"}
        disabled={outOfStock || busy}
        onClick={() => void setQuantity(productId, 1)}
        aria-label={outOfStock ? `${productName} is out of stock` : `Add ${productName} to cart`}
      >
        {outOfStock ? "Out of stock" : (
          <>
            <PlusIcon aria-hidden />
            Add
          </>
        )}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Quantity of ${productName}`}
      aria-busy={busy || undefined}
      className={cn(
        "flex w-full items-center justify-between rounded-lg bg-primary text-primary-foreground",
        height,
        className
      )}
    >
      <button
        type="button"
        className="flex h-full w-9 items-center justify-center rounded-l-lg outline-none hover:bg-black/10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        onClick={() => void setQuantity(productId, quantity - 1)}
        disabled={busy}
        aria-label={quantity === 1 ? `Remove ${productName} from cart` : `Decrease quantity of ${productName}`}
      >
        <MinusIcon aria-hidden className="size-4" />
      </button>
      <span aria-live="polite" className="text-sm font-semibold tabular-nums">
        {quantity}
        <span className="sr-only"> in cart</span>
      </span>
      <button
        type="button"
        className="flex h-full w-9 items-center justify-center rounded-r-lg outline-none hover:bg-black/10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        onClick={() => void setQuantity(productId, quantity + 1)}
        disabled={busy || quantity >= max}
        aria-label={`Increase quantity of ${productName}`}
        title={quantity >= max ? `Maximum available: ${max}` : undefined}
      >
        <PlusIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
