import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAdmin } from "@/components/admin/AdminShell";
import ProductDetailView from "@/components/admin/ProductDetailView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Product · QuickCrate Admin" };

export default function AdminProductPage({ params }: PageProps<"/admin/products/[productId]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-5xl rounded-xl" />}>
      {params.then(({ productId }) => (
        <RequireAdmin>
          <ProductDetailView productId={productId} />
        </RequireAdmin>
      ))}
    </Suspense>
  );
}
