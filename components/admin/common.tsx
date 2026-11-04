"use client";

import Link from "next/link";
import { Component } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Native <select> and <textarea> styled to match <Input>.
export const selectClass =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";
export const textareaClass =
  "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-14 text-center">
      <Icon aria-hidden className="size-9 text-muted-foreground" strokeWidth={1.25} />
      <h2 className="font-medium">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  className,
  actions,
  children,
}: {
  title: string;
  className?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FormError({ id, message }: { id?: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

// Admin detail queries throw for unknown or malformed IDs; show those as
// "not found" instead of the route-level error screen.
export class NotFoundBoundary extends Component<
  { children: React.ReactNode; title: string; backHref: string; backLabel: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="rounded-xl border border-dashed bg-background px-6 py-16 text-center">
          <h2 className="font-medium">{this.props.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed, or the link is incorrect.
          </p>
          <Link href={this.props.backHref} className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            {this.props.backLabel}
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export function StatusPill({ tone, children }: { tone: "neutral" | "good" | "bad" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "good" && "bg-primary/10 text-primary",
        tone === "bad" && "bg-destructive/10 text-destructive",
        tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      {children}
    </span>
  );
}
