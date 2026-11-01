import Link from "next/link";
import type { ReactNode } from "react";

import { PageShell } from "@/components/layout/page";

const navLink =
  "rounded-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell className="space-y-0 py-10 sm:py-12">
      <nav className="mb-10 flex max-w-prose items-center justify-between text-sm">
        <Link href="/" className={`${navLink} font-medium underline-offset-4 hover:underline`}>
          Riftbound Deckbuilder
        </Link>
        <div className="flex gap-4 text-muted-foreground">
          <Link href="/legal/terms" className={`${navLink} hover:text-foreground`}>
            Terms
          </Link>
          <Link href="/legal/privacy" className={`${navLink} hover:text-foreground`}>
            Privacy
          </Link>
        </div>
      </nav>

      <article className="max-w-prose space-y-6 leading-7 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-colors [&_a:hover]:text-primary [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:scroll-mt-20 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6">
        {children}
      </article>

      <footer className="mt-16 max-w-prose border-t pt-6 text-sm text-muted-foreground">
        <p>Last updated: 2026-11-01</p>
        <p className="mt-2">
          Riftbound Deckbuilder is a free, fan-made project and is not
          endorsed by Riot Games.
        </p>
      </footer>
    </PageShell>
  );
}
