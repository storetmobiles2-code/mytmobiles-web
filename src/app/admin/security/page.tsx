import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth/guards";
import { encryptionKeyProblem, getTwoFactorStatus, ISSUER, pendingEnrolmentSecret, twoFactorEnforced } from "@/lib/auth/two-factor";
import { formatManualKey, otpauthUri } from "@/lib/auth/totp";
import { RECOVERY_CODE_COUNT } from "@/lib/auth/two-factor-crypto";
import { startTwoFactorSetup } from "@/app/admin/actions/security";
import { AdminPage, Panel } from "@/components/admin/ui";
import { DisableForm, EnrolForm, RegenerateCodesForm } from "@/components/admin/security-forms";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Security" };

const APPS = "Google Authenticator, Microsoft Authenticator or a similar app";

export default async function SecurityPage() {
  const user = await requireAdmin();
  const enforced = twoFactorEnforced();
  const keyProblem = encryptionKeyProblem();
  const status = await getTwoFactorStatus(user.id);

  if (keyProblem) {
    return (
      <AdminPage title="Security">
        <Panel title="Two-factor sign-in is not available">
          <p className="text-sm text-danger-700" role="alert">{keyProblem}</p>
          <p className="mt-2 text-sm text-ink-700">Ask the developer to set it in the hosting environment, then reload this page.</p>
        </Panel>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Security"
      description="Two-factor sign-in protects the admin panel if your password is ever stolen. After your password, you enter a 6-digit code from an app on your phone."
    >
      {!status.enabled && enforced && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink-900">
          Admin accounts must use two-factor sign-in. Set it up below to use the rest of the admin panel.
        </div>
      )}

      {status.enabled ? <EnabledView enabledAt={status.enabledAt} codesLeft={status.recoveryCodesLeft} enforced={enforced} /> : status.pendingSetup ? <SetupView userId={user.id} email={user.email} /> : <StartView />}
    </AdminPage>
  );
}

function StartView() {
  return (
    <Panel title="Two-factor sign-in is off">
      <p className="text-sm text-ink-700">You need {APPS} on your phone. Setting it up takes about two minutes.</p>
      <form action={startTwoFactorSetup} className="mt-4">
        <SubmitButton className="w-full sm:w-auto" pendingText="Preparing…">Set up two-factor sign-in</SubmitButton>
      </form>
    </Panel>
  );
}

async function SetupView({ userId, email }: { userId: string; email: string }) {
  const secret = (await pendingEnrolmentSecret(userId))!;
  // Rendered here on the server: the secret never goes to a third-party QR service.
  const svg = await QRCode.toString(otpauthUri({ secret, account: email, issuer: ISSUER }), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return (
    <Panel title="Set up two-factor sign-in">
      <ol className="space-y-5 text-sm text-ink-700">
        <li>
          <p className="font-semibold text-ink-900">1. Install an authenticator app</p>
          <p className="mt-1">Use {APPS}.</p>
        </li>
        <li>
          <p className="font-semibold text-ink-900">2. Scan this QR code with the app</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimise */}
          <img src={qrSrc} alt={`QR code to add ${ISSUER} to your authenticator app`} width={192} height={192} className="mt-2 rounded-lg border border-ink-200 bg-white" />
          <p className="mt-3">Can&apos;t scan it? Add an account by hand, choose a time-based code, and enter this setup key:</p>
          <p className="mt-1">
            <code data-testid="totp-setup-key" className="inline-block rounded-lg bg-ink-100 px-3 py-1.5 font-mono text-sm font-semibold break-all text-ink-900">
              {formatManualKey(secret)}
            </code>
          </p>
          <p className="mt-1 text-xs text-ink-500">Account: {email}</p>
        </li>
        <li>
          <p className="mb-2 font-semibold text-ink-900">3. Enter the code the app shows</p>
          <EnrolForm />
        </li>
      </ol>
      <form action={startTwoFactorSetup} className="mt-5 border-t border-ink-100 pt-4">
        <SubmitButton className="w-auto" variant="outline" pendingText="Preparing…">Start again with a new key</SubmitButton>
      </form>
    </Panel>
  );
}

function EnabledView({ enabledAt, codesLeft, enforced }: { enabledAt: Date | null; codesLeft: number; enforced: boolean }) {
  return (
    <>
      <Panel title="Two-factor sign-in">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
          <Badge tone="success">On</Badge>
          {enabledAt && <>Since {enabledAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}.</>}
        </p>
      </Panel>
      <Panel title="Recovery codes">
        <p className="mb-4 text-sm text-ink-700">
          {codesLeft} of {RECOVERY_CODE_COUNT} unused.{codesLeft <= 3 && " Create new ones soon."} For security, saved codes can&apos;t be shown again. Creating new codes replaces all the old ones.
        </p>
        <RegenerateCodesForm />
      </Panel>
      <Panel title="Turn off two-factor sign-in">
        <p className="mb-4 text-sm text-ink-700">
          Do this when you move to a new phone.
          {enforced && " Admin accounts must use two-factor sign-in, so you'll be asked to set it up again straight away."}
        </p>
        <DisableForm />
      </Panel>
    </>
  );
}
