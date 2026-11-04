const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPaise(paise: bigint | number): string {
  return inr.format(Number(paise) / 100);
}

// Parses a rupee amount typed by an admin ("120", "120.5", "120.50") into
// integer paise without floating-point rounding. Returns null when invalid.
export function parseRupees(value: string): bigint | null {
  const match = value.trim().match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function paiseToRupeesInput(paise: bigint): string {
  const rupees = paise / BigInt(100);
  const rest = paise % BigInt(100);
  return rest === BigInt(0) ? rupees.toString() : `${rupees}.${rest.toString().padStart(2, "0")}`;
}
