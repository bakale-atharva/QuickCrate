import type { Metadata } from "next";
import OrdersView from "@/components/account/OrdersView";

export const metadata: Metadata = { title: "Orders · QuickCrate" };

export default function OrdersPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Orders</h2>
      <OrdersView />
    </section>
  );
}
