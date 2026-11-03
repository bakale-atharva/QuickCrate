"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import CategoryCard from "@/components/client/CategoryCard";
import ProductGrid from "@/components/client/ProductGrid";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const categories = useQuery(api.categories.list, {});
  const featured = useQuery(api.products.list, { limit: 8 });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="my-6 rounded-3xl bg-primary/5 p-8 sm:my-10 sm:p-14">
        <div className="max-w-xl space-y-4">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Fresh, every day
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your friendly neighborhood grocery, online.
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Shop fresh produce, dairy, pantry staples and drinks — delivered to
            your door and paid in cash on delivery. Members get free delivery on
            every order.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/search" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              Start shopping
            </Link>
            <a href="#categories" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
              Browse categories
            </a>
          </div>
        </div>
      </section>

      <section id="categories" aria-labelledby="categories-title" className="my-12 scroll-mt-32">
        <h2 id="categories-title" className="mb-4 text-xl font-semibold tracking-tight">
          Shop by category
        </h2>
        {categories === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No categories yet. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <li key={category._id}>
                <CategoryCard name={category.name} slug={category.slug} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="featured-title" className="my-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="featured-title" className="text-xl font-semibold tracking-tight">
            Popular picks
          </h2>
          <Link href="/search" className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        <ProductGrid products={featured} empty="No products are available right now." />
      </section>
    </div>
  );
}
