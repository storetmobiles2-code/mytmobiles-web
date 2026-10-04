import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next, "");
  if (await getCurrentUser()) redirect(next || "/account");
  return (
    <AuthCard
      title="Sign in"
      subtitle="Track orders, save addresses and check out faster."
      footer={<>New to myT Mobiles? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">Create an account</Link></>}
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
