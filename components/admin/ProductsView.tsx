"use client";

import { useQuery } from "convex/react";
import { PackageIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, PageHeader, StatusPill, selectClass } from "@/components/admin/common";
import ProductImage from "@/components/client/ProductImage";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { MAX_ADMIN_PAGE_LIMIT } from "@/lib/constants";
import { formatPaise } from "@/lib/format";

const LOW_STOCK = BigInt(10);

const STATUS_FILTERS = [
  { value: "", label: "All products" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "low", label: "Low stock (≤ 10)" },
  { value: "out", label: "Out of stock" },
] as const;

// Filters live in the URL (?q=&category=&status=) so a view can be shared and
// survives reloads and the back button.
export default function ProductsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const status = searchParams.get("status") ?? "";

  const products = useQuery(api.products.adminList, { limit: MAX_ADMIN_PAGE_LIMIT });
  const categories = useQuery(api.categories.listAllAdmin, {});

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const term = q.trim().toLowerCase();
  const visible = products?.filter((product) => {
    if (term && !product.name.toLowerCase().includes(term) && !product.sku.toLowerCase().includes(term)) return false;
    if (categoryId && product.categoryId !== categoryId) return false;
    if (status === "active" && product.archived) return false;
    if (status === "archived" && !product.archived) return false;
    if (status === "low" && (product.stock <= BigInt(0) || product.stock > LOW_STOCK)) return false;
    if (status === "out" && product.stock > BigInt(0)) return false;
    return true;
  });
  const filtered = Boolean(q || categoryId || status);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Products" description="Each pack size is its own product with its own SKU and stock.">
        <Link href="/admin/products/new" className={buttonVariants({ size: "lg", className: "px-3" })}>
          <PlusIcon aria-hidden />
          New product
        </Link>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="min-w-48 flex-1 space-y-1">
          <span className="text-xs font-medium">Search name or SKU</span>
          <Input type="search" value={q} onChange={(event) => update({ q: event.target.value || null })} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium">Category</span>
          <select value={categoryId} onChange={(event) => update({ category: event.target.value || null })} className={selectClass}>
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
                {category.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium">Status</span>
          <select value={status} onChange={(event) => update({ status: event.target.value || null })} className={selectClass}>
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <Link href="/admin/products" className={buttonVariants({ variant: "ghost", size: "lg" })}>
            <XIcon aria-hidden />
            Clear
          </Link>
        )}
      </div>

      {visible === undefined ? (
        <div className="space-y-2" aria-busy aria-label="Loading products">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        filtered ? (
          <EmptyState icon={PackageIcon} title="No matching products" body="Try a different search or clear the filters." />
        ) : (
          <EmptyState icon={PackageIcon} title="No products yet" body="Create your first product to start selling.">
            <Link href="/admin/products/new" className={buttonVariants({ size: "lg", className: "px-4" })}>
              New product
            </Link>
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
            {visible.length} {visible.length === 1 ? "product" : "products"}
            {products && products.length >= MAX_ADMIN_PAGE_LIMIT ? ` · showing the ${MAX_ADMIN_PAGE_LIMIT} newest` : ""}
          </p>
          <ul className="divide-y rounded-xl border bg-card">
            {visible.map((product) => (
              <li key={product._id}>
                <Link
                  href={`/admin/products/${product._id}`}
                  className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ProductImage src={product.imageUrl} name={product.name} alt="" sizes="48px" className="size-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{product.name}</span>
                      {product.archived && <StatusPill tone="neutral">Archived</StatusPill>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {product.sku} · {product.packLabel} · {product.categoryName || "No category"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">{formatPaise(product.pricePaise)}</p>
                    <StockLabel stock={product.stock} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function StockLabel({ stock }: { stock: bigint }) {
  if (stock <= BigInt(0)) return <StatusPill tone="bad">Out of stock</StatusPill>;
  if (stock <= LOW_STOCK) return <StatusPill tone="warn">{stock.toString()} in stock</StatusPill>;
  return <span className="text-xs text-muted-foreground tabular-nums">{stock.toString()} in stock</span>;
}
