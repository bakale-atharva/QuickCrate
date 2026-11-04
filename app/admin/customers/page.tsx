import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import CustomersView from "@/components/admin/CustomersView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Customers · QuickCrate Admin" };

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-5xl rounded-xl" />}>
      <RequireAdmin>
        <CustomersView />
      </RequireAdmin>
    </Suspense>
  );
}
