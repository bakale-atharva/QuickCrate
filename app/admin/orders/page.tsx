import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import OrdersView from "@/components/admin/OrdersView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Orders · QuickCrate Admin" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-6xl rounded-xl" />}>
      <RequireAdmin>
        <OrdersView />
      </RequireAdmin>
    </Suspense>
  );
}
