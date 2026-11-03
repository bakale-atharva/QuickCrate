import { Suspense } from "react";
import GuestMergePrompt from "@/components/cart/GuestMergePrompt";
import Logo from "@/components/Logo";
import AccountControls from "@/components/storefront/AccountControls";
import CartButton from "@/components/storefront/CartButton";
import CategoryNav from "@/components/storefront/CategoryNav";
import SearchBar from "@/components/storefront/SearchBar";
import { Input } from "@/components/ui/input";

function SearchFallback({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Input aria-label="Search groceries" placeholder="Search milk, rice, apples…" disabled />
    </div>
  );
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-14 items-center gap-3 sm:gap-6">
          <Logo />
          <Suspense fallback={<SearchFallback className="hidden flex-1 md:block" />}>
            <SearchBar className="hidden flex-1 md:block" />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <CartButton />
            <AccountControls />
          </div>
        </div>
        <Suspense fallback={<SearchFallback className="pb-2 md:hidden" />}>
          <SearchBar className="pb-2 md:hidden" />
        </Suspense>
        <Suspense fallback={<div className="h-11" />}>
          <CategoryNav />
        </Suspense>
      </div>
      <GuestMergePrompt />
    </header>
  );
}
