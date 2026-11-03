export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  packing: "Packing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_STEPS: OrderStatus[] = [
  "placed",
  "confirmed",
  "packing",
  "out_for_delivery",
  "delivered",
];

// Customers may cancel only before the store confirms the order.
export function customerCanCancel(status: OrderStatus): boolean {
  return status === "placed";
}

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(timestamp: number): string {
  return dateTime.format(new Date(timestamp));
}

export function shortOrderId(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}
