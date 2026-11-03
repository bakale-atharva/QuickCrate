"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export default function CategoryNav() {
  const categories = useQuery(api.categories.list, {});
  const pathname = usePathname();

  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-1 py-2 text-sm">
        <li>
          <NavLink href="/" active={pathname === "/"}>
            Home
          </NavLink>
        </li>
        {categories === undefined
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-7 w-24" />
              </li>
            ))
          : categories.map((category) => {
              const href = `/categories/${category.slug}`;
              return (
                <li key={category._id}>
                  <NavLink href={href} active={pathname === href}>
                    {category.name}
                  </NavLink>
                </li>
              );
            })}
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2.5 font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
