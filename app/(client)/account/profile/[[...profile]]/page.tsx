import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Profile · QuickCrate" };

export default function ProfilePage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Profile</h2>
      <p className="text-sm text-muted-foreground">
        Manage your sign-in details and your QuickCrate Plus billing. Membership is a USD test plan — no real charge.
      </p>
      {/* UserProfile reads the URL for its path routing, so it streams in. */}
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
        <UserProfile
          path="/account/profile"
          routing="path"
          appearance={{ elements: { rootBox: "w-full", cardBox: "w-full max-w-none shadow-none border rounded-xl" } }}
        />
      </Suspense>
    </section>
  );
}
