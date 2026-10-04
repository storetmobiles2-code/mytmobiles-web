import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "@/components/layout/session-provider";
import { Analytics } from "@/components/layout/analytics";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "myT Mobiles — Mobiles, TVs & Appliances at Honest Prices", template: "%s | myT Mobiles" },
  description:
    "Shop the latest Samsung, Redmi, Apple, OPPO and vivo smartphones, smart TVs and air coolers at myT Mobiles. GST invoice, Cash on Delivery and secure online payments.",
  applicationName: "myT Mobiles",
  openGraph: { type: "website", siteName: "myT Mobiles", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={jakarta.variable}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <SessionProvider>
          {children}
          <Analytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        </SessionProvider>
      </body>
    </html>
  );
}
