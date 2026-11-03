import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Logo({
  href = "/",
  label = "QuickCrate",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG app icon */}
      <img src="/icon.svg" alt="" width={28} height={28} className="size-7" />
      <span>{label}</span>
    </Link>
  );
}
