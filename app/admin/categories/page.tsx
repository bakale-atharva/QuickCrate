import type { Metadata } from "next";
import { RequireAdmin } from "@/components/admin/AdminShell";
import CategoriesView from "@/components/admin/CategoriesView";

export const metadata: Metadata = { title: "Categories · QuickCrate Admin" };

export default function AdminCategoriesPage() {
  return (
    <RequireAdmin>
      <CategoriesView />
    </RequireAdmin>
  );
}
