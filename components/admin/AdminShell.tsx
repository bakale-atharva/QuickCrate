"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import {
  ArrowLeftIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAccount } from "@/components/AccountProvider";
import Logo from "@/components/Logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/admin/orders", label: "Orders", icon: ReceiptTextIcon },
  { href: "/admin/products", label: "Products", icon: PackageIcon },
  { href: "/admin/categories", label: "Categories", icon: TagsIcon },
  { href: "/admin/customers", label: "Customers", icon: UsersIcon },
] as const;

function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// The frame always renders its children so every admin page segment renders
// (and prerenders); each page gates its own content with <RequireAdmin>.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  const isAdmin = account.status === "ready" && account.me.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 md:flex-row">
      <aside className="border-b bg-background md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo href="/admin" label="QuickCrate Admin" />
          <div className="md:hidden">
            <UserButton />
          </div>
        </div>
        {isAdmin && (
          <Suspense fallback={<AdminNavLinks pathname={null} />}>
            <AdminNav />
          </Suspense>
        )}
        <div className="hidden items-center justify-between gap-2 border-t p-3 md:absolute md:inset-x-0 md:bottom-0 md:flex">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
            <ArrowLeftIcon aria-hidden />
            Store
          </Link>
          <UserButton />
        </div>
      </aside>
      <main id="main" className="flex-1 px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}

function AdminNav() {
  return <AdminNavLinks pathname={usePathname()} />;
}

function AdminNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            isActive(pathname, href) && "bg-muted text-foreground"
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Admin APIs enforce the role on the server; this gate only avoids rendering
// tools (and running admin queries) for a visitor who cannot use them.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const account = useAccount();

  if (account.status === "loading") {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (account.status === "guest") {
    return (
      <Notice title="Sign in to continue" body="The admin area is for store staff.">
        <SignInButton mode="modal">
          <Button size="lg">Sign in</Button>
        </SignInButton>
      </Notice>
    );
  }

  if (account.status === "error" || account.me.role !== "admin") {
    return (
      <Notice title="You don't have access" body="This account isn't a store administrator.">
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to the store
        </Link>
      </Notice>
    );
  }

  return children;
}

function Notice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}
