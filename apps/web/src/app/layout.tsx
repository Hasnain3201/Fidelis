import type { Metadata } from "next";
import { GuestAuthNudge } from "@/components/guest-auth-nudge";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BackToTop } from "@/components/back-to-top";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIVEY",
  description: "Wherever you are, find fun activities around you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SiteHeader />
        <main>{children}</main>
        <GuestAuthNudge />
        <SiteFooter />
        <BackToTop />
      </body>
    </html>
  );
}
