"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface ClientSession {
  user: { name: string; role: "CUSTOMER" | "ADMIN" } | null;
  cartCount: number;
  wishlist: string[];
  razorpayEnabled: boolean;
}

const EMPTY: ClientSession = { user: null, cartCount: 0, wishlist: [], razorpayEnabled: false };
const Ctx = createContext<{ session: ClientSession; loaded: boolean; refresh: () => Promise<void> }>({
  session: EMPTY,
  loaded: false,
  refresh: async () => {},
});

export const SESSION_CHANGED = "myt:session-changed";

/** Notify the header etc. that cart / auth / wishlist state changed. */
export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

/**
 * Personalised header state is fetched client-side so catalogue pages stay
 * fully cacheable (no cookies read during server rendering).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientSession>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
      if (res.ok) setSession(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(SESSION_CHANGED, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(SESSION_CHANGED, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);
  return <Ctx.Provider value={{ session, loaded, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
