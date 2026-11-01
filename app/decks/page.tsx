import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { CompletenessBar } from "@/components/decks/completeness-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { decks } from "@/lib/db/schema";
import {
  getBorrowSources,
  getCardsByIds,
  getOwnedQtyByCardId,
  loadDecks,
  type DeckWithEntries,
} from "@/lib/data/queries";
import { computeBorrowable, rankDecksByCompleteness } from "@/lib/decks/completeness";

export const metadata = { title: "Decks | Riftbound Deckbuilder" };

async function DeckList({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const user = await getCurrentUser();
  const all = await loadDecks(eq(decks.isPublic, true));

  const legendIds = [...new Set(all.map((d) => d.legendCardId).filter((x): x is string => !!x))];
  const legends = await getCardsByIds(legendIds);

  const pct = new Map<string, { own: number; friends: number | null }>();
  if (user) {
    const owned = await getOwnedQtyByCardId(user.id);
    const sources = await getBorrowSources(user.id);
    for (const { deck, completeness } of rankDecksByCompleteness(all, owned)) {
      pct.set(deck.id, {
        own: completeness.totals.percent,
        friends: sources.length ? computeBorrowable(completeness, sources).percentWithFriends : null,
      });
    }
  }

  const closest = sort === "closest" && !!user;
  const byUpdated = (a: DeckWithEntries, b: DeckWithEntries) => b.updatedAt.getTime() - a.updatedAt.getTime();
  const sorted = [...all].sort((a, b) => {
    if (closest) {
      return (pct.get(b.id)?.own ?? 0) - (pct.get(a.id)?.own ?? 0) || byUpdated(a, b);
    }
    return Number(b.isFeatured) - Number(a.isFeatured) || byUpdated(a, b);
  });

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user ? (
          <>
            <Button asChild size="sm" variant={closest ? "outline" : "default"}>
              <Link href="/decks">Featured first</Link>
            </Button>
            <Button asChild size="sm" variant={closest ? "default" : "outline"}>
              <Link href="/decks?sort=closest">Closest to buildable</Link>
            </Button>
            <span className="flex-1" />
            <Button asChild size="sm" variant="outline">
              <Link href="/decks/mine">My decks</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/decks/new">New deck</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/auth/sign-in" className="underline">
              Sign in
            </Link>{" "}
            to see how complete each deck is for your collection.
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No decks yet. Run <code>npm run db:seed</code> to load the development deck.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {sorted.map((d) => {
            const p = pct.get(d.id);
            const legend = d.legendCardId ? legends.get(d.legendCardId) : undefined;
            const event = [d.eventName, d.placement].filter(Boolean).join(" · ");
            return (
              <li key={d.id}>
                <Link
                  href={`/decks/${d.id}`}
                  className="flex flex-col gap-3 p-4 hover:bg-accent/50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.name}</span>
                      {d.isFeatured && <Badge>Featured</Badge>}
                      {d.source === "META" && <Badge variant="secondary">Meta</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {legend ? `Legend: ${legend.name}` : "No legend"}
                      {event ? ` · ${event}` : ""}
                    </p>
                  </div>
                  {p && (
                    <div className="flex gap-4 sm:w-72">
                      <CompletenessBar percent={p.own} label="You own" className="flex-1" />
                      {p.friends !== null && (
                        <CompletenessBar percent={p.friends} label="With friends" className="flex-1" />
                      )}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function DecksPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Decks</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Featured tournament decks first, then public community decks.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
        <DeckList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
