import Link from "next/link";
import { or, eq } from "drizzle-orm";
import { Suspense } from "react";

import { PageHeader, PageShell } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { decks } from "@/lib/db/schema";
import { computeBorrowable, computeCompleteness } from "@/lib/decks/completeness";
import { getBorrowSources, getCardsByIds, getOwnedQtyByCardId, loadDecks } from "@/lib/data/queries";

export const metadata = { title: "Borrow" };

function Bar({ own, withFriends }: { own: number; withFriends: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className="absolute inset-y-0 left-0 bg-info/60 transition-[width]"
        style={{ width: `${Math.min(100, withFriends)}%` }}
      />
      <div className="absolute inset-y-0 left-0 bg-primary transition-[width]" style={{ width: `${Math.min(100, own)}%` }} />
    </div>
  );
}

function Legend({ own, withFriends }: { own: number; withFriends: number }) {
  const fromFriends = Math.max(0, withFriends - own);
  const missing = Math.max(0, 100 - Math.max(own, withFriends));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-primary" />
        Owned {own}%
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-info/60" />
        Friends have {fromFriends}%
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-muted-foreground/30" />
        Missing {missing}%
      </li>
    </ul>
  );
}

async function BorrowContent() {
  const user = await requireUser();
  const [owned, sources, deckRows] = await Promise.all([
    getOwnedQtyByCardId(user.id),
    getBorrowSources(user.id),
    loadDecks(or(eq(decks.isFeatured, true), eq(decks.isPublic, true))),
  ]);

  const rows = deckRows
    .filter((d) => d.entries.length > 0)
    .map((deck) => {
      const completeness = computeCompleteness(deck.entries, owned);
      const borrowable = computeBorrowable(completeness, sources);
      return { deck, completeness, borrowable };
    })
    .sort(
      (a, b) =>
        b.borrowable.percentWithFriends - a.borrowable.percentWithFriends ||
        b.completeness.totals.percent - a.completeness.totals.percent ||
        a.deck.name.localeCompare(b.deck.name),
    );

  const cardIds = [...new Set(rows.flatMap((r) => r.borrowable.cards.map((c) => c.cardId)))];
  const cardMap = await getCardsByIds(cardIds);

  return (
    <div className="space-y-4">
      {sources.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4 text-sm">
          <p className="text-muted-foreground">
            Follow a friend or import their collection to see which of your missing cards they have.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/friends">Go to Friends</Link>
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No featured or public decks yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ deck, completeness, borrowable }) => {
            const own = completeness.totals.percent;
            const withFriends = borrowable.percentWithFriends;
            return (
              <li key={deck.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/decks/${deck.id}`}
                    className="rounded-sm font-medium outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {deck.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span>{own}% owned</span>
                    <Badge variant={withFriends > own ? "info" : "outline"}>{withFriends}% with friends</Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Bar own={own} withFriends={withFriends} />
                  <Legend own={own} withFriends={withFriends} />
                </div>
                {borrowable.cards.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">You own every card in this deck.</p>
                ) : (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer rounded-sm text-muted-foreground tabular-nums outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      {completeness.totals.missingCopies} missing · {borrowable.coverableCopies} available from friends
                    </summary>
                    <ul className="mt-2 divide-y rounded-lg border">
                      {borrowable.cards.map((c) => {
                        const card = cardMap.get(c.cardId);
                        return (
                          <li key={c.cardId} className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 transition-colors hover:bg-muted/40">
                            <span className="w-20 shrink-0 font-medium tabular-nums">
                              {c.missing}× <span className="font-normal text-muted-foreground">missing</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              {card?.publicCode ? (
                                <Link href={`/cards/${encodeURIComponent(card.publicCode)}`} className="transition-colors hover:text-primary hover:underline">
                                  <span className="font-mono text-xs text-muted-foreground">{card.publicCode}</span>{" "}
                                  {card.name}
                                </Link>
                              ) : (
                                (card?.name ?? c.cardId)
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              {c.sources.length === 0
                                ? "No friend has this"
                                : `Friends have: ${c.sources.map((s) => `${s.label} (${s.qty})`).join(", ")}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function BorrowPage() {
  return (
    <PageShell>
      <PageHeader
        title="Borrow"
        description="How close you are to each featured or public deck, counting cards your friends own. This shows availability only; nothing is reserved or lent."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <BorrowContent />
      </Suspense>
    </PageShell>
  );
}
