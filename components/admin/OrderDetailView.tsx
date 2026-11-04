"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, BanknoteIcon, CheckIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";
import { FormError, NotFoundBoundary, Panel, StatusPill } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { ORDER_STATUS_LABELS, formatDateTime, shortOrderId, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  packing: "Start packing",
  out_for_delivery: "Send out for delivery",
  delivered: "Mark delivered",
};

export default function AdminOrderDetailView({ orderId }: { orderId: string }) {
  return (
    <NotFoundBoundary key={orderId} title="Order not found" backHref="/admin/orders" backLabel="Back to orders">
      <OrderDetail orderId={orderId as Id<"orders">} />
    </NotFoundBoundary>
  );
}

function OrderDetail({ orderId }: { orderId: Id<"orders"> }) {
  const order = useQuery(api.orders.adminGetOrder, { orderId });

  if (order === undefined) return <DetailSkeleton />;

  const a = order.address;
  const transitions = order.permittedTransitions as OrderStatus[];
  const next = transitions.find((status) => status !== "cancelled");
  const canCancel = transitions.includes("cancelled");
  const terminal = transitions.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon aria-hidden className="size-4" />
        All orders
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order #{shortOrderId(order._id)}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order._creationTime)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-6">
          <section aria-labelledby="items-heading" className="rounded-xl border bg-card">
            <h2 id="items-heading" className="border-b px-4 py-3 text-sm font-semibold">
              Items
            </h2>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/admin/products/${item.productId}`} className="block underline-offset-4 hover:underline">
                      {item.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {item.sku} · {item.packLabel} · {item.quantity.toString()} × {formatPaise(item.unitPricePaise)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatPaise(item.unitPricePaise * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPaise(order.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">
                  {order.deliveryFeePaise === BigInt(0) ? "Free (member)" : formatPaise(order.deliveryFeePaise)}
                </dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>Total (incl. taxes)</dt>
                <dd className="tabular-nums">{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          <Panel title="Status history">
            <ol className="space-y-3">
              {order.events.map((event) => (
                <li key={event._id} className="flex gap-3 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      event.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    )}
                  >
                    {event.status === "cancelled" ? <XCircleIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{ORDER_STATUS_LABELS[event.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event._creationTime)} ·{" "}
                      {event.actor
                        ? `${event.actor.name || event.actor.email}${event.actor.role === "admin" ? " (admin)" : " (customer)"}`
                        : "Unknown"}
                    </p>
                    {event.note && <p className="mt-0.5 text-xs">{event.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-4">
          {terminal ? (
            <Panel title="Fulfillment">
              <p className="text-sm text-muted-foreground">
                This order is {ORDER_STATUS_LABELS[order.status].toLowerCase()} and can&apos;t change further.
              </p>
            </Panel>
          ) : (
            <>
              {next && <AdvanceOrder orderId={order._id} next={next} totalPaise={order.totalPaise} />}
              {canCancel && <CancelOrder orderId={order._id} />}
              {!canCancel && (
                <p className="px-1 text-xs text-muted-foreground">Orders can&apos;t be cancelled once they&apos;re out for delivery.</p>
              )}
            </>
          )}

          <Panel title="Customer">
            {order.customer ? (
              <div className="space-y-1 text-sm">
                <Link href={`/admin/customers/${order.customer.id}`} className="font-medium underline-offset-4 hover:underline">
                  {order.customer.name || order.customer.email || "Unnamed customer"}
                </Link>
                {order.customer.email && <p className="break-all text-muted-foreground">{order.customer.email}</p>}
                {order.customer.suspended && <StatusPill tone="bad">Suspended</StatusPill>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This account was deleted.</p>
            )}
          </Panel>

          <Panel title="Delivery address">
            <address className="space-y-0.5 text-sm text-muted-foreground not-italic">
              <span className="block font-medium text-foreground">{a.fullName}</span>
              <span className="block">{a.line1}</span>
              {a.line2 && <span className="block">{a.line2}</span>}
              <span className="block">
                {a.city}, {a.region} {a.postalCode}
              </span>
              <span className="block">{a.country}</span>
              {a.phone && (
                <a href={`tel:${a.phone}`} className="block text-foreground underline-offset-4 hover:underline">
                  {a.phone}
                </a>
              )}
            </address>
          </Panel>

          <Panel title="Payment">
            <p className="flex items-center gap-2 text-sm">
              <BanknoteIcon aria-hidden className="size-4 text-muted-foreground" />
              Cash on delivery · {formatPaise(order.totalPaise)}
            </p>
            <p className="mt-2">
              {order.codCollected ? (
                <StatusPill tone="good">Cash collected</StatusPill>
              ) : order.status === "cancelled" ? (
                <StatusPill tone="neutral">Not collected</StatusPill>
              ) : (
                <StatusPill tone="warn">Awaiting collection</StatusPill>
              )}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AdvanceOrder({ orderId, next, totalPaise }: { orderId: Id<"orders">; next: OrderStatus; totalPaise: bigint }) {
  const formId = useId();
  const updateStatus = useMutation(api.orders.adminUpdateStatus);
  const [note, setNote] = useState("");
  const [codCollected, setCodCollected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivering = next === "delivered";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (delivering && !codCollected) {
      setError("Confirm the cash was collected before marking the order delivered.");
      return;
    }
    setSaving(true);
    try {
      await updateStatus({
        orderId,
        status: next,
        note: note.trim() || undefined,
        ...(delivering ? { codCollected: true } : {}),
      });
      toast.success(`Order ${ORDER_STATUS_LABELS[next].toLowerCase()}`);
      setNote("");
      setCodCollected(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't update this order"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Fulfillment">
      <form onSubmit={handleSubmit} aria-describedby={error ? `${formId}-error` : undefined} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Next step: <span className="font-medium text-foreground">{ORDER_STATUS_LABELS[next]}</span>
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Note (optional)</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Visible in the order history" />
        </label>
        {delivering && (
          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={codCollected}
              onChange={(event) => setCodCollected(event.target.checked)}
            />
            <span>
              I confirm <span className="font-semibold">{formatPaise(totalPaise)}</span> was collected in cash.
            </span>
          </label>
        )}
        <FormError id={`${formId}-error`} message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Updating…" : ACTION_LABELS[next]}
        </Button>
      </form>
    </Panel>
  );
}

function CancelOrder({ orderId }: { orderId: Id<"orders"> }) {
  const formId = useId();
  const updateStatus = useMutation(api.orders.adminUpdateStatus);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateStatus({ orderId, status: "cancelled", note: reason.trim() || undefined });
      toast.success("Order cancelled and items restocked");
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel this order"));
    } finally {
      setSaving(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="destructive" size="lg" className="w-full" onClick={() => setConfirming(true)}>
        Cancel order
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleCancel}
      aria-label="Cancel order"
      aria-describedby={error ? `${formId}-error` : undefined}
      className="space-y-3 rounded-xl border border-destructive/40 bg-card p-4"
    >
      <p className="text-sm font-medium">Cancel this order? Its items go back into stock.</p>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Reason (optional)</span>
        <Input autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Customer unreachable" />
      </label>
      <FormError id={`${formId}-error`} message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={saving}>
          {saving ? "Cancelling…" : "Yes, cancel order"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
          Keep order
        </Button>
      </div>
    </form>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy aria-label="Loading order">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
