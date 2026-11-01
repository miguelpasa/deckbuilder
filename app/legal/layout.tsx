import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <nav className="mb-10 flex items-center justify-between text-sm">
          <Link
            href="/"
            className="font-medium underline-offset-4 hover:underline"
          >
            Riftbound Deckbuilder
          </Link>
          <div className="flex gap-4 text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </nav>

        <article className="space-y-6 leading-7 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:scroll-mt-20 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6">
          {children}
        </article>

        <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
          <p>Last updated: 2026-11-01</p>
          <p className="mt-2">
            Riftbound Deckbuilder is a free, fan-made project and is not
            endorsed by Riot Games.
          </p>
        </footer>
      </div>
    </div>
  );
}
