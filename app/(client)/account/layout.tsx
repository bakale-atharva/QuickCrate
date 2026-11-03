import { Suspense } from "react";
import AccountNav, { AccountNavLinks } from "@/components/account/AccountNav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[200px_1fr] md:gap-10">
        <aside>
          <h1 className="mb-3 text-lg font-semibold tracking-tight">Your account</h1>
          <Suspense fallback={<AccountNavLinks pathname={null} />}>
            <AccountNav />
          </Suspense>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
