"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, use, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

type Me = FunctionReturnType<typeof api.users.me>;

export type Account =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error" }
  | { status: "ready"; clerkUserId: string; me: Me };

const AccountContext = createContext<Account>({ status: "loading" });

export function useAccount() {
  return use(AccountContext);
}

export default function AccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, userId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const initialize = useMutation(api.users.initialize);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;
    initialize({})
      .then(() => {
        if (!cancelled) setInitializedFor(userId);
      })
      .catch((error: unknown) => {
        console.error("Unable to initialize account", error);
        if (!cancelled) setFailedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [initialize, isAuthenticated, userId]);

  const initialized =
    isAuthenticated && userId !== null && initializedFor === userId;
  const me = useQuery(api.users.me, initialized ? {} : "skip");

  let account: Account;
  if (!isLoaded) {
    account = { status: "loading" };
  } else if (!userId) {
    account = { status: "guest" };
  } else if (failedFor === userId) {
    account = { status: "error" };
  } else if (me && me.clerkUserId === userId) {
    // Only trust account data once Convex confirms it belongs to the user
    // Clerk reports, so a mid-switch token can never show another account.
    account = { status: "ready", clerkUserId: userId, me };
  } else {
    account = { status: "loading" };
  }

  return <AccountContext value={account}>{children}</AccountContext>;
}
