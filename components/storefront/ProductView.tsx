"use client";

import { useQuery } from "convex/react";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import ProductImage from "@/components/client/ProductImage";
import QuantityControl from "@/components/client/QuantityControl";
import StockBadge from "@/components/client/StockBadge";
import { useCart } from "@/components/cart/CartProvider";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatPaise } from "@/lib/format";

export default function ProductView({ slug }: { slug: string }) {
  const product = useQuery(api.products.getBySlug, { slug });
  const category = useQuery(
    api.categories.getById,
    product ? { id: product.categoryId } : "skip"
  );
  const { quantityOf } = useCart();

  if (product === undefined) return <ProductViewSkeleton />;

  if (product === null) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may no longer be sold. Try searching for something similar.
        </p>
        <Link href="/search" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
          Browse products
        </Link>
      </div>
    );
  }

  const inCart = quantityOf(product._id);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
          </li>
          {category && (
            <li className="flex items-center gap-1">
              <ChevronRightIcon aria-hidden className="size-3.5" />
              <Link href={`/categories/${category.slug}`} className="hover:text-foreground hover:underline">
                {category.name}
              </Link>
            </li>
          )}
          <li aria-current="page" className="flex items-center gap-1 text-foreground">
            <ChevronRightIcon aria-hidden className="size-3.5" />
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductImage
          src={product.imageUrl}
          name={product.name}
          alt={product.name}
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
          className="rounded-2xl"
        />
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {product.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pack size: <span className="font-medium text-foreground">{product.packLabel}</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold tabular-nums">{formatPaise(product.pricePaise)}</p>
            <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
          </div>
          <StockBadge stock={product.stock} className="text-sm" />
          <div className="max-w-xs pt-2">
            <QuantityControl
              productId={product._id}
              productName={product.name}
              stock={product.stock}
              size="lg"
            />
            {inCart > 0 && (
              <Link href="/cart" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                View cart
              </Link>
            )}
          </div>
          {product.description && (
            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-medium">About this product</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            </div>
          )}
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Delivery ₹49 per order, free for members. Pay cash on delivery.
          </p>
        </div>
      </div>
    </>
  );
}

export function ProductViewSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12" aria-busy aria-label="Loading product">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-full max-w-xs" />
      </div>
    </div>
  );
}
