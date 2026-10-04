import type { Metadata } from "next";
import { verifyEmail } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const token = (await props.searchParams).token;
  const ok = typeof token === "string" && token.length >= 20 ? await verifyEmail(token) : false;
  return (
    <AuthCard title={ok ? "Email verified" : "Link expired or invalid"}>
      <p className="text-sm text-ink-700">{ok ? "Thanks! Your email address is confirmed." : "This verification link can't be used. You can request a new one from your account page."}</p>
      <ButtonLink href="/account" className="mt-6 w-full">Go to my account</ButtonLink>
    </AuthCard>
  );
}
