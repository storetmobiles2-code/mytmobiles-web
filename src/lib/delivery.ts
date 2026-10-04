/**
 * Delivery promise logic. Pure, so it can be unit-tested; the pincode lookup
 * that feeds it lives in ./pincode.ts.
 */
import { normaliseState } from "./gst";

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export type DeliveryBand = "LOCAL" | "STATE" | "NATIONAL" | "REMOTE";

export interface DeliverySettings {
  pincode: string;
  state: string;
  deliveryDaysLocal: number;
  deliveryDaysState: number;
  deliveryDaysNational: number;
  deliveryDaysRemote: number;
  remotePincodePrefixes: string[];
  blockedPincodes: string[];
  codBlockedPincodes: string[];
  codEnabled: boolean;
}

export interface DeliveryEstimate {
  serviceable: boolean;
  band: DeliveryBand;
  codAvailable: boolean;
  minDays: number;
  maxDays: number;
  from: Date;
  to: Date;
}

/** Orders after this hour (IST) are dispatched the next day. */
const CUTOFF_HOUR_IST = 14;

export function deliveryBand(
  destPincode: string,
  destState: string | null,
  s: Pick<DeliverySettings, "pincode" | "state" | "remotePincodePrefixes">,
): DeliveryBand {
  if (s.remotePincodePrefixes.some((p) => p && destPincode.startsWith(p))) return "REMOTE";
  // Same 3-digit sorting district ≈ same city.
  if (s.pincode && destPincode.slice(0, 3) === s.pincode.slice(0, 3)) return "LOCAL";
  if (s.state && destState && normaliseState(destState) === normaliseState(s.state)) return "STATE";
  return "NATIONAL";
}

function istHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(d),
  );
}

/** Adds business days, skipping Sundays (most Indian couriers don't deliver on Sundays). */
export function addDeliveryDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const istDay = new Date(d.getTime() + 5.5 * 3600 * 1000).getUTCDay();
    if (istDay !== 0) added++;
  }
  return d;
}

export function estimateDelivery(
  destPincode: string,
  destState: string | null,
  s: DeliverySettings,
  now: Date = new Date(),
): DeliveryEstimate {
  const band = deliveryBand(destPincode, destState, s);
  const serviceable = PINCODE_PATTERN.test(destPincode) && !s.blockedPincodes.includes(destPincode);
  const base = {
    LOCAL: s.deliveryDaysLocal,
    STATE: s.deliveryDaysState,
    NATIONAL: s.deliveryDaysNational,
    REMOTE: s.deliveryDaysRemote,
  }[band];
  const cutoffDelay = istHour(now) >= CUTOFF_HOUR_IST ? 1 : 0;
  const minDays = base + cutoffDelay;
  const maxDays = minDays + (band === "LOCAL" ? 1 : 2);
  return {
    serviceable,
    band,
    codAvailable: serviceable && s.codEnabled && !s.codBlockedPincodes.includes(destPincode),
    minDays,
    maxDays,
    from: addDeliveryDays(now, minDays),
    to: addDeliveryDays(now, maxDays),
  };
}

export function formatDeliveryDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}
