"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { BadgeCheckIcon, BanknoteIcon, CheckCircle2Icon, PlusIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddressForm from "@/components/account/AddressForm";
import RequireAccount from "@/components/account/RequireAccount";
import type { Account } from "@/components/AccountProvider";
import { useCart } from "@/components/cart/CartProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  type PendingSubmission,
  clearSubmission,
  loadSubmission,
  saveSubmission,
} from "@/lib/checkout-submission";
import { errorMessage } from "@/lib/errors";
import { formatPaise } from "@/lib/format";
import { shortOrderId } from "@/lib/order-status";
import { cn } from "@/lib/utils";

type Quote = FunctionReturnType<typeof api.checkout.quote>;
type ReadyAccount = Extract<Account, { status: "ready" }>;

export default function CheckoutView() {
  return (
    <RequireAccount message="Sign in to choose a delivery address and place your order." fallback={<CheckoutSkeleton />}>
      {(account) => <Checkout key={account.clerkUserId} account={account} />}
    </RequireAccount>
  );
}

function Checkout({ account }: { account: ReadyAccount }) {
  const { clerkUserId } = account;
  const router = useRouter();
  const { accountCart } = useCart();
  const addresses = useQuery(api.addresses.list, {});
  const membership = useQuery(api.memberships.getMyMembership, {});
  const requestQuote = useAction(api.checkout.quote);
  const placeOrder = useAction(api.checkout.placeOrder);

  const [submission, setSubmission] = useState<PendingSubmission>(() => loadSubmission(clerkUserId));
  // A previous attempt whose response never arrived may already be an order.
  const recentOrders = useQuery(api.orders.getMyOrders, submission.quoteId ? { limit: 5 } : "skip");
  const recovered = submission.quoteId
    ? recentOrders?.find((order) => order.quoteId === submission.quoteId)
    : undefined;

  const [chosenAddressId, setChosenAddressId] = useState<Id<"addresses"> | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; quote?: Quote; error?: string } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedAddress =
    addresses?.find((a) => a._id === chosenAddressId) ??
    addresses?.find((a) => a.isDefault) ??
    addresses?.[0];
  const addressId = selectedAddress?._id;

  const cartReady = accountCart !== undefined && accountCart.items.length > 0;
  const unavailable = accountCart?.items.filter((item) => !item.available) ?? [];
  const suspended = account.me.suspended === true;

  // Any change the server prices on — address, cart contents or prices,
  // membership — asks for a fresh quote. Nothing is quoted mid-placement,
  // because placing an order clears the cart.
  const quoteKey =
    addressId && cartReady && membership !== undefined && unavailable.length === 0 && !suspended && !placing && !recovered
      ? [addressId, accountCart.revision, accountCart.subtotalPaise, membership.eligible, refreshNonce].join(":")
      : null;

  useEffect(() => {
    if (!quoteKey || !addressId) return;
    let cancelled = false;
    requestQuote({ addressId }).then(
      (quote) => {
        if (!cancelled) setResult({ key: quoteKey, quote });
      },
      (error: unknown) => {
        if (!cancelled) {
          setResult({ key: quoteKey, error: errorMessage(error, "We couldn't price your order. Please try again.") });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [quoteKey, addressId, requestQuote]);

  const current = result && result.key === quoteKey ? result : null;
  const quote = current?.quote;
  const quoteLoading = quoteKey !== null && current === null;
  const expired = quote ? now >= quote.expiresAt : false;

  function refreshQuote() {
    setPlaceError(null);
    setRefreshNonce((n) => n + 1);
  }

  async function submit(quoteId: Id<"checkoutQuotes">) {
    const pending = { idempotencyKey: submission.idempotencyKey, quoteId };
    saveSubmission(clerkUserId, pending);
    setSubmission(pending);
    setPlacing(true);
    setPlaceError(null);
    try {
      const order = await placeOrder(pending);
      clearSubmission(clerkUserId);
      router.replace(`/account/orders/${order.orderId}?placed=1`);
    } catch (error) {
      // The key is kept, so retrying can never place a second order.
      setPlaceError(
        errorMessage(error, "We couldn't confirm your order. Retrying is safe — it never places a duplicate.")
      );
      setPlacing(false);
    }
  }

  function startNewCheckout() {
    clearSubmission(clerkUserId);
    setSubmission(loadSubmission(clerkUserId));
  }

  if (recovered) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
        <CheckCircle2Icon aria-hidden className="size-10 text-primary" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold">Your last order went through</h2>
        <p className="text-sm text-muted-foreground">
          Order #{shortOrderId(recovered._id)} was placed for {formatPaise(recovered.totalPaise)}, even though we lost
          the confirmation.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href={`/account/orders/${recovered._id}`} className={buttonVariants({ size: "lg", className: "px-4" })}>
            View order
          </Link>
          <Button variant="outline" size="lg" className="px-4" onClick={startNewCheckout}>
            Start a new checkout
          </Button>
        </div>
      </div>
    );
  }

  if (accountCart === undefined || addresses === undefined || membership === undefined) {
    return <CheckoutSkeleton />;
  }

  if (accountCart.items.length === 0 && !placing) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <h2 className="font-medium">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground">Add a few groceries before checking out.</p>
        <Link href="/search" className={buttonVariants({ size: "lg", className: "mt-2 px-4" })}>
          Start shopping
        </Link>
      </div>
    );
  }

  const blocker = suspended
    ? "Ordering is suspended for this account. Contact support for help."
    : unavailable.length > 0
      ? `${unavailable.length} ${unavailable.length === 1 ? "item in your cart is" : "items in your cart are"} unavailable. Remove ${unavailable.length === 1 ? "it" : "them"} to continue.`
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-6">
        <section aria-labelledby="address-heading" className="rounded-xl border bg-card p-5">
          <h2 id="address-heading" className="mb-4 font-semibold">
            1. Delivery address
          </h2>
          {addresses.length > 0 && !addingAddress && (
            <fieldset className="space-y-2" disabled={placing}>
              <legend className="sr-only">Choose a delivery address</legend>
              {addresses.map((doc) => (
                <AddressOption
                  key={doc._id}
                  doc={doc}
                  checked={doc._id === addressId}
                  onSelect={() => setChosenAddressId(doc._id)}
                />
              ))}
            </fieldset>
          )}
          {addresses.length === 0 || addingAddress ? (
            <div className={addresses.length > 0 ? "border-t pt-4" : undefined}>
              {addresses.length === 0 && (
                <p className="mb-4 text-sm text-muted-foreground">Add where we should deliver your groceries.</p>
              )}
              <AddressForm
                submitLabel="Deliver here"
                onSaved={(id) => {
                  setChosenAddressId(id);
                  setAddingAddress(false);
                }}
                onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
              />
            </div>
          ) : (
            <Button variant="outline" className="mt-3" onClick={() => setAddingAddress(true)} disabled={placing}>
              <PlusIcon aria-hidden />
              Add a new address
            </Button>
          )}
        </section>

        <section aria-labelledby="payment-heading" className="rounded-xl border bg-card p-5">
          <h2 id="payment-heading" className="mb-3 font-semibold">
            2. Payment
          </h2>
          <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <BanknoteIcon aria-hidden className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Cash on delivery</p>
              <p className="text-xs text-muted-foreground">Pay the delivery partner when your order arrives.</p>
            </div>
          </div>
        </section>
      </div>

      <aside aria-labelledby="review-heading" className="rounded-xl border bg-card p-5 lg:sticky lg:top-36">
        <h2 id="review-heading" className="mb-4 font-semibold">
          3. Review your order
        </h2>
        {blocker ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {blocker}
            </p>
            {!suspended && (
              <Link href="/cart" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                Back to cart
              </Link>
            )}
          </div>
        ) : !addressId ? (
          <p className="text-sm text-muted-foreground">Add a delivery address to see your total.</p>
        ) : quoteLoading || (placing && !quote) ? (
          <QuoteSkeleton />
        ) : current?.error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {current.error}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={refreshQuote}>
                <RefreshCwIcon aria-hidden />
                Try again
              </Button>
              <Link href="/cart" className={buttonVariants({ variant: "outline" })}>
                Back to cart
              </Link>
            </div>
          </div>
        ) : quote ? (
          <QuoteReview
            quote={quote}
            expired={expired}
            secondsLeft={Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))}
            placing={placing}
            placeError={placeError}
            onPlace={() => void submit(quote.quoteId)}
            onRefresh={refreshQuote}
          />
        ) : null}
      </aside>
    </div>
  );
}

