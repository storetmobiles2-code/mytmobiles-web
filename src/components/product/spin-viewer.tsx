"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Rotate3d } from "lucide-react";
import { withBase } from "@/lib/demo";

/**
 * 360° product spin from a real frame sequence. Frames load only when the viewer
 * opens; after loading it turns once on its own (unless the shopper prefers
 * reduced motion), then follows drags, swipes and the arrow keys.
 */
export function SpinViewer({ frames, name }: { frames: string[]; name: string }) {
  const urls = frames.map(withBase);
  const [loaded, setLoaded] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const drag = useRef<{ x: number; frame: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ready = loaded >= urls.length;

  // Preload every frame so rotation is smooth; track progress for the loading bar.
  useEffect(() => {
    let cancelled = false;
    let done = 0;
    for (const src of urls) {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        if (!cancelled) setLoaded(++done);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frames are fixed for this viewer
  }, []);

  // One automatic turn once everything has loaded.
  useEffect(() => {
    if (!ready || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = window.setTimeout(() => setPlaying(true), 150);
    return () => window.clearTimeout(start);
  }, [ready]);

  useEffect(() => {
    if (!playing) return;
    let steps = 0;
    const timer = window.setInterval(() => {
      setFrame((f) => (f + 1) % urls.length);
      if (++steps >= urls.length) setPlaying(false);
    }, Math.max(40, 2400 / urls.length));
    return () => window.clearInterval(timer);
  }, [playing, urls.length]);

  const step = useCallback((by: number) => setFrame((f) => (f + by + urls.length) % urls.length), [urls.length]);
  const turn = (by: number) => {
    setPlaying(false);
    step(by);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    setPlaying(false);
    drag.current = { x: e.clientX, frame };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !stage.current) return;
    // Dragging across the full width turns the product once.
    const perFrame = stage.current.clientWidth / urls.length;
    const delta = Math.round((drag.current.x - e.clientX) / perFrame);
    setFrame((((drag.current.frame + delta) % urls.length) + urls.length) % urls.length);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="relative">
      <div
        ref={stage}
        role="img"
        aria-label={`${name}, 360° view. Drag sideways or use the arrow keys to turn it.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setPlaying(false);
          step(e.key === "ArrowLeft" ? -1 : 1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-square w-full cursor-grab touch-pan-y overflow-hidden rounded-xl bg-white select-none active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- frames are pre-sized WebP, swapped every few ms */}
        <img src={urls[frame]} alt="" draggable={false} className="h-full w-full object-contain" />
        {!ready && (
          <div className="absolute inset-x-6 bottom-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="Loading 360° view" aria-valuemin={0} aria-valuemax={urls.length} aria-valuenow={loaded}>
              <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${(loaded / urls.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-center text-xs text-ink-500">Loading 360° view…</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
        <button type="button" onClick={() => turn(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white hover:bg-ink-50" aria-label="Turn left">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" disabled={!ready} onClick={() => setPlaying((p) => !p)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 font-semibold hover:bg-ink-50 disabled:opacity-50">
          {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {playing ? "Pause" : "Spin"}
        </button>
        <button type="button" onClick={() => turn(1)} className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white hover:bg-ink-50" aria-label="Turn right">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-1 inline-flex items-center gap-1 text-xs text-ink-500">
          <Rotate3d className="h-3.5 w-3.5" aria-hidden="true" /> Drag to turn
        </span>
      </div>
    </div>
  );
}
