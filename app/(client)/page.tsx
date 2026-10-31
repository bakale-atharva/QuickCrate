"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import CategoryCard from "@/components/client/CategoryCard";
import ProductCard from "@/components/client/ProductCard";

export default function HomePage() {
  // const categories = useQuery(api.categories.list, {});
  // const featured = useQuery(api.products.list, { limit: 8 });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="relative my-8 overflow-hidden rounded-3xl bg-gradient-to-lr from-primary-10 via-background to-secondary p-8 sm:my-10 sm:p-14">
        <div className="max-w-xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fresh, Every Day
          </p>
          <h1 className="text-3xl font-semibold treacking-tight sm:text-4xl">
            Your Friendly Neighborhood Grocery, Online.
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Shop fresh produce, bakery, pantry and drinks - delivered to your
            door. Join our membership for free shipping on every order.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/search" className={cn(buttonVariants())}>
              Start Shopping
            </Link>
            <Link
              href="/membership"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Membership
            </Link>
          </div>
        </div>
      </section>

      <section className="my-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Shop By Category
          </h2>
        </div>
        {/* {categories === undefined ? (
          <div></div>
        ) : categories.length === 0 ? (
          <div></div>
        ) : (
          <div></div>
        )} */}
      </section>
    </div>
  );
}