function AddressOption({
  doc,
  checked,
  onSelect,
}: {
  doc: Doc<"addresses">;
  checked: boolean;
  onSelect: () => void;
}) {
  const a = doc.address;
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      <input
        type="radio"
        name="delivery-address"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        onChange={onSelect}
      />
      <span className="space-y-0.5">
        <span className="flex items-center gap-2 font-medium">
          {a.fullName}
          {doc.isDefault && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-normal text-muted-foreground">
              Default
            </span>
          )}
        </span>
        <span className="block text-muted-foreground">
          {[a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(", ")}
        </span>
        {a.phone && <span className="block text-muted-foreground">{a.phone}</span>}
      </span>
    </label>
  );
}

function QuoteReview({
  quote,
  expired,
  secondsLeft,
  placing,
  placeError,
  onPlace,
  onRefresh,
}: {
  quote: Quote;
  expired: boolean;
  secondsLeft: number;
  placing: boolean;
  placeError: string | null;
  onPlace: () => void;
  onRefresh: () => void;
}) {
  // Errors that mean the reviewed prices no longer hold need a fresh quote;
  // anything else (e.g. a dropped connection) is safe to retry as-is.
  const needsReview = placeError !== null && /review|expired|changed|stock|no longer available/i.test(placeError);

  return (
    <div className="space-y-4">
      <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
        {quote.items.map((item) => (
          <li key={item.productId} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate">{item.name}</span>
              <span className="text-xs text-muted-foreground">
                {item.packLabel} · {item.quantity.toString()} × {formatPaise(item.unitPricePaise)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatPaise(item.unitPricePaise * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatPaise(quote.subtotalPaise)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="tabular-nums">
            {quote.membershipEligible ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <BadgeCheckIcon aria-hidden className="size-3.5" />
                Free for members
              </span>
            ) : (
              formatPaise(quote.deliveryFeePaise)
            )}
          </dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total (incl. taxes)</dt>
          <dd className="tabular-nums">{formatPaise(quote.totalPaise)}</dd>
        </div>
      </dl>
      {!quote.membershipEligible && (
        <p className="text-xs text-muted-foreground">
          Members get free delivery.{" "}
          <Link href="/account/membership?returnTo=/checkout" className="font-medium text-primary hover:underline">
            See QuickCrate Plus
          </Link>
        </p>
      )}

      {placeError && (
        <p role="alert" className="text-sm text-destructive">
          {placeError}
        </p>
      )}

      {expired || needsReview ? (
        <div className="space-y-2">
          {expired && !placeError && (
            <p className="text-sm text-muted-foreground">These prices have expired. Review the latest prices to continue.</p>
          )}
          <Button size="lg" className="h-10 w-full" onClick={onRefresh}>
            <RefreshCwIcon aria-hidden />
            Review updated prices
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button size="lg" className="h-10 w-full" onClick={onPlace} disabled={placing}>
            {placing ? "Placing order…" : placeError ? "Retry placing order" : `Place order · ${formatPaise(quote.totalPaise)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Prices held for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </p>
        </div>
      )}
    </div>
  );
}

function QuoteSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Calculating your total">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" aria-busy aria-label="Loading checkout">
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
