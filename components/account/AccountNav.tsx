"use client";

import { BadgeCheckIcon, HeartIcon, MapPinIcon, PackageIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account/orders", label: "Orders", icon: PackageIcon },
  { href: "/account/favorites", label: "Favorites", icon: HeartIcon },
  { href: "/account/addresses", label: "Addresses", icon: MapPinIcon },
  { href: "/account/membership", label: "Membership", icon: BadgeCheckIcon },
  { href: "/account/profile", label: "Profile", icon: UserIcon },
] as const;

export default function AccountNav() {
  return <AccountNavLinks pathname={usePathname()} />;
}

// Rendered without a pathname as the prerendered fallback, then with one once
// the request URL streams in.
export function AccountNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
