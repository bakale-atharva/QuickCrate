"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";
import { FormError, NotFoundBoundary, Panel, StatusPill, textareaClass } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { formatDateTime, shortOrderId } from "@/lib/order-status";

type CustomerDetail = FunctionReturnType<typeof api.users.adminGetCustomer>;

export default function CustomerDetailView({ userId }: { userId: string }) {
  return (
    <NotFoundBoundary key={userId} title="Customer not found" backHref="/admin/customers" backLabel="Back to customers">
      <Customer userId={userId as Id<"users">} />
    </NotFoundBoundary>
  );
}

function Customer({ userId }: { userId: Id<"users"> }) {
  const detail = useQuery(api.users.adminGetCustomer, { userId });

  if (detail === undefined) return <DetailSkeleton />;

  const { customer } = detail;
  const deleted = customer.deletedAt !== undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon aria-hidden className="size-4" />
        All customers
      </Link>

      <header className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {customer.name || customer.email || "Unnamed customer"}
          {customer.role === "admin" && <StatusPill tone="neutral">Admin</StatusPill>}
          {deleted ? (
            <StatusPill tone="neutral">Deleted</StatusPill>
          ) : customer.suspended ? (
            <StatusPill tone="bad">Suspended</StatusPill>
          ) : (
            <StatusPill tone="good">Active</StatusPill>
          )}
        </h1>
        <p className="text-sm break-all text-muted-foreground">
          {customer.email && `${customer.email} · `}
          Joined {formatDateTime(customer.createdAt)}
        </p>
        <p className="font-mono text-xs break-all text-muted-foreground">{customer.clerkUserId}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          <RecentOrders orders={detail.orders} />
          <Notes userId={customer.id} notes={detail.notes} />
        </div>
        <div className="space-y-4">
          {deleted ? (
            <Panel title="Ordering">
              <p className="text-sm text-muted-foreground">This account was deleted in Clerk. Its order history is kept.</p>
            </Panel>
          ) : customer.role === "admin" ? (
            <Panel title="Ordering">
              <p className="text-sm text-muted-foreground">Administrator accounts can&apos;t be suspended.</p>
            </Panel>
          ) : (
            <SuspensionControl userId={customer.id} suspended={customer.suspended} />
          )}
          <Membership membership={detail.membership} />
          <Addresses addresses={detail.addresses} />
        </div>
      </div>
    </div>
  );
}

function SuspensionControl({ userId, suspended }: { userId: Id<"users">; suspended: boolean }) {
  const formId = useId();
  const setSuspended = useMutation(api.users.adminSetCustomerSuspended);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!suspended && !reason.trim()) {
      setError("Add a reason so other staff know why ordering was suspended.");
      return;
    }
    setSaving(true);
    try {
      await setSuspended({ userId, suspended: !suspended, reason: reason.trim() || undefined });
      toast.success(suspended ? "Ordering reinstated" : "Ordering suspended");
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't update this account"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Ordering">
      <p className="mb-3 text-sm text-muted-foreground">
        {suspended
          ? "This customer can't place new orders. They can still sign in and see existing orders."
          : "This customer can place orders. Suspending blocks new orders but keeps the account and its order history."}
      </p>
      {open ? (
        <form onSubmit={handleSubmit} aria-describedby={error ? `${formId}-error` : undefined} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium">{suspended ? "Note (optional)" : "Reason"}</span>
            <Input
              autoFocus
              required={!suspended}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={suspended ? "e.g. Issue resolved" : "e.g. Repeated refused deliveries"}
            />
          </label>
          <FormError id={`${formId}-error`} message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant={suspended ? "default" : "destructive"} disabled={saving}>
              {saving ? "Saving…" : suspended ? "Reinstate ordering" : "Suspend ordering"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant={suspended ? "outline" : "destructive"} onClick={() => setOpen(true)}>
          {suspended ? "Reinstate…" : "Suspend…"}
        </Button>
      )}
    </Panel>
  );
}

function Membership({ membership }: { membership: CustomerDetail["membership"] }) {
  return (
    <Panel title="Membership">
      {membership === null ? (
        <p className="text-sm text-muted-foreground">No QuickCrate Plus membership on record. Delivery is charged.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Free delivery</dt>
            <dd>{membership.eligible ? <StatusPill tone="good">Eligible</StatusPill> : <StatusPill tone="neutral">Not eligible</StatusPill>}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Clerk status</dt>
            <dd className="capitalize">{membership.status.replaceAll("_", " ")}</dd>
          </div>
          {membership.paidThrough !== undefined && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Paid through</dt>
              <dd>{formatDateTime(membership.paidThrough)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Last verified</dt>
            <dd>{formatDateTime(membership.refreshedAt)}</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-xs text-muted-foreground">USD test plan in Clerk development. Status refreshes from Clerk webhooks and at checkout.</p>
    </Panel>
  );
}

function Addresses({ addresses }: { addresses: CustomerDetail["addresses"] }) {
  return (
    <Panel title="Saved addresses">
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved addresses.</p>
      ) : (
        <ul className="-my-2 divide-y">
          {addresses.map(({ _id, address: a, isDefault }) => (
            <li key={_id} className="py-2">
              <address className="space-y-0.5 text-sm text-muted-foreground not-italic">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {a.fullName}
                  {isDefault && <StatusPill tone="neutral">Default</StatusPill>}
                </span>
                <span className="block">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                </span>
                <span className="block">
                  {a.city}, {a.region} {a.postalCode}
                </span>
                {a.phone && <span className="block">{a.phone}</span>}
              </address>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RecentOrders({ orders }: { orders: CustomerDetail["orders"] }) {
  return (
    <Panel title="Recent orders">
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <ul className="-mx-4 -my-4 divide-y">
          {orders.map((order) => (
            <li key={order._id}>
              <Link
                href={`/admin/orders/${order._id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    #{shortOrderId(order._id)}
                    <OrderStatusBadge status={order.status} />
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(order._creationTime)}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatPaise(order.totalPaise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {orders.length >= 20 && (
        <p className="mt-6 text-xs text-muted-foreground">Showing the 20 most recent orders.</p>
      )}
    </Panel>
  );
}

function Notes({ userId, notes }: { userId: Id<"users">; notes: CustomerDetail["notes"] }) {
  const formId = useId();
  const addNote = useMutation(api.users.adminAddCustomerNote);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addNote({ userId, body });
      setBody("");
      toast.success("Note added");
    } catch (err) {
      setError(errorMessage(err, "Couldn't add this note"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Internal notes">
      <form onSubmit={handleSubmit} aria-describedby={error ? `${formId}-error` : undefined} className="mb-4 space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Add a note (staff only, never shown to the customer)</span>
          <textarea required rows={3} value={body} onChange={(event) => setBody(event.target.value)} className={textareaClass} />
        </label>
        <FormError id={`${formId}-error`} message={error} />
        <Button type="submit" disabled={saving || !body.trim()}>
          {saving ? "Saving…" : "Add note"}
        </Button>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li key={note._id} className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.author?.name || note.author?.email || "Unknown"} · {formatDateTime(note._creationTime)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy aria-label="Loading customer">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
