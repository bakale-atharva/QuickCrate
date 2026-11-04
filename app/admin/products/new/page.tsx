import type { Metadata } from "next";
import { RequireAdmin } from "@/components/admin/AdminShell";
import { PageHeader, Panel } from "@/components/admin/common";
import ProductForm from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "New product · QuickCrate Admin" };

export default function NewProductPage() {
  return (
    <RequireAdmin>
      <div className="mx-auto max-w-3xl">
        <PageHeader title="New product" description="Add each pack size as its own product." />
        <Panel title="Details">
          <ProductForm />
        </Panel>
      </div>
    </RequireAdmin>
  );
}
