"use client";

import { useMutation, useQuery } from "convex/react";
import { HeartIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import RequireAccount from "@/components/account/RequireAccount";
import ProductImage from "@/components/client/ProductImage";
import QuantityControl from "@/components/client/QuantityControl";
import StockBadge from "@/components/client/StockBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatPaise } from "@/lib/format";

export default function FavoritesView() {
  return (
    <RequireAccount message="Sign in to see the products you've saved." fallback={<FavoritesSkeleton />}>
      {() => <Favorites />}
    </RequireAccount>
  );
}

function Favorites() {
  const favorites = useQuery(api.favorites.list, {});

  if (favorites === undefined) return <FavoritesSkeleton />;

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <HeartIcon aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
        <h3 className="font-medium">No favorites yet</h3>
        <p className="text-sm text-muted-foreground">Tap Save on any product to find it here later.</p>
        <Link href="/search" className={buttonVariants({ size: "lg", className: "mt-2 px-4" })}>
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {favorites.map(({ favoriteId, productId, product }) => {
        // Archived products stay listed so the customer can see and remove them.
        const purchasable = product !== null && !product.archived;
        return (
          <li key={favoriteId} className="relative flex flex-col gap-3 rounded-xl border bg-card p-3">
            <RemoveFavorite productId={productId} name={product?.name ?? "this product"} />
            {product && purchasable ? (
              <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden>
                <ProductImage src={product.imageUrl} name={product.name} alt="" sizes="(min-width: 1024px) 200px, 45vw" />
              </Link>
            ) : (
              <ProductImage src={product?.imageUrl ?? null} name={product?.name ?? "Unavailable"} alt="" sizes="200px" className="opacity-50" />
            )}
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="line-clamp-2 text-sm leading-snug font-medium">
                {product && purchasable ? (
                  <Link href={`/products/${product.slug}`} className="hover:underline">
                    {product.name}
                  </Link>
                ) : (
                  (product?.name ?? "Unavailable product")
                )}
              </h3>
              {product && <p className="text-xs text-muted-foreground">{product.packLabel}</p>}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                {product && purchasable ? (
                  <>
                    <span className="font-semibold tabular-nums">{formatPaise(product.pricePaise)}</span>
                    <StockBadge stock={product.stock} />
                  </>
                ) : (
                  <span className="text-xs text-destructive">No longer sold</span>
                )}
              </div>
            </div>
            {product && purchasable && (
              <QuantityControl productId={product._id} productName={product.name} stock={product.stock} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RemoveFavorite({ productId, name }: { productId: Id<"products">; name: string }) {
  const toggle = useMutation(api.favorites.toggle);
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    setPending(true);
    try {
      await toggle({ productId });
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't remove this favorite"));
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      className="absolute top-4 right-4 z-10"
      aria-label={`Remove ${name} from favorites`}
      onClick={() => void handleRemove()}
      disabled={pending}
    >
      <XIcon aria-hidden />
    </Button>
  );
}

function FavoritesSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy aria-label="Loading favorites">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
      ))}
    </div>
  );
}
