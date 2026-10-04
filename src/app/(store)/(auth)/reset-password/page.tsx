import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const token = (await props.searchParams).token;
  if (typeof token !== "string" || token.length < 20) {
    return (
      <AuthCard title="Link not valid" footer={<Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">Request a new link</Link>}>
        <p className="text-sm text-ink-700">This password reset link is incomplete or invalid.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" subtitle="You'll be signed out of other devices.">
      <ResetForm token={token} />
    </AuthCard>
  );
}
