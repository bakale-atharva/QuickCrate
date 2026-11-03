// Convex wraps server errors as "[CONVEX M(fn)] [Request ID: …] Server Error
// Uncaught Error: <message>\n    at handler …". Show only <message>.
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const match = raw.match(/Uncaught Error: (.+?)(?:\n|$)/);
  const message = (match?.[1] ?? raw).trim();
  if (!message || message === "Server Error" || message.startsWith("[CONVEX")) {
    return fallback;
  }
  return message;
}
