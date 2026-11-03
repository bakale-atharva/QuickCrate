"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, BanknoteIcon, CheckCircle2Icon, CheckIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { Component, useState } from "react";
import { toast } from "sonner";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";
import RequireAccount from "@/components/account/RequireAccount";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  customerCanCancel,
  formatDateTime,
  shortOrderId,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

export default function OrderDetailView({ orderId, justPlaced }: { orderId: string; justPlaced: boolean }) {
  return (
    <RequireAccount message="Sign in to see this order." fallback={<OrderSkeleton />}>
      {() => (
        <OrderErrorBoundary key={orderId}>
          <OrderDetail orderId={orderId as Id<"orders">} justPlaced={justPlaced} />
        </OrderErrorBoundary>
      )}
    </RequireAccount>
  );
}

// Unknown, malformed, and other customers' order IDs all reject on the server;
// show them as "not found" rather than the page-level error screen.
class OrderErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="font-medium">Order not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This order doesn&apos;t exist or belongs to a different account.
          </p>
          <Link href="/account/orders" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Back to orders
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

function OrderDetail({ orderId, justPlaced }: { orderId: Id<"orders">; justPlaced: boolean }) {
  const order = useQuery(api.orders.getMyOrder, { orderId });

  if (order === undefined) return <OrderSkeleton />;

  const a = order.address;
  const cancelled = order.status === "cancelled";
  const reached = new Set(order.events.map((event) => event.status));

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon aria-hidden className="size-4" />
        All orders
      </Link>

      {justPlaced && !cancelled && (
        <div role="status" className="flex gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <CheckCircle2Icon aria-hidden className="size-6 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Thanks! Your order is placed.</h2>
            <p className="text-sm text-muted-foreground">
              Keep {formatPaise(order.totalPaise)} ready to pay in cash when it arrives.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Order #{shortOrderId(order._id)}</h2>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order._creationTime)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      {!cancelled && (
        <ol aria-label="Order progress" className="grid grid-cols-5 gap-1">
          {ORDER_STATUS_STEPS.map((step) => {
            const done = reached.has(step) || order.status === step;
            return (
              <li key={step} className="space-y-1.5">
                <div className={cn("h-1.5 rounded-full", done ? "bg-primary" : "bg-muted")} />
                <p className={cn("text-[0.7rem] leading-tight sm:text-xs", done ? "font-medium" : "text-muted-foreground")}>
                  {ORDER_STATUS_LABELS[step]}
                  <span className="sr-only">{done ? " (done)" : " (pending)"}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <section aria-labelledby="items-heading" className="rounded-xl border bg-card">
          <h3 id="items-heading" className="border-b px-4 py-3 text-sm font-semibold">
            Items
          </h3>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.packLabel} · {item.quantity.toString()} × {formatPaise(item.unitPricePaise)}
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

        <div className="space-y-4">
          <section aria-labelledby="delivery-heading" className="rounded-xl border bg-card p-4 text-sm">
            <h3 id="delivery-heading" className="mb-2 font-semibold">
              Delivery address
            </h3>
            <address className="space-y-0.5 text-muted-foreground not-italic">
              <span className="block font-medium text-foreground">{a.fullName}</span>
              <span className="block">{a.line1}</span>
              {a.line2 && <span className="block">{a.line2}</span>}
              <span className="block">
                {a.city}, {a.region} {a.postalCode}
              </span>
              <span className="block">{a.country}</span>
              {a.phone && <span className="block">{a.phone}</span>}
            </address>
          </section>
          <section aria-labelledby="payment-heading" className="rounded-xl border bg-card p-4 text-sm">
            <h3 id="payment-heading" className="mb-2 font-semibold">
              Payment
            </h3>
            <p className="flex items-center gap-2 text-muted-foreground">
              <BanknoteIcon aria-hidden className="size-4" />
              Cash on delivery{order.codCollected ? " · paid" : ""}
            </p>
          </section>
          {customerCanCancel(order.status) && <CancelOrder orderId={order._id} />}
        </div>
      </div>

      <section aria-labelledby="history-heading" className="rounded-xl border bg-card p-4">
        <h3 id="history-heading" className="mb-3 text-sm font-semibold">
          Status history
        </h3>
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
              <div>
                <p className="font-medium">{ORDER_STATUS_LABELS[event.status]}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event._creationTime)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CancelOrder({ orderId }: { orderId: Id<"orders"> }) {
  const cancel = useMutation(api.orders.cancel);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancel({ orderId });
      toast.success("Order cancelled");
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel this order"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section aria-labelledby="cancel-heading" className="rounded-xl border bg-card p-4 text-sm">
      <h3 id="cancel-heading" className="mb-1 font-semibold">
        Changed your mind?
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">You can cancel until the store confirms your order.</p>
      {confirming ? (
        <div className="space-y-2">
          <p className="font-medium">Cancel this order?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => void handleCancel()} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Yes, cancel order"}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={cancelling}>
              Keep order
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Cancel order
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading order">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-2 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
