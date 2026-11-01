"use client";

import { useSession } from "@better-auth-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { UserButton } from "@/components/auth/user/user-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";

const links = [
  { href: "/cards", label: "Cards" },
  { href: "/decks", label: "Decks" },
  { href: "/collection", label: "Collection" },
  { href: "/friends", label: "Friends" },
  { href: "/borrow", label: "Borrow" },
];

const linkClass =
  "rounded-md px-2.5 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_0_-2px_0_0_var(--primary)]";

function NavLinks({ pathname }: { pathname: string | null }) {
  return links.map((l) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={
        pathname === l.href || pathname?.startsWith(l.href + "/")
          ? "page"
          : undefined
      }
      className={linkClass}
    >
      {l.label}
    </Link>
  ));
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

export function SiteHeader() {
  const { data: session, isPending } = useSession(authClient);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:flex-nowrap sm:gap-x-6 sm:py-0">
        <Link
          href="/"
          className="shrink-0 rounded-md font-semibold tracking-tight outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 max-sm:flex-1"
        >
          Riftbound Deckbuilder
        </Link>
        <nav className="order-last -mx-2.5 flex w-full items-center gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <ActiveNavLinks />
          </Suspense>
        </nav>
        {isPending ? (
          // Same box as the signed-in UserButton (h-10, max-w-48) so nothing shifts when it resolves.
          <Skeleton className="h-10 w-44 rounded-md border border-border bg-muted" aria-hidden="true" />
        ) : session ? (
          <UserButton hideSettings variant="outline" className="h-10 w-44 max-w-48 py-1.5" />
        ) : (
          <Button asChild className="h-10 px-5">
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
