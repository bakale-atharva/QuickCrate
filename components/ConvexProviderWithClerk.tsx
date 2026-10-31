"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk as ConvexClerkProvider } from "convex/react-clerk";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

function InitializeUser() {
  const { userId } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const initialize = useMutation(api.users.initialize);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    void initialize({}).catch((error: unknown) => {
      console.error("Unable to initialize account", error);
    });
  }, [initialize, isAuthenticated, userId]);
  return null;
}

function ConvexProviderWithClerk({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexClerkProvider client={convex} useAuth={useAuth}>
      <InitializeUser />
      {children}
    </ConvexClerkProvider>
  );
}

export default ConvexProviderWithClerk;
