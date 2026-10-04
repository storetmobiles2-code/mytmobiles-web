import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "deal"; className?: string }) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-mint-50 text-mint-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-danger-50 text-danger-700",
    info: "bg-sky-50 text-sky-800",
    deal: "bg-deal-50 text-deal-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Rating({ value, count, size = "sm" }: { value: number; count: number; size?: "sm" | "md" }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-700">
      <span className={cn("inline-flex items-center gap-0.5 rounded-md bg-mint-600 px-1.5 font-semibold text-white", size === "md" ? "py-0.5 text-sm" : "text-xs")}>
        {value.toFixed(1)} <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      </span>
      <span className="text-ink-500">
        ({count.toLocaleString("en-IN")})<span className="sr-only"> ratings</span>
      </span>
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-600">{icon}</div>}
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-scrollbar overflow-x-auto">
      <ol className="flex items-center gap-1 text-sm whitespace-nowrap text-ink-500">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-300" aria-hidden="true" />}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="hover:text-brand-700 hover:underline">
                {c.name}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-ink-700">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const window = [...new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))].sort((a, b) => a - b);
  const cls = "inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link className={cn(cls, "border border-ink-200 bg-white hover:bg-ink-50")} href={hrefFor(page - 1)} rel="prev">
          Previous
        </Link>
      )}
      {window.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - window[i - 1] > 1 && <span className="px-1 text-ink-400">…</span>}
          {p === page ? (
            <span aria-current="page" className={cn(cls, "bg-brand-600 text-white")}>
              {p}
            </span>
          ) : (
            <Link className={cn(cls, "border border-ink-200 bg-white hover:bg-ink-50")} href={hrefFor(p)}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < pages && (
        <Link className={cn(cls, "border border-ink-200 bg-white hover:bg-ink-50")} href={hrefFor(page + 1)} rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}

export function SectionHeading({ title, subtitle, href, linkLabel = "View all" }: { title: string; subtitle?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
