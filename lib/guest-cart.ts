"use client";

import { useSyncExternalStore } from "react";
import { MAX_DISTINCT_PRODUCTS, MAX_ITEM_QUANTITY } from "@/lib/constants";

// A guest cart lives only in this browser. It never holds an account's cart,
// so signing out or switching accounts cannot expose another user's items.
const STORAGE_KEY = "quickcrate:guest-cart:v1";
const CHANGE_EVENT = "quickcrate:guest-cart-change";
const MAX_QUANTITY = Number(MAX_ITEM_QUANTITY);

export type GuestCartItem = { productId: string; quantity: number };

export type GuestCart = {
  // Regenerated whenever contents change, so retrying a merge of the same
  // contents is deduplicated by the server while new contents merge again.
  mergeKey: string;
  items: GuestCartItem[];
};

const EMPTY: GuestCart = { mergeKey: "", items: [] };

let cachedRaw: string | null = null;
let cachedCart: GuestCart = EMPTY;

function parse(raw: string | null): GuestCart {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<GuestCart>;
    if (typeof value.mergeKey !== "string" || !Array.isArray(value.items)) {
      return EMPTY;
    }
    const items = value.items
      .filter(
        (item): item is GuestCartItem =>
          typeof item?.productId === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0
      )
      .map((item) => ({
        productId: item.productId,
        quantity: Math.min(item.quantity, MAX_QUANTITY),
      }))
      .slice(0, MAX_DISTINCT_PRODUCTS);
    return { mergeKey: value.mergeKey, items };
  } catch {
    return EMPTY;
  }
}

function read(): GuestCart {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedCart = parse(raw);
  }
  return cachedCart;
}

function write(items: GuestCartItem[]) {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      const cart: GuestCart = { mergeKey: crypto.randomUUID(), items };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }
  } catch {
    // Storage can be unavailable (private mode, quota); the cart stays as is.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  // `storage` fires in other tabs; the custom event covers this tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useGuestCart(): GuestCart {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function setGuestQuantity(productId: string, quantity: number) {
  const items = read().items;
  const next = Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY);
  const existing = items.find((item) => item.productId === productId);

  if (!existing && next > 0 && items.length >= MAX_DISTINCT_PRODUCTS) {
    throw new Error(
      `Cart limit of ${MAX_DISTINCT_PRODUCTS} distinct products reached`
    );
  }

  const updated = existing
    ? items
        .map((item) =>
          item.productId === productId ? { ...item, quantity: next } : item
        )
        .filter((item) => item.quantity > 0)
    : next > 0
      ? [...items, { productId, quantity: next }]
      : items;
  write(updated);
}

export function clearGuestCart(onlyIfMergeKey?: string) {
  if (onlyIfMergeKey !== undefined && read().mergeKey !== onlyIfMergeKey) {
    // Another tab changed the guest cart after this merge started; keep it.
    return;
  }
  write([]);
}
