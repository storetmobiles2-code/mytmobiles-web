import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Boxes, FileSpreadsheet, FolderTree, History, Image as ImageIcon, LayoutDashboard, MessageSquareText, MessageSquareWarning, Package, Settings, ShoppingCart, TicketPercent, UserCog, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { hasPermission, ROLE_LABEL, type Permission } from "@/lib/auth/permissions";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · myT Mobiles" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Each link shows only to people with the permission its page needs. */
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, permission: "orders.view" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products.view" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "products.view" },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons.manage" },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon, permission: "banners.manage" },
  { href: "/admin/categories", label: "Categories & brands", icon: FolderTree, permission: "categories.manage" },
  { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareText, permission: "reviews.moderate" },
  { href: "/admin/grievances", label: "Grievances", icon: MessageSquareWarning, permission: "grievances.manage" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view" },
  { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet, permission: "reports.view" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
  { href: "/admin/staff", label: "Staff", icon: UserCog, permission: "staff.manage" },
  { href: "/admin/activity", label: "Activity", icon: History, permission: "audit.view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-dvh flex-col bg-ink-50 lg:flex-row">
      <aside className="bg-brand-950 text-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:py-5">
          <Logo height={40} />
          <p className="text-xs text-white/50 lg:mt-2">{ROLE_LABEL[user.role]} · {user.name}</p>
        </div>
        <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.filter((n) => hasPermission(user.role, n.permission)).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-white/75 hover:bg-white/10 hover:text-white">
              <n.icon className="h-4 w-4" aria-hidden="true" /> {n.label}
            </Link>
          ))}
          <div className="mt-2 hidden border-t border-white/10 pt-2 lg:block" />
          <Link href="/" className="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-white/60 hover:bg-white/10">View store ↗</Link>
          <form action={logout}><button className="w-full rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap text-white/60 hover:bg-white/10">Sign out</button></form>
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
