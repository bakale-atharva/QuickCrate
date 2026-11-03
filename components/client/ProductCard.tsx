import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import ProductImage from "@/components/client/ProductImage";
import QuantityControl from "@/components/client/QuantityControl";
import StockBadge from "@/components/client/StockBadge";
import type { api } from "@/convex/_generated/api";
import { formatPaise } from "@/lib/format";

export type CatalogProduct = FunctionReturnType<typeof api.products.list>[number];

export default function ProductCard({ product }: { product: CatalogProduct }) {
  const href = `/products/${product.slug}`;
  return (
    <article className="group flex w-full flex-col gap-3 rounded-xl border bg-card p-3">
      <Link href={href} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" tabIndex={-1} aria-hidden>
        <ProductImage
          src={product.imageUrl}
          name={product.name}
          alt=""
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
          className="transition-opacity group-hover:opacity-90"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={href} className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground">{product.packLabel}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="font-semibold tabular-nums">{formatPaise(product.pricePaise)}</span>
          <StockBadge stock={product.stock} />
        </div>
      </div>
      <QuantityControl productId={product._id} productName={product.name} stock={product.stock} />
    </article>
  );
}
