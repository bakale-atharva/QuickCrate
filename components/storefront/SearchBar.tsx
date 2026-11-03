"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/search" ? (searchParams.get("q") ?? "") : "";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    // Keep other filters when already searching; start fresh elsewhere.
    const params = new URLSearchParams(pathname === "/search" ? searchParams : undefined);
    if (q) params.set("q", q);
    else params.delete("q");
    const query = params.toString();
    router.push(query ? `/search?${query}` : "/search");
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <label htmlFor="site-search" className="sr-only">
        Search groceries
      </label>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        // Remount when the URL query changes so the field reflects it.
        key={current}
        id="site-search"
        name="q"
        type="search"
        defaultValue={current}
        placeholder="Search milk, rice, apples…"
        autoComplete="off"
        className="pl-9"
      />
    </form>
  );
}
