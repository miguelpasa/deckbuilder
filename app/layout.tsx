import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Riftbound Deckbuilder",
  description: "Track your Riftbound card collection and see how complete each deck is for you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-border">
            <div className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-6">
              <p className="max-w-3xl">
                Riftbound Deckbuilder isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the
                views or opinions of Riot Games or anyone officially involved in producing or
                managing Riot Games properties. Riot Games, and all associated properties are
                trademarks or registered trademarks of Riot Games, Inc.
              </p>
              <p className="flex gap-4">
                <Link
                  href="/legal/terms"
                  className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Terms
                </Link>
                <Link
                  href="/legal/privacy"
                  className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Privacy
                </Link>
              </p>
            </div>
          </footer>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
