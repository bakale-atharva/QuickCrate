"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/common";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { MAX_ADMIN_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/constants";

const LOW_STOCK = BigInt(10);

// Work queues for the day. Counts are bounded by the list limits, so a full
// queue shows as "100+" rather than scanning every order.
export default function AdminOverview() {
  const placed = useQuery(api.orders.adminListOrders, { status: "placed", limit: MAX_PAGE_LIMIT });
  const packing = useQuery(api.orders.adminListOrders, { status: "packing", limit: MAX_PAGE_LIMIT });
  const outForDelivery = useQuery(api.orders.adminListOrders, { status: "out_for_delivery", limit: MAX_PAGE_LIMIT });
  const products = useQuery(api.products.adminList, { limit: MAX_ADMIN_PAGE_LIMIT });

  const active = products?.filter((product) => !product.archived);
  const low = active?.filter((product) => product.stock > BigInt(0) && product.stock <= LOW_STOCK).length;
  const out = active?.filter((product) => product.stock <= BigInt(0)).length;

  const tiles = [
    { label: "Awaiting confirmation", value: placed?.length, cap: MAX_PAGE_LIMIT, href: "/admin/orders?status=placed" },
    { label: "Being packed", value: packing?.length, cap: MAX_PAGE_LIMIT, href: "/admin/orders?status=packing" },
    { label: "Out for delivery", value: outForDelivery?.length, cap: MAX_PAGE_LIMIT, href: "/admin/orders?status=out_for_delivery" },
    { label: "Low stock", value: low, href: "/admin/products?status=low" },
    { label: "Out of stock", value: out, href: "/admin/products?status=out" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Overview" description="What needs attention right now." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="block rounded-xl border bg-card p-4 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              {tile.value === undefined ? (
                <Skeleton className="mt-2 h-8 w-12" />
              ) : (
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {tile.cap !== undefined && tile.value >= tile.cap ? `${tile.cap}+` : tile.value}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
