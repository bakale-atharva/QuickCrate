"use client";

import { Button } from "@/components/ui/button";

export default function StorefrontError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn&apos;t load this page. Check your connection and try again.
      </p>
      <Button size="lg" className="mt-6 px-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
