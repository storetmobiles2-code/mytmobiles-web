"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { formatINR } from "@/lib/money";
import { DEMO, loadDemoData, matchesQuery } from "@/lib/demo";

interface Suggestion {
  slug: string;
  name: string;
  priceFrom: number;
  image: string | null;
}

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  // The static preview's HTML was rendered without a query, so start empty there to hydrate cleanly.
  const [q, setQ] = useState(DEMO ? "" : (params.get("q") ?? ""));
  const [fetched, setFetched] = useState<Suggestion[]>([]);
  // Suggestions only apply to a 2+ character query; derived so clearing the box hides them at once.
  const items = q.trim().length >= 2 ? fetched : [];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        if (DEMO) {
          const { products } = await loadDemoData();
          setFetched(products.filter((p) => matchesQuery(p, term)).slice(0, 6).map((p) => ({ slug: p.slug, name: p.name, priceFrom: p.priceFrom, image: p.images[0]?.url ?? null })));
          return;
        }
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: abort.current.signal });
        if (res.ok) setFetched((await res.json()).items);
      } catch {
        /* aborted or offline — suggestions are optional */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function submit(term = q) {
    const t = term.trim();
    setOpen(false);
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && items[active]) router.push(`/p/${items[active].slug}`);
        else submit();
        setOpen(false);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
      <input
        id={`${listId}-input`}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search mobiles, TVs, coolers…"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className="h-11 w-full rounded-xl border border-transparent bg-white pr-10 pl-11 text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-ink-500 hover:text-ink-700" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-[var(--shadow-pop)]">
          {items.map((it, i) => (
            <li
              key={it.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push(`/p/${it.slug}`);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? "bg-brand-50" : ""}`}
            >
              {it.image ? (
                <Image src={it.image} alt="" width={40} height={40} sizes="40px" className="h-10 w-10 rounded-md object-contain" />
              ) : (
                <span className="h-10 w-10 rounded-md bg-ink-100" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{it.name}</span>
              <span className="text-sm font-semibold text-ink-700 tabular-nums">{formatINR(it.priceFrom)}</span>
            </li>
          ))}
          <li role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); submit(); }} className="cursor-pointer border-t border-ink-100 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            See all results for “{q.trim()}”
          </li>
        </ul>
      )}
    </form>
  );
}
