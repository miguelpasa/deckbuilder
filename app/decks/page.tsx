import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { DomainBadge } from "@/components/cards/domain-badge";
import { CompletenessBar } from "@/components/decks/completeness-bar";
import { PageHeader, PageShell } from "@/components/layout/page";
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

async function DeckListActions() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href="/decks/mine">My decks</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/decks/new">New deck</Link>
      </Button>
    </>
  );
}

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
      {user ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={closest ? "outline" : "default"}>
            <Link href="/decks" aria-current={closest ? undefined : "true"}>
              Featured first
            </Link>
          </Button>
          <Button asChild size="sm" variant={closest ? "default" : "outline"}>
            <Link href="/decks?sort=closest" aria-current={closest ? "true" : undefined}>
              Closest to buildable
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/sign-in" className="underline underline-offset-4 transition-colors hover:text-foreground">
            Sign in
          </Link>{" "}
          to see how complete each deck is for your collection.
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No decks yet. Run <code className="font-mono text-xs">npm run db:seed</code> to load the development deck.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {sorted.map((d) => {
            const p = pct.get(d.id);
            const legend = d.legendCardId ? legends.get(d.legendCardId) : undefined;
            const event = [d.eventName, d.placement].filter(Boolean).join(" · ");
            return (
              <li key={d.id}>
                <Link
                  href={`/decks/${d.id}`}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.name}</span>
                      {d.isFeatured && <Badge variant="outline">Featured</Badge>}
                      {d.source === "META" && <Badge variant="secondary">Meta</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span>{legend ? `Legend: ${legend.name}` : "No legend"}</span>
                      {legend && <DomainBadge domain={legend.faction} />}
                      {event && <span>{event}</span>}
                    </div>
                  </div>
                  {p && (
                    <div className="flex gap-4 sm:w-72 sm:justify-end">
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
    <PageShell>
      <PageHeader
        title="Decks"
        description="Featured tournament decks first, then public community decks."
        actions={
          <Suspense fallback={null}>
            <DeckListActions />
          </Suspense>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading decks…</p>}>
        <DeckList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
