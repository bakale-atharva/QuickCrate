import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

const TONES: Record<OrderStatus, string> = {
  placed: "bg-muted text-foreground",
  confirmed: "bg-primary/10 text-primary",
  packing: "bg-primary/10 text-primary",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[status], className)}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
