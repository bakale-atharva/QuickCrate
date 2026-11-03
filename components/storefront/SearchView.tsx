"use client";

import { useQuery } from "convex/react";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductGrid from "@/components/client/ProductGrid";
import { api } from "@/convex/_generated/api";

// All filter state lives in the URL (?q=&category=&stock=in) so results can
// be shared, bookmarked, and restored with the back button.
export default function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const categorySlug = searchParams.get("category") ?? "";
  const inStockOnly = searchParams.get("stock") === "in";

  const categories = useQuery(api.categories.list, {});
  const category = categories?.find((c) => c.slug === categorySlug);
  const categoryId = category?._id;
  // Wait for categories before querying when a category filter is set.
  const ready = !categorySlug || categories !== undefined;

  const searched = useQuery(
    api.products.search,
    ready && q ? { query: q, categoryId } : "skip"
  );
  const browsed = useQuery(
    api.products.list,
    ready && !q ? { categoryId } : "skip"
  );
  const results = q ? searched : browsed;
  const visible = inStockOnly
    ? results?.filter((product) => product.stock > BigInt(0))
    : results;

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const heading = q ? `Results for “${q}”` : category ? category.name : "All products";
  const unknownCategory = categorySlug && categories !== undefined && !category;

  return (
    <>
      <div className="mb-6 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Category</span>
            <select
              value={category ? category.slug : ""}
              onChange={(event) => update({ category: event.target.value || null })}
              className="h-8 rounded-lg border border-input bg-background px-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => update({ stock: event.target.checked ? "in" : null })}
              className="size-4 accent-primary"
            />
            In stock only
          </label>
          {(q || categorySlug || inStockOnly) && (
            <Link
              href="/search"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon aria-hidden className="size-3.5" />
              Clear filters
            </Link>
          )}
          {visible && (
            <p className="ml-auto text-muted-foreground" aria-live="polite">
              {visible.length} {visible.length === 1 ? "product" : "products"}
            </p>
          )}
        </div>
        {unknownCategory && (
          <p role="status" className="text-sm text-muted-foreground">
            That category isn&apos;t available, so all categories are shown.
          </p>
        )}
      </div>
      <ProductGrid
        products={visible}
        empty={
          q
            ? "No products match your search. Try a different word or clear the filters."
            : "No products match these filters."
        }
      />
    </>
  );
}
