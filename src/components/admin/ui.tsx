import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function AdminPage({ title, actions, children, description }: { title: string; actions?: ReactNode; children: ReactNode; description?: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-ink-200 bg-white p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-xs font-bold tracking-wide text-ink-500 uppercase";
export const td = "border-b border-ink-100 px-4 py-3 align-top";

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 transition hover:border-ink-300">
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function FilterTabs({ items, active }: { items: { label: string; href: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto" aria-label="Filter">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === active ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap", i.key === active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100")}>
          {i.label}
          {i.count !== undefined && <span className={cn("ml-1.5 text-xs", i.key === active ? "text-white/70" : "text-ink-400")}>{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
