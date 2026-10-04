"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  href: string;
  imageUrl: string | null;
  imageAlt: string | null;
  bgFrom: string;
  bgTo: string;
  textTone: string;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(index + 1), 6000);
    return () => clearInterval(t);
  });

  if (!slides.length) return null;
  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-3xl">
        {slides.map((s, i) => {
          const light = s.textTone !== "dark";
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${s.title}`}
              className="relative w-full shrink-0 snap-start"
              style={{ background: `linear-gradient(120deg, ${s.bgFrom}, ${s.bgTo})` }}
            >
              <div className="grid min-h-[260px] items-center gap-4 px-6 py-8 sm:min-h-[320px] sm:grid-cols-[1.1fr_1fr] sm:px-12 lg:min-h-[360px]">
                <div className={light ? "text-white" : "text-ink-900"}>
                  {s.eyebrow && <p className={`text-xs font-bold tracking-[0.18em] uppercase ${light ? "text-brand-400" : "text-brand-700"}`}>{s.eyebrow}</p>}
                  <h2 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">{s.title}</h2>
                  {s.subtitle && <p className={`mt-3 max-w-md text-sm sm:text-base ${light ? "text-white/80" : "text-ink-700"}`}>{s.subtitle}</p>}
                  <Link href={s.href} className={`mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-bold ${light ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-ink-900 text-white hover:bg-ink-700"}`} tabIndex={i === index ? 0 : -1}>
                    {s.ctaLabel}
                  </Link>
                </div>
                {s.imageUrl && (
                  <div className="relative mx-auto hidden aspect-square w-full max-w-[300px] sm:block lg:max-w-[340px]">
                    <div className="absolute inset-4 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-white p-4 shadow-2xl">
                      <Image src={s.imageUrl} alt={s.imageAlt ?? ""} fill sizes="340px" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : undefined} className="object-contain p-3" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white sm:block">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white sm:block">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index} className="flex h-6 min-w-6 items-center justify-center px-1">
                <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/50"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
