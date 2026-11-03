// A checkout submission keeps one idempotency key until an order is
// confirmed, so a retry after a lost response (or a page reload) returns the
// original order instead of placing a second one.

export type PendingSubmission = {
  idempotencyKey: string;
  // The quote last submitted with this key; retried as-is to recover an order
  // whose response was lost.
  quoteId: string | null;
};

const storageKey = (clerkUserId: string) => `quickcrate:checkout:${clerkUserId}`;

export function loadSubmission(clerkUserId: string): PendingSubmission {
  try {
    const raw = sessionStorage.getItem(storageKey(clerkUserId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PendingSubmission>;
      if (typeof parsed.idempotencyKey === "string" && parsed.idempotencyKey) {
        return {
          idempotencyKey: parsed.idempotencyKey,
          quoteId: typeof parsed.quoteId === "string" ? parsed.quoteId : null,
        };
      }
    }
  } catch {
    // Storage unavailable or corrupt: fall through to a fresh key.
  }
  return { idempotencyKey: crypto.randomUUID(), quoteId: null };
}

export function saveSubmission(clerkUserId: string, submission: PendingSubmission) {
  try {
    sessionStorage.setItem(storageKey(clerkUserId), JSON.stringify(submission));
  } catch {
    // Without storage the key still lives in memory for this page.
  }
}

export function clearSubmission(clerkUserId: string) {
  try {
    sessionStorage.removeItem(storageKey(clerkUserId));
  } catch {
    // Nothing to clear.
  }
}
