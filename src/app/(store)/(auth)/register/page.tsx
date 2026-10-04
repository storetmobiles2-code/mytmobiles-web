import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/guards";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage(props: PageProps<"/register">) {
  const next = safeNext((await props.searchParams).next, "");
  if (await getCurrentUser()) redirect(next || "/account");
  return (
    <AuthCard
      title="Create your account"
      footer={<>Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}
