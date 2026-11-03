"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import ProductGrid from "@/components/client/ProductGrid";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";

export default function CategoryView({ slug }: { slug: string }) {
  const category = useQuery(api.categories.getBySlug, { slug });
  const products = useQuery(
    api.products.list,
    category ? { categoryId: category._id } : "skip"
  );

  if (category === null) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Category not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been renamed or removed.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        {category === undefined ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
        )}
        {category && (
          <Link
            href={`/search?category=${encodeURIComponent(category.slug)}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Search within {category.name}
          </Link>
        )}
      </div>
      <ProductGrid products={products} empty="No products in this category yet." />
    </>
  );
}
