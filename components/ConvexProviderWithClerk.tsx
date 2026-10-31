"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk as ConvexClerkProvider } from "convex/react-clerk";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

function ConvexProviderWithClerk({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexClerkProvider client={convex} useAuth={useAuth}>
      {children}
    </ConvexClerkProvider>
  );
}

export default ConvexProviderWithClerk;
