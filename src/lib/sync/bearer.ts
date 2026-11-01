import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * True when the request carries `Authorization: Bearer <secret>`. Compared in
 * constant time; an unset secret never matches, so the endpoint stays closed
 * until it is configured.
 */
export function bearerMatches(req: NextRequest, secret: string | undefined): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
