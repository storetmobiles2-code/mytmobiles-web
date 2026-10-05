import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import StoreNotFound from "./(store)/not-found";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown URLs outside the store routes still get the store's header, footer and help. */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <StoreNotFound />
      </main>
      <Footer />
    </>
  );
}
