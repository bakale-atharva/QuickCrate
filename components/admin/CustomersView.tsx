"use client";

import { useQuery } from "convex/react";
import { ChevronRightIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader, StatusPill, selectClass } from "@/components/admin/common";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { MAX_ADMIN_PAGE_LIMIT } from "@/lib/constants";
import { formatDateTime } from "@/lib/order-status";

// Search and filter live in the URL (?q=&status=). Typing updates the URL
// after a short pause so each keystroke doesn't start a new query.
export default function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const [draft, setDraft] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);

  // Follow URL changes made elsewhere (back/forward) instead of re-applying a
  // stale draft over them.
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }

  useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => update({ q: draft || null }), 250);
    return () => clearTimeout(timer);
    // `update` reads the latest search params on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, q]);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const customers = useQuery(api.users.adminListCustomers, {
    search: q || undefined,
    suspended: status === "suspended" ? true : status === "active" ? false : undefined,
    limit: MAX_ADMIN_PAGE_LIMIT,
  });
  const filtered = Boolean(q || status);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Customers" description="Search by name, email, or Clerk user ID." />

      <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="min-w-48 flex-1 space-y-1">
          <span className="text-xs font-medium">Search</span>
          <Input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium">Account status</span>
          <select value={status} onChange={(event) => update({ status: event.target.value || null })} className={selectClass}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>

      {customers === undefined ? (
        <div className="space-y-2" aria-busy aria-label="Loading customers">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={filtered ? "No matching customers" : "No customers yet"}
          body={filtered ? "Try a different search or filter." : "Customers appear here after they sign in for the first time."}
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
            {customers.length} {customers.length === 1 ? "account" : "accounts"}
            {customers.length >= MAX_ADMIN_PAGE_LIMIT ? " · refine your search to see more" : ""}
          </p>
          <ul className="divide-y rounded-xl border bg-card">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{customer.name || customer.email || "Unnamed"}</span>
                      {customer.role === "admin" && <StatusPill tone="neutral">Admin</StatusPill>}
                      {customer.suspended && <StatusPill tone="bad">Suspended</StatusPill>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.email || customer.clerkUserId} · joined {formatDateTime(customer.createdAt)}
                    </p>
                  </div>
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
