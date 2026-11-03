import ProductCard, { type CatalogProduct } from "@/components/client/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

export default function ProductGrid({
  products,
  empty,
}: {
  products: CatalogProduct[] | undefined;
  empty: React.ReactNode;
}) {
  if (products === undefined) return <ProductGridSkeleton />;
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <ul className={GRID}>
      {products.map((product) => (
        <li key={product._id} className="flex">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-busy aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}
