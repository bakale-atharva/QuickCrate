"use client";

import { usePaginatedQuery } from "convex/react";
import { ChevronRightIcon, ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";
import { EmptyState, PageHeader, StatusPill } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { formatPaise } from "@/lib/format";
import { ORDER_STATUS_LABELS, formatDateTime, shortOrderId, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const FILTERS: (OrderStatus | "")[] = ["", "placed", "confirmed", "packing", "out_for_delivery", "delivered", "cancelled"];

function isStatus(value: string | null): value is OrderStatus {
  return value !== null && value !== "" && (FILTERS as string[]).includes(value);
}

// The status filter lives in the URL (?status=) so a filtered queue can be
// bookmarked, e.g. the "placed" queue that needs confirming.
export default function OrdersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const status = isStatus(rawStatus) ? rawStatus : undefined;

  const { results, status: loadStatus, loadMore } = usePaginatedQuery(
    api.orders.adminListOrdersPaginated,
    { status },
    { initialNumItems: PAGE_SIZE }
  );

  function setStatus(next: OrderStatus | "") {
    router.replace(next ? `${pathname}?status=${next}` : pathname, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Orders" description="Newest first. Open an order to move it through fulfillment." />

      <nav aria-label="Filter by status" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {FILTERS.map((filter) => {
            const active = (status ?? "") === filter;
            return (
              <li key={filter || "all"}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(filter)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter ? ORDER_STATUS_LABELS[filter] : "All"}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {loadStatus === "LoadingFirstPage" ? (
        <div className="space-y-2" aria-busy aria-label="Loading orders">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={status ? `No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders` : "No orders yet"}
          body={status ? "Orders in this status will show up here." : "Orders appear here as soon as customers check out."}
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {results.map((order) => {
              const units = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
              return (
                <li key={order._id}>
                  <Link
                    href={`/admin/orders/${order._id}`}
                    className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">#{shortOrderId(order._id)}</span>
                        <OrderStatusBadge status={order.status} />
                        {order.customer?.suspended && <StatusPill tone="bad">Suspended customer</StatusPill>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.customer?.name || order.customer?.email || "Deleted account"} · {order.address.city} ·{" "}
                        {units} {units === 1 ? "item" : "items"}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order._creationTime)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatPaise(order.totalPaise)}</p>
                      <p className="text-xs text-muted-foreground">{order.codCollected ? "COD collected" : "COD due"}</p>
                    </div>
                    <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-center">
            {loadStatus === "CanLoadMore" && (
              <Button variant="outline" size="lg" onClick={() => loadMore(PAGE_SIZE)}>
                Load more
              </Button>
            )}
            {loadStatus === "LoadingMore" && (
              <Button variant="outline" size="lg" disabled>
                Loading…
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
