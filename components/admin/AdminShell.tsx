"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { ArrowLeftIcon, LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/components/AccountProvider";
import Logo from "@/components/Logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [{ href: "/admin", label: "Overview", icon: LayoutDashboardIcon }] as const;

// Admin APIs enforce the role on the server; this gate only avoids rendering
// tools a visitor cannot use.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const account = useAccount();

  if (account.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy>
        <Skeleton className="h-8 w-48" />
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
      <Notice
        title="You don't have access"
        body="This account isn't a store administrator."
      >
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Back to the store
        </Link>
      </Notice>
    );
  }

  return <AdminFrame>{children}</AdminFrame>;
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const links = NAV.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        pathname === href && "bg-muted text-foreground"
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Link>
  ));

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 md:flex-row">
      <aside className="border-b bg-background md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo href="/admin" label="QuickCrate Admin" />
          <div className="md:hidden">
            <UserButton />
          </div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {links}
        </nav>
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="pt-2">{children}</div>
      </div>
    </main>
  );
}
