"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, use, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/AccountProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import {
  type GuestCart,
  clearGuestCart,
  setGuestQuantity,
  useGuestCart,
} from "@/lib/guest-cart";

export type AccountCart = FunctionReturnType<typeof api.cart.get>;

type CartContextValue = {
  status: "loading" | "guest" | "account";
  accountCart: AccountCart | undefined;
  guestCart: GuestCart;
  count: number;
  quantityOf: (productId: string) => number;
  isPending: (productId: string) => boolean;
  setQuantity: (productId: Id<"products">, quantity: number) => Promise<boolean>;
  // Guest items waiting for the signed-in user to merge or discard them.
  pendingGuestItems: number;
  merging: boolean;
  mergeGuestCart: () => Promise<void>;
  discardGuestCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  // Remount per identity so no pending state carries across account switches.
  const key = account.status === "ready" ? account.clerkUserId : account.status;
  return (
    <CartState key={key} status={account.status}>
      {children}
    </CartState>
  );
}

function CartState({
  status: accountStatus,
  children,
}: {
  status: ReturnType<typeof useAccount>["status"];
  children: React.ReactNode;
}) {
  const isAccount = accountStatus === "ready";
  const status = isAccount ? "account" : accountStatus === "guest" ? "guest" : "loading";

  const guestCart = useGuestCart();
  const accountCart = useQuery(api.cart.get, isAccount ? {} : "skip");
  const addItem = useMutation(api.cart.addItem);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeItem = useMutation(api.cart.removeItem);
  const merge = useMutation(api.cart.mergeGuestCart);

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [merging, setMerging] = useState(false);

  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    if (status === "account") {
      for (const item of accountCart?.items ?? []) {
        map.set(item.productId, Number(item.quantity));
      }
    } else if (status === "guest") {
      for (const item of guestCart.items) map.set(item.productId, item.quantity);
    }
    return map;
  }, [status, accountCart, guestCart]);

  const count = useMemo(
    () => [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0),
    [quantities]
  );

  const quantityOf = useCallback(
    (productId: string) => quantities.get(productId) ?? 0,
    [quantities]
  );

  const setQuantity = useCallback(
    async (productId: Id<"products">, quantity: number) => {
      if (status === "loading") return false;
      if (status === "guest") {
        try {
          setGuestQuantity(productId, quantity);
          return true;
        } catch (error) {
          toast.error(errorMessage(error));
          return false;
        }
      }

      const current = quantities.get(productId) ?? 0;
      setPending((prev) => new Set(prev).add(productId));
      try {
        if (quantity <= 0) {
          await removeItem({ productId });
        } else if (current === 0) {
          await addItem({ productId, quantity: BigInt(quantity) });
        } else {
          await updateQuantity({ productId, quantity: BigInt(quantity) });
        }
        return true;
      } catch (error) {
        toast.error(errorMessage(error, "Couldn't update your cart"));
        return false;
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [status, quantities, addItem, updateQuantity, removeItem]
  );

  const isPending = useCallback((productId: string) => pending.has(productId), [pending]);

  const mergeGuestCart = useCallback(async () => {
    if (!isAccount || guestCart.items.length === 0) return;
    const { mergeKey, items } = guestCart;
    setMerging(true);
    try {
      const result = await merge({
        mergeKey,
        items: items.map((item) => ({
          productId: item.productId as Id<"products">,
          quantity: BigInt(item.quantity),
        })),
      });
      clearGuestCart(mergeKey);
      const notes = [
        ...result.adjustedItems.map(
          (item: { name: string; reason: string }) => `${item.name}: ${item.reason}`
        ),
        ...result.unavailableItems.map(
          (item: { name?: string; reason: string }) =>
            `${item.name ?? "An item"}: ${item.reason}`
        ),
      ];
      if (notes.length > 0) {
        toast.warning("Some items changed while merging", {
          description: notes.join("\n"),
          duration: 10000,
        });
      } else {
        toast.success("Items added to your cart");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't merge your items. Please try again."));
    } finally {
      setMerging(false);
    }
  }, [isAccount, guestCart, merge]);

  const discardGuestCart = useCallback(() => {
    clearGuestCart(guestCart.mergeKey);
  }, [guestCart.mergeKey]);

  const value: CartContextValue = {
    status,
    accountCart,
    guestCart,
    count,
    quantityOf,
    isPending,
    setQuantity,
    pendingGuestItems: isAccount ? guestCart.items.length : 0,
    merging,
    mergeGuestCart,
    discardGuestCart,
  };

  return <CartContext value={value}>{children}</CartContext>;
}
