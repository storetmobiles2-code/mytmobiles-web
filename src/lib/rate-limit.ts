import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances. Returns true if the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int)
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int)
                     THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}

export async function pruneRateLimits(): Promise<number> {
  return db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < now() - interval '1 day'`;
}
