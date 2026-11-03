import type { Metadata } from "next";
import FavoritesView from "@/components/account/FavoritesView";

export const metadata: Metadata = { title: "Favorites · QuickCrate" };

export default function FavoritesPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Favorites</h2>
      <FavoritesView />
    </section>
  );
}
