import type { Metadata } from "next";
import { Suspense } from "react";
import OrderDetailView from "@/components/account/OrderDetailView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order · QuickCrate" };

export default function OrderPage({ params, searchParams }: PageProps<"/account/orders/[orderId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      {Promise.all([params, searchParams]).then(([{ orderId }, query]) => (
        <OrderDetailView orderId={orderId} justPlaced={query.placed === "1"} />
      ))}
    </Suspense>
  );
}
