import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PasswordForm, ProfileForm } from "@/components/account/profile-forms";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card p-5"><h1 className="mb-4 text-xl font-extrabold">Profile</h1><ProfileForm name={u.name} phone={u.phone ?? ""} email={u.email} marketingOptIn={u.marketingOptIn} /></section>
      <section className="card p-5"><h2 className="mb-4 text-xl font-extrabold">Change password</h2><PasswordForm /></section>
    </div>
  );
}
