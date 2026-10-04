import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { logout } from "@/app/actions/auth";

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile & security" },
  { href: "/wishlist", label: "Wishlist" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  return (
    <div className="container-page py-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <div className="card p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Hello,</p>
            <p className="truncate font-bold">{user.name}</p>
            <nav aria-label="Account" className="mt-3 flex gap-1 overflow-x-auto lg:flex-col">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-ink-700 hover:bg-ink-100">{l.label}</Link>
              ))}
              {user.role === "ADMIN" && <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-brand-700 hover:bg-brand-50">Admin dashboard</Link>}
              <form action={logout}>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-ink-500 hover:bg-ink-100">Sign out</button>
              </form>
            </nav>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
