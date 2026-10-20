import { describe, expect, it } from "vitest";
import { acknowledgeBy, ageLabel, formatTicket, grievanceFlags, isOverdue, normaliseTicket, resolveBy, TICKET_PATTERN, ticketYear } from "@/lib/grievances/rules";
import { isIndianPhone } from "@/lib/validation";

const at = (iso: string) => new Date(iso);
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("ticket numbers", () => {
  it("formats year and zero-padded sequence", () => {
    expect(formatTicket(2026, 123)).toBe("GRV-2026-000123");
    expect(formatTicket(2026, 1)).toBe("GRV-2026-000001");
    expect(formatTicket(2027, 999_999)).toBe("GRV-2027-999999");
  });
  it("keeps extra digits past a million and still matches the pattern", () => {
    expect(formatTicket(2026, 1_000_000)).toBe("GRV-2026-1000000");
    expect(TICKET_PATTERN.test(formatTicket(2026, 1_000_000))).toBe(true);
  });
  it("rejects invalid sequences", () => {
    expect(() => formatTicket(2026, 0)).toThrow();
    expect(() => formatTicket(2026, 1.5)).toThrow();
  });
  it("normalises what people type", () => {
    expect(normaliseTicket(" grv-2026-000123 ")).toBe("GRV-2026-000123");
    expect(normaliseTicket("GRV 2026 123")).toBe("GRV-2026-000123");
    expect(normaliseTicket("GRV2026-42")).toBe("GRV-2026-000042");
    expect(normaliseTicket("MYT-261004-7KQ2XD")).toBeNull();
    expect(normaliseTicket("GRV-2026-000000")).toBeNull();
    expect(normaliseTicket("")).toBeNull();
  });
  it("uses the calendar year in India time", () => {
    expect(ticketYear(at("2026-12-31T18:00:00Z"))).toBe(2026); // 23:30 IST
    expect(ticketYear(at("2026-12-31T18:30:00Z"))).toBe(2027); // 00:00 IST on 1 Jan
  });
});

describe("deadlines", () => {
  it("acknowledgement is due 48 hours after receipt", () => {
    expect(acknowledgeBy(at("2026-10-15T10:00:00Z")).toISOString()).toBe("2026-10-17T10:00:00.000Z");
  });
  it("resolution is due one calendar month later when that is within 30 days", () => {
    expect(resolveBy(at("2026-02-10T10:00:00Z")).toISOString()).toBe("2026-03-10T10:00:00.000Z"); // 28 days
    expect(resolveBy(at("2026-01-31T10:00:00Z")).toISOString()).toBe("2026-02-28T10:00:00.000Z"); // clamped to month end
    expect(resolveBy(at("2028-01-31T10:00:00Z")).toISOString()).toBe("2028-02-29T10:00:00.000Z"); // leap year
  });
  it("resolution is due after 30 days when the month is longer", () => {
    expect(resolveBy(at("2026-03-15T10:00:00Z")).toISOString()).toBe("2026-04-14T10:00:00.000Z");
    expect(resolveBy(at("2026-12-20T10:00:00Z")).toISOString()).toBe("2027-01-19T10:00:00.000Z");
  });
});

describe("overdue flags", () => {
  const received = at("2026-10-01T09:00:00Z");
  const base = { status: "OPEN" as const, createdAt: received, acknowledgedAt: null };

  it("nothing is overdue inside 48 hours", () => {
    expect(grievanceFlags(base, new Date(received.getTime() + 47 * HOUR))).toEqual({ ackOverdue: false, resolveOverdue: false });
  });
  it("flags a complaint not acknowledged within 48 hours", () => {
    const now = new Date(received.getTime() + 49 * HOUR);
    expect(grievanceFlags(base, now)).toEqual({ ackOverdue: true, resolveOverdue: false });
    expect(isOverdue(base, now)).toBe(true);
  });
  it("acknowledged tickets are not flagged for acknowledgement", () => {
    const g = { ...base, status: "IN_PROGRESS" as const, acknowledgedAt: new Date(received.getTime() + 2 * HOUR) };
    expect(grievanceFlags(g, new Date(received.getTime() + 5 * DAY))).toEqual({ ackOverdue: false, resolveOverdue: false });
  });
  it("flags unresolved tickets past the one-month deadline", () => {
    const g = { ...base, status: "IN_PROGRESS" as const, acknowledgedAt: new Date(received.getTime() + 2 * HOUR) };
    expect(grievanceFlags(g, new Date(received.getTime() + 31 * DAY))).toEqual({ ackOverdue: false, resolveOverdue: true });
  });
  it("resolved and closed tickets are never overdue", () => {
    const late = new Date(received.getTime() + 60 * DAY);
    expect(isOverdue({ ...base, status: "RESOLVED" }, late)).toBe(false);
    expect(isOverdue({ ...base, status: "CLOSED" }, late)).toBe(false);
  });
});

describe("ageLabel", () => {
  const t = at("2026-10-01T09:00:00Z");
  it("shows hours, then days", () => {
    expect(ageLabel(t, new Date(t.getTime() + 10 * 60_000))).toBe("under 1 h");
    expect(ageLabel(t, new Date(t.getTime() + 5 * HOUR))).toBe("5 h");
    expect(ageLabel(t, new Date(t.getTime() + 3 * DAY))).toBe("3 days");
  });
});

describe("isIndianPhone", () => {
  it.each(["9876543210", "+91 98765 43210", "098765 43210", "040-2345 6789", "(040) 23456789", "080 4567 8901", "1800 123 4567", "1800-102-5678"])("accepts %s", (v) => {
    expect(isIndianPhone(v)).toBe(true);
  });
  it.each(["", "12345", "98765432101", "+1 415 555 0100", "0000000000", "phone", "98765-4321x"])("rejects %s", (v) => {
    expect(isIndianPhone(v)).toBe(false);
  });
});
