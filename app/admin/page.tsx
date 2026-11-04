import type { Metadata } from "next";
import AdminOverview from "@/components/admin/AdminOverview";
import { RequireAdmin } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Overview · QuickCrate Admin" };

export default function AdminOverviewPage() {
  return (
    <RequireAdmin>
      <AdminOverview />
    </RequireAdmin>
  );
}
