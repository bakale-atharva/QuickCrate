"use client";

import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ShoppingBasketIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import ProductImage from "@/components/client/ProductImage";
import QuantityControl from "@/components/client/QuantityControl";
import { useAccount } from "@/components/AccountProvider";
import { useCart } from "@/components/cart/CartProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatPaise } from "@/lib/format";
import type { GuestCartItem } from "@/lib/guest-cart";

type Line = {
  productId: Id<"products">;
  name: string;
  slug: string;
  packLabel: string;
  pricePaise: bigint;
  stock: bigint;
  imageUrl: string | null;
  quantity: number;
  available: boolean;
  explanation?: string;
};

export default function CartView() {
  const cart = useCart();
  const account = useAccount();

  if (account.status === "error") {
    return (
      <p role="alert" className="rounded-xl border p-6 text-sm">
        We couldn&apos;t load your account. Refresh the page or sign in again.
      </p>
    );
  }

  if (cart.status === "loading" || (cart.status === "account" && cart.accountCart === undefined)) {
    return <CartSkeleton />;
  }

  if (cart.status === "guest") {
    if (cart.guestCart.items.length === 0) return <EmptyCart />;
    return (
      <CartLayout
        lines={cart.guestCart.items.map((item) => (
          <GuestLine key={item.productId} item={item} />
        ))}
        summary={<GuestSummary items={cart.guestCart.items} />}
      />
    );
  }

  const accountCart = cart.accountCart!;
  if (accountCart.items.length === 0) return <EmptyCart />;
  const unavailable = accountCart.items.filter((item) => !item.available).length;
  const suspended = account.status === "ready" && account.me.suspended === true;

  return (
    <CartLayout
      lines={accountCart.items.map((item) => (
        <CartLine
          key={item.cartItemId}
          line={{ ...item, quantity: Number(item.quantity) }}
        />
      ))}
      summary={
        <Summary subtotalPaise={accountCart.subtotalPaise} unavailable={unavailable}>
          {suspended || unavailable > 0 ? (
            <Button size="lg" className="h-10 w-full" disabled>
              Proceed to checkout
            </Button>
          ) : (
            <Link href="/checkout" className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
              Proceed to checkout
            </Link>
          )}
          {unavailable > 0 && !suspended && (
            <p className="text-xs text-muted-foreground">Remove unavailable items to check out.</p>
          )}
          {suspended && (
            <p className="text-xs text-destructive">
              Ordering is suspended for this account. Contact support for help.
            </p>
          )}
        </Summary>
      }
    />
  );
}

function CartLayout({ lines, summary }: { lines: React.ReactNode; summary: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <ul className="divide-y rounded-xl border bg-card">{lines}</ul>
      <aside aria-label="Order summary" className="rounded-xl border bg-card p-5 lg:sticky lg:top-36">
        {summary}
      </aside>
    </div>
  );
}

function GuestLine({ item }: { item: GuestCartItem }) {
  const productId = item.productId as Id<"products">;
  const product = useQuery(api.products.getById, { id: productId });

  if (product === undefined) {
    return (
      <li className="flex gap-4 p-4">
        <Skeleton className="size-20 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </li>
    );
  }

  const line: Line = product
    ? {
        productId,
        name: product.name,
        slug: product.slug,
        packLabel: product.packLabel,
        pricePaise: product.pricePaise,
        stock: product.stock,
        imageUrl: product.imageUrl,
        quantity: item.quantity,
        available: product.stock > BigInt(0),
        explanation:
          product.stock <= BigInt(0)
            ? "Currently out of stock."
            : product.stock < BigInt(item.quantity)
              ? `Only ${product.stock} available in stock.`
              : undefined,
      }
    : {
        productId,
        name: "Unavailable product",
        slug: "",
        packLabel: "",
        pricePaise: BigInt(0),
        stock: BigInt(0),
        imageUrl: null,
        quantity: item.quantity,
        available: false,
        explanation: "This item is no longer available.",
      };

  return <CartLine line={line} />;
}

function CartLine({ line }: { line: Line }) {
  const { setQuantity, isPending } = useCart();
  const lineTotal = line.pricePaise * BigInt(line.quantity);
  // A line that can no longer be bought only offers removal.
  const removable = !line.available || !line.slug;

  return (
    <li className="flex gap-4 p-4">
      <ProductImage src={line.imageUrl} name={line.name} alt="" sizes="80px" className="size-20 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-medium">
            {line.slug ? (
              <Link href={`/products/${line.slug}`} className="hover:underline">
                {line.name}
              </Link>
            ) : (
              line.name
            )}
          </h2>
          {line.packLabel && (
            <p className="text-xs text-muted-foreground">
              {line.packLabel} · {formatPaise(line.pricePaise)} each
            </p>
          )}
          {line.explanation && (
            <p className={line.available ? "text-xs text-amber-700 dark:text-amber-400" : "text-xs text-destructive"}>
              {line.explanation}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          {removable ? (
            <Button
              variant="outline"
              onClick={() => void setQuantity(line.productId, 0)}
              disabled={isPending(line.productId)}
            >
              <Trash2Icon aria-hidden />
              Remove
            </Button>
          ) : (
            <>
              <QuantityControl
                productId={line.productId}
                productName={line.name}
                stock={line.stock}
                className="w-28"
              />
              <span className="text-sm font-semibold tabular-nums">{formatPaise(lineTotal)}</span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function GuestSummary({ items }: { items: GuestCartItem[] }) {
  return (
    <Summary>
      <p className="text-sm text-muted-foreground">
        Sign in to see your total and check out. Your items will be waiting.
      </p>
      <SignInButton mode="modal">
        <Button size="lg" className="h-10 w-full">
          Sign in to check out
        </Button>
      </SignInButton>
      <p className="text-xs text-muted-foreground">
        {items.length} {items.length === 1 ? "product" : "products"} saved on this device.
      </p>
    </Summary>
  );
}

function Summary({
  subtotalPaise,
  unavailable = 0,
  children,
}: {
  subtotalPaise?: bigint;
  unavailable?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Summary</h2>
      {subtotalPaise !== undefined && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-semibold tabular-nums">{formatPaise(subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
        </dl>
      )}
      {unavailable > 0 && (
        <p className="text-xs text-destructive">
          {unavailable} unavailable {unavailable === 1 ? "item isn't" : "items aren't"} included in the subtotal.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Prices include taxes. Delivery is ₹49 per order, free for members.
      </p>
      {children}
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <ShoppingBasketIcon aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
      <h2 className="font-medium">Your cart is empty</h2>
      <p className="text-sm text-muted-foreground">Add something fresh to get started.</p>
      <Link href="/search" className={buttonVariants({ size: "lg", className: "mt-2 px-4" })}>
        Start shopping
      </Link>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]" aria-busy aria-label="Loading cart">
      <div className="space-y-px rounded-xl border">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4 p-4">
            <Skeleton className="size-20 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
