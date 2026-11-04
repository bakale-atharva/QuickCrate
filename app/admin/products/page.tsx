import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import ProductsView from "@/components/admin/ProductsView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Products · QuickCrate Admin" };

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-6xl rounded-xl" />}>
      <RequireAdmin>
        <ProductsView />
      </RequireAdmin>
    </Suspense>
  );
}
