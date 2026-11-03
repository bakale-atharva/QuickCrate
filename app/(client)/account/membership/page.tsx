import type { Metadata } from "next";
import { Suspense } from "react";
import MembershipView from "@/components/account/MembershipView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Membership · QuickCrate" };

// Only same-site paths are honoured as a return destination.
function safeReturnTo(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default function MembershipPage({ searchParams }: PageProps<"/account/membership">) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">QuickCrate Plus</h2>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        {searchParams.then((query) => (
          <MembershipView returnTo={safeReturnTo(query.returnTo)} />
        ))}
      </Suspense>
    </section>
  );
}
