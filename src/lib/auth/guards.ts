import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";
import { canAccessAdmin, hasPermission, type Permission } from "./permissions";
import { enforceTwoFactor } from "./two-factor";

/** For pages: redirects to sign-in, preserving where the shopper was going. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For pages: anyone allowed into /admin at all (ADMIN or STAFF). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!canAccessAdmin(user.role)) redirect("/");
  await enforceTwoFactor(user, "page");
  return user;
}

/** For admin pages: needs one specific permission, otherwise shows the "no access" page. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!hasPermission(user.role, permission)) redirect("/admin/no-access");
  return user;
}

export class AuthError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For Server Actions / Route Handlers: throws instead of redirecting. Allows ADMIN or STAFF. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) throw new AuthError("Not authorised.");
  await enforceTwoFactor(user, "action");
  return user;
}

/** For Server Actions / Route Handlers: needs every listed permission, otherwise throws. */
export async function assertPermission(...permissions: [Permission, ...Permission[]]): Promise<SessionUser> {
  const user = await assertAdmin();
  for (const p of permissions) if (!hasPermission(user.role, p)) throw new AuthError("You don't have access to this.");
  return user;
}

/** Only allow same-site relative redirects (prevents open-redirects via ?next=). */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
