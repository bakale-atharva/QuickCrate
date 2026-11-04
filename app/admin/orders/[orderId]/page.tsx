import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import AdminOrderDetailView from "@/components/admin/OrderDetailView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order · QuickCrate Admin" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[orderId]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-5xl rounded-xl" />}>
      {params.then(({ orderId }) => (
        <RequireAdmin>
          <AdminOrderDetailView orderId={orderId} />
        </RequireAdmin>
      ))}
    </Suspense>
  );
}
