import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/client/ProductGrid";
import SearchView from "@/components/storefront/SearchView";

export const metadata: Metadata = { title: "Search · QuickCrate" };

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<ProductGridSkeleton />}>
        <SearchView />
      </Suspense>
    </div>
  );
}
