import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/client/ProductGrid";
import CategoryView from "@/components/storefront/CategoryView";

export const metadata: Metadata = { title: "Category · QuickCrate" };

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<ProductGridSkeleton />}>
        {params.then(({ slug }) => (
          <CategoryView slug={slug} />
        ))}
      </Suspense>
    </div>
  );
}
