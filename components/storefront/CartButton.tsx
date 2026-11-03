"use client";

import { ShoppingBasketIcon } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CartButton() {
  const { count, status } = useCart();
  const label =
    status === "loading" ? "Cart" : `Cart, ${count} ${count === 1 ? "product" : "products"}`;

  return (
    <Link
      href="/cart"
      aria-label={label}
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "relative gap-2")}
    >
      <ShoppingBasketIcon aria-hidden />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span
          aria-hidden
          className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
