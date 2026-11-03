"use client";

import { PricingTable } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { BadgeCheckIcon, FlaskConicalIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import RequireAccount from "@/components/account/RequireAccount";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default function MembershipView({ returnTo }: { returnTo: string | null }) {
  return (
    <div className="space-y-6">
      <div role="note" className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <FlaskConicalIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-medium">Test membership — billed in USD, no real charge</p>
          <p className="text-muted-foreground">
            QuickCrate Plus costs <strong className="font-medium text-foreground">$4.99/month (USD)</strong> and runs on
            Clerk&apos;s development billing. Pay with a Clerk test card; no real money moves. Grocery prices and delivery
            fees stay in INR — members get free delivery instead of the ₹49 fee.
          </p>
        </div>
      </div>
      <RequireAccount message="Sign in to manage your QuickCrate Plus membership." fallback={<Skeleton className="h-64 rounded-xl" />}>
        {(account) => <Membership key={account.clerkUserId} returnTo={returnTo} />}
      </RequireAccount>
    </div>
  );
}

function Membership({ returnTo }: { returnTo: string | null }) {
  const membership = useQuery(api.memberships.getMyMembership, {});
  const refreshMine = useAction(api.memberships.refreshMine);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Clerk's checkout and plan changes happen inside its own UI; pull the
  // authoritative state whenever the customer lands here or returns to the tab
  // so delivery quotes reflect it without waiting for the webhook.
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshMine({});
    } catch (error) {
      setRefreshError(errorMessage(error, "Couldn't check your membership right now."));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [refreshMine]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="status-heading" className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 id="status-heading" className="font-semibold">
              Your membership
            </h3>
            {membership === undefined ? (
              <Skeleton className="h-4 w-48" />
            ) : membership.eligible ? (
              <p className="flex items-center gap-1.5 text-sm text-primary">
                <BadgeCheckIcon aria-hidden className="size-4" />
                QuickCrate Plus is active — delivery is free
                {membership.paidThrough && membership.status !== "active"
                  ? ` until ${dateFormat.format(new Date(membership.paidThrough))}`
                  : ""}
                .
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {membership.status === "none"
                  ? "You're not a member. Delivery is ₹49 per order."
                  : `Membership ${membership.status.replaceAll("_", " ")} — delivery is ₹49 per order.`}
              </p>
            )}
            {refreshError && (
              <p role="alert" className="text-xs text-destructive">
                {refreshError}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCwIcon aria-hidden className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "Checking…" : "Refresh status"}
          </Button>
        </div>
        {returnTo && membership?.eligible && (
          <Link href={returnTo} className={buttonVariants({ size: "lg", className: "mt-4 px-4" })}>
            Back to checkout
          </Link>
        )}
      </section>

      <section aria-labelledby="plans-heading" className="space-y-3">
        <h3 id="plans-heading" className="font-semibold">
          Plans
        </h3>
        <p className="text-sm text-muted-foreground">
          Subscribe, switch, or cancel below. A cancelled membership keeps free delivery until the paid period ends.
          You can also manage billing from{" "}
          <Link href="/account/profile" className="font-medium text-primary hover:underline">
            your profile
          </Link>
          .
        </p>
        <PricingTable newSubscriptionRedirectUrl={returnTo ?? "/account/membership"} />
      </section>
    </div>
  );
}
