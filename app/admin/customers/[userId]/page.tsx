import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import CustomerDetailView from "@/components/admin/CustomerDetailView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Customer · QuickCrate Admin" };

export default function AdminCustomerPage({ params }: PageProps<"/admin/customers/[userId]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-5xl rounded-xl" />}>
      {params.then(({ userId }) => (
        <RequireAdmin>
          <CustomerDetailView userId={userId} />
        </RequireAdmin>
      ))}
    </Suspense>
  );
}
