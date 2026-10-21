import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/guards";
import { getPendingSignIn } from "@/lib/auth/two-factor";
import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/auth-forms";
import { cancelTwoFactor } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false } };

export default async function VerifyPage(props: PageProps<"/login/verify">) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next, "");
  if (!(await getPendingSignIn())) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return (
    <AuthCard
      title="Two-factor sign-in"
      subtitle="Open your authenticator app and enter the 6-digit code for myT Mobiles."
      footer={
        <form action={cancelTwoFactor}>
          <button className="font-semibold text-brand-700 hover:underline">Cancel and sign in again</button>
        </form>
      }
    >
      <TwoFactorForm next={next} />
    </AuthCard>
  );
}
