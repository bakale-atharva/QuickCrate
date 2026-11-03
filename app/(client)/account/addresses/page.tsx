import type { Metadata } from "next";
import AddressesView from "@/components/account/AddressesView";

export const metadata: Metadata = { title: "Addresses · QuickCrate" };

export default function AddressesPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Addresses</h2>
      <AddressesView />
    </section>
  );
}
