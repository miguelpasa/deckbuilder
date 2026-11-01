"use client";

import { useSession } from "@better-auth-ui/react";
import Link from "next/link";

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

export function SiteHeader() {
  const { data: session, isPending } = useSession(authClient);

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold">
          Riftbound Deckbuilder
        </Link>
        <nav className="flex flex-1 items-center gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        {isPending ? (
          <Skeleton className="h-8 w-24" />
        ) : session ? (
          <UserButton hideSettings />
        ) : (
          <Button asChild size="sm">
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
