import type { Metadata } from "next";
import { Suspense } from "react";
import ProductView, { ProductViewSkeleton } from "@/components/storefront/ProductView";

export const metadata: Metadata = { title: "Product · QuickCrate" };

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<ProductViewSkeleton />}>
        {params.then(({ slug }) => (
          <ProductView slug={slug} />
        ))}
      </Suspense>
    </div>
  );
}
