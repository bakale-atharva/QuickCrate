import SiteHeader from "@/components/storefront/SiteHeader";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>QuickCrate — your friendly neighborhood grocery, online.</p>
          <p>Prices include taxes. Delivery ₹49, free for members. Cash on delivery.</p>
        </div>
      </footer>
    </div>
  );
}
