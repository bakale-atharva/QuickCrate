"use client";

import { useQuery } from "convex/react";
import { ChevronRightIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";
import RequireAccount from "@/components/account/RequireAccount";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatPaise } from "@/lib/format";
import { formatDateTime, shortOrderId } from "@/lib/order-status";

export default function OrdersView() {
  return (
    <RequireAccount message="Sign in to see your orders." fallback={<OrdersSkeleton />}>
      {() => <Orders />}
    </RequireAccount>
  );
}

function Orders() {
  const orders = useQuery(api.orders.getMyOrders, {});

  if (orders === undefined) return <OrdersSkeleton />;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <PackageIcon aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
        <h3 className="font-medium">No orders yet</h3>
        <p className="text-sm text-muted-foreground">Your orders will appear here once you check out.</p>
        <Link href="/search" className={buttonVariants({ size: "lg", className: "mt-2 px-4" })}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {orders.map((order) => {
        const units = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
        return (
          <li key={order._id}>
            <Link
              href={`/account/orders/${order._id}`}
              className="flex items-center gap-4 p-4 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Order #{shortOrderId(order._id)}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(order._creationTime)} · {units} {units === 1 ? "item" : "items"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {order.items.map((item) => item.name).join(", ")}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatPaise(order.totalPaise)}</span>
              <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-px rounded-xl border" aria-busy aria-label="Loading orders">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
