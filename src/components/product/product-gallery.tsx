"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Minus, Plus, Rotate3d, X } from "lucide-react";
import { ProductImage } from "./product-image";
import { SpinViewer } from "./spin-viewer";
import { withBase } from "@/lib/demo";
import { cn } from "@/lib/cn";

export interface GalleryImage {
  url: string;
  alt: string;
  view?: string | null;
}

export interface GallerySpin {
  frames: string[];
}

const VIEW_LABEL: Record<string, string> = {
  front: "Front",
  back: "Back",
  "front-back": "Front and back",
  side: "Side",
  angle: "Angled",
  detail: "Detail",
  lifestyle: "In use",
  box: "In the box",
};
export const viewLabel = (view?: string | null) => (view ? (VIEW_LABEL[view] ?? view) : null);

/**
 * Product photo gallery: every official view of the selected colour, with
 * arrows, swipe, keyboard, a full-screen zoom view and, when a real frame
 * sequence exists, a 360° spin.
 */
export function ProductGallery({ images, spin, name }: { images: GalleryImage[]; spin: GallerySpin | null; name: string }) {
  const total = images.length + (spin ? 1 : 0);
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const isSpin = spin !== null && index === images.length;
  const current = images[index];

  const go = (by: number) => setIndex((i) => (total ? (i + by + total) % total : 0));

  if (!total) return <div className="card p-3 sm:p-5"><ProductImage image={null} name={name} sizes="(min-width:1024px) 45vw, 100vw" /></div>;

  return (
    <div className="min-w-0">
      <div
        className="card group relative p-3 sm:p-5"
        onKeyDown={(e) => {
          if (isSpin) return; // the spin viewer uses the arrow keys itself
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        {isSpin ? (
          <SpinViewer frames={spin.frames} name={name} />
        ) : (
          <div
            className="relative touch-pan-y"
            onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
            onPointerUp={(e) => {
              const s = swipe.current;
              swipe.current = null;
              if (!s || e.pointerType === "mouse") return;
              const dx = e.clientX - s.x;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1);
            }}
          >
            <button type="button" onClick={() => setZoomOpen(true)} className="block w-full cursor-zoom-in" aria-label={`Open full-screen view of ${current.alt}`}>
              <ProductImage image={current} name={name} priority={index === 0} sizes="(min-width:1024px) 45vw, 100vw" />
            </button>
            {viewLabel(current.view) && (
              <span className="pointer-events-none absolute top-1 left-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-sm ring-1 ring-ink-100">{viewLabel(current.view)}</span>
            )}
            <span className="pointer-events-none absolute right-1 bottom-1 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs text-ink-500 ring-1 ring-ink-100">
              <Expand className="h-3 w-3" aria-hidden="true" /> {index + 1} / {total}
            </span>
          </div>
        )}
        {total > 1 && !isSpin && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute top-1/2 left-2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow ring-1 ring-ink-200 transition hover:bg-white sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100" aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute top-1/2 right-2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow ring-1 ring-ink-200 transition hover:bg-white sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100" aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product views">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${viewLabel(img.view)?.toLowerCase() ?? `image ${i + 1}`} view`}
                aria-current={i === index}
                className={cn("relative block h-16 w-16 overflow-hidden rounded-xl border-2 bg-white", i === index ? "border-brand-600" : "border-ink-200 hover:border-ink-400")}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-contain p-1" />
              </button>
            </li>
          ))}
          {spin && (
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(images.length)}
                aria-label="Show 360° view"
                aria-current={isSpin}
                className={cn("relative grid h-16 w-16 place-items-center overflow-hidden rounded-xl border-2 bg-white", isSpin ? "border-brand-600" : "border-ink-200 hover:border-ink-400")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized spin frame */}
                <img src={withBase(spin.frames[0])} alt="" className="absolute inset-0 h-full w-full object-contain p-1 opacity-40" />
                <span className="relative flex flex-col items-center text-[11px] leading-tight font-bold text-brand-700">
                  <Rotate3d className="h-5 w-5" aria-hidden="true" />
                  360°
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {zoomOpen && current && (
        <ZoomView
          images={images}
          start={index}
          name={name}
          onClose={(i) => {
            setZoomOpen(false);
            setIndex(i);
          }}
        />
      )}
    </div>
  );
}

/** Full-screen viewer. Tap or click toggles 2.5× zoom at that point; move to pan while zoomed. */
function ZoomView({ images, start, name, onClose }: { images: GalleryImage[]; start: number; name: string; onClose: (index: number) => void }) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const img = images[index];
  const go = (by: number) => {
    setZoom(null);
    setIndex((i) => (i + by + images.length) % images.length);
  };
  const point = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  return (
    <dialog
      ref={(el) => {
        dialog.current = el;
        if (el && !el.open) el.showModal();
      }}
      aria-label={`${name} photos`}
      onCancel={(e) => {
        e.preventDefault();
        onClose(index);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <p className="truncate text-sm font-semibold">
            {name}
            {viewLabel(img.view) ? <span className="font-normal text-ink-500"> · {viewLabel(img.view)}</span> : null}
            <span className="font-normal text-ink-500"> · {index + 1}/{images.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => (z ? null : { x: 50, y: 50 }))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink-100" aria-label={zoom ? "Zoom out" : "Zoom in"}>
              {zoom ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </button>
            <button type="button" onClick={() => onClose(index)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-ink-100" aria-label="Close" autoFocus>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          className={cn("relative flex-1 overflow-hidden touch-none", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
          onPointerUp={(e) => setZoom((z) => (z ? null : point(e)))}
          onPointerMove={(e) => zoom && e.pointerType === "mouse" && setZoom(point(e))}
        >
          <div className="absolute inset-0 transition-transform duration-200" style={zoom ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}>
            <Image src={img.url} alt={img.alt} fill sizes="100vw" className="object-contain p-4" />
          </div>
          {images.length > 1 && !zoom && (
            <>
              <button type="button" onPointerUp={(e) => e.stopPropagation()} onClick={() => go(-1)} className="absolute top-1/2 left-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white shadow ring-1 ring-ink-200" aria-label="Previous image">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onPointerUp={(e) => e.stopPropagation()} onClick={() => go(1)} className="absolute top-1/2 right-3 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white shadow ring-1 ring-ink-200" aria-label="Next image">
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <ul className="no-scrollbar flex justify-center gap-2 overflow-x-auto border-t border-ink-100 px-4 py-3">
            {images.map((im, i) => (
              <li key={im.url} className="shrink-0">
                <button type="button" onClick={() => {
                    setZoom(null);
                    setIndex(i);
                  }} aria-current={i === index} aria-label={`Show ${viewLabel(im.view)?.toLowerCase() ?? `image ${i + 1}`} view`} className={cn("relative block h-14 w-14 overflow-hidden rounded-lg border-2 bg-white", i === index ? "border-brand-600" : "border-ink-200")}>
                  <Image src={im.url} alt="" fill sizes="56px" className="object-contain p-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
