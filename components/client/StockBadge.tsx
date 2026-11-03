import { cn } from "@/lib/utils";

const LOW_STOCK = BigInt(10);

export default function StockBadge({ stock, className }: { stock: bigint; className?: string }) {
  if (stock <= BigInt(0)) {
    return <span className={cn("text-xs font-medium text-destructive", className)}>Out of stock</span>;
  }
  if (stock <= LOW_STOCK) {
    return <span className={cn("text-xs font-medium text-amber-700 dark:text-amber-400", className)}>Only {stock.toString()} left</span>;
  }
  return <span className={cn("text-xs text-muted-foreground", className)}>In stock</span>;
}
