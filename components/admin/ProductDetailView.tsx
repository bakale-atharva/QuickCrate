"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, ExternalLinkIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FormError, NotFoundBoundary, Panel, StatusPill, selectClass } from "@/components/admin/common";
import ProductForm from "@/components/admin/ProductForm";
import { StockLabel } from "@/components/admin/ProductsView";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, shortOrderId } from "@/lib/order-status";

export default function ProductDetailView({ productId }: { productId: string }) {
  return (
    <NotFoundBoundary key={productId} title="Product not found" backHref="/admin/products" backLabel="Back to products">
      <ProductDetail productId={productId as Id<"products">} />
    </NotFoundBoundary>
  );
}

function ProductDetail({ productId }: { productId: Id<"products"> }) {
  const product = useQuery(api.products.adminGetById, { id: productId });

  if (product === undefined) return <DetailSkeleton />;
  if (product === null) throw new Error("Product not found");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon aria-hidden className="size-4" />
        All products
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {product.name}
            {product.archived ? <StatusPill tone="neutral">Archived</StatusPill> : <StatusPill tone="good">Active</StatusPill>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {product.sku} · {product.packLabel} · {product.categoryName || "No category"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!product.archived && (
            <Link href={`/products/${product.slug}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
              <ExternalLinkIcon aria-hidden />
              View in store
            </Link>
          )}
          <ArchiveToggle productId={product._id} archived={product.archived} name={product.name} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <Panel title="Details">
          {/* The form keeps its own draft; the header and inventory stay live. */}
          <ProductForm key={product._id} product={product} />
        </Panel>
        <div className="space-y-6">
          <StockAdjuster productId={product._id} stock={product.stock} />
          <StockHistory productId={product._id} />
        </div>
      </div>
    </div>
  );
}

function ArchiveToggle({ productId, archived, name }: { productId: Id<"products">; archived: boolean; name: string }) {
  const archive = useMutation(api.products.archive);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await archive({ id: productId, archived: !archived });
      toast.success(archived ? `Restored “${name}”` : `Archived “${name}”`);
      setConfirming(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update this product"));
    } finally {
      setBusy(false);
    }
  }

  if (archived) {
    return (
      <Button variant="outline" onClick={() => void toggle()} disabled={busy}>
        {busy ? "Restoring…" : "Restore to store"}
      </Button>
    );
  }

  if (confirming) {
    return (
      <div role="group" aria-label="Confirm archive" className="flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1">
        <span className="text-sm">Hide from the store?</span>
        <Button variant="destructive" onClick={() => void toggle()} disabled={busy}>
          {busy ? "Archiving…" : "Archive"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button variant="destructive" onClick={() => setConfirming(true)}>
      Archive
    </Button>
  );
}

function StockAdjuster({ productId, stock }: { productId: Id<"products">; stock: bigint }) {
  const formId = useId();
  const adjust = useMutation(api.products.adjustStock);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{1,6}$/.test(quantity.trim()) || Number(quantity) === 0) {
      setError("Enter a whole number of units greater than zero.");
      return;
    }
    const amount = BigInt(quantity.trim());
    const delta = direction === "add" ? amount : -amount;
    setSaving(true);
    try {
      // `expectedStock` is the level this admin saw; the server rejects the
      // adjustment if a purchase or another admin changed it meanwhile.
      const result = await adjust({ productId, expectedStock: stock, quantityDelta: delta, reason });
      toast.success(`Stock is now ${result.resultingStock.toString()}`);
      setQuantity("");
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't adjust stock"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Inventory" actions={<StockLabel stock={stock} />}>
      <p className="mb-4 text-3xl font-semibold tabular-nums" aria-live="polite">
        {stock.toString()}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">units on hand</span>
      </p>
      <form onSubmit={handleSubmit} aria-label="Adjust stock" aria-describedby={error ? `${formId}-error` : undefined} className="space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <label className="space-y-1">
            <span className="block text-xs font-medium">Change</span>
            <select value={direction} onChange={(event) => setDirection(event.target.value as "add" | "remove")} className={selectClass}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Units</span>
            <Input required inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Reason</span>
          <Input
            required
            placeholder="e.g. Restock delivery, damaged, recount"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <FormError id={`${formId}-error`} message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Record adjustment"}
        </Button>
      </form>
    </Panel>
  );
}

const REASON_LABELS: Record<string, string> = {
  order_placed: "Order placed",
  order_cancelled: "Order cancelled",
};

function StockHistory({ productId }: { productId: Id<"products"> }) {
  const movements = useQuery(api.products.getStockMovements, { productId, limit: 50 });

  return (
    <Panel title="Stock history">
      {movements === undefined ? (
        <div className="space-y-2" aria-busy aria-label="Loading stock history">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <HistoryIcon aria-hidden className="size-4" />
          No stock changes yet.
        </p>
      ) : (
        <ol className="-my-2 divide-y text-sm">
          {movements.map((movement) => {
            const positive = movement.quantityDelta > BigInt(0);
            return (
              <li key={movement._id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">
                    {REASON_LABELS[movement.reason] ?? movement.reason}
                    {movement.orderId && (
                      <>
                        {" · "}
                        <Link href={`/admin/orders/${movement.orderId}`} className="underline-offset-4 hover:underline">
                          #{shortOrderId(movement.orderId)}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(movement._creationTime)} · {movement.actorName}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className={positive ? "font-medium text-primary" : "font-medium text-destructive"}>
                    {positive ? "+" : ""}
                    {movement.quantityDelta.toString()}
                  </p>
                  <p className="text-xs text-muted-foreground">→ {movement.resultingStock.toString()}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy aria-label="Loading product">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
