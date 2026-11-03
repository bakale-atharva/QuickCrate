"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { BadgeCheckIcon, HeartIcon, MapPinIcon, PackageIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { useAccount } from "@/components/AccountProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AccountControls() {
  const account = useAccount();
  const isAdmin = account.status === "ready" && account.me.role === "admin";

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden sm:inline-flex")}
        >
          <ShieldIcon aria-hidden />
          Admin
        </Link>
      )}
      <Show when="signed-in" fallback={<SignedOutControls />}>
        <Link
          href="/account/orders"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden sm:inline-flex")}
        >
          <PackageIcon aria-hidden />
          Orders
        </Link>
        <div className="flex size-9 items-center justify-center">
          <UserButton userProfileMode="navigation" userProfileUrl="/account/profile">
            <UserButton.MenuItems>
              <UserButton.Link label="Orders" labelIcon={<PackageIcon className="size-4" />} href="/account/orders" />
              <UserButton.Link label="Favorites" labelIcon={<HeartIcon className="size-4" />} href="/account/favorites" />
              <UserButton.Link label="Addresses" labelIcon={<MapPinIcon className="size-4" />} href="/account/addresses" />
              <UserButton.Link
                label="Membership"
                labelIcon={<BadgeCheckIcon className="size-4" />}
                href="/account/membership"
              />
              {isAdmin && (
                <UserButton.Link label="Admin" labelIcon={<ShieldIcon className="size-4" />} href="/admin" />
              )}
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </Show>
    </div>
  );
}

function SignedOutControls() {
  const account = useAccount();
  if (account.status === "loading") {
    return <Skeleton className="h-9 w-20" />;
  }
  return (
    <SignInButton mode="modal">
      <Button size="lg">Sign in</Button>
    </SignInButton>
  );
}
