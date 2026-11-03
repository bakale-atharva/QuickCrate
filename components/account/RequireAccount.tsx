"use client";

import { SignInButton } from "@clerk/nextjs";
import { LockIcon } from "lucide-react";
import { useAccount, type Account } from "@/components/AccountProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ReadyAccount = Extract<Account, { status: "ready" }>;

// Renders children only once Convex confirms the signed-in account, so
// account pages never query as a guest or a half-switched user.
export default function RequireAccount({
  message,
  fallback,
  children,
}: {
  message: string;
  fallback?: React.ReactNode;
  children: (account: ReadyAccount) => React.ReactNode;
}) {
  const account = useAccount();

  if (account.status === "loading") {
    return fallback ?? <Skeleton className="h-48 w-full rounded-xl" aria-label="Loading" />;
  }

  if (account.status === "error") {
    return (
      <p role="alert" className="rounded-xl border p-6 text-sm">
        We couldn&apos;t load your account. Refresh the page or sign in again.
      </p>
    );
  }

  if (account.status === "guest") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <LockIcon aria-hidden className="size-8 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="font-medium">Sign in to continue</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        <SignInButton mode="modal">
          <Button size="lg" className="mt-2 px-4">
            Sign in
          </Button>
        </SignInButton>
      </div>
    );
  }

  return children(account);
}
