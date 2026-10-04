import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "./tokens";
import type { Role } from "@/generated/prisma/enums";

const SESSION_DAYS = 30;
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-myt_session" : "myt_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  emailVerified: boolean;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Creates a session and sets the cookie. Only callable from Server Actions / Route Handlers. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const h = await headers();
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ipAddress: await clientIp(),
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/** Resolves the signed-in user for this request (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.isDisabled) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    emailVerified: Boolean(u.emailVerifiedAt),
  };
});
