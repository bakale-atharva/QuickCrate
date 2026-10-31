"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

export default function InitializeUser() {
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
