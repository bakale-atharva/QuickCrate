import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

export default function CategoryCard({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      href={`/categories/${slug}`}
      className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border bg-card p-4 font-medium outline-none transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span>{name}</span>
      <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
