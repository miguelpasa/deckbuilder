import Link from "next/link";
import { or, eq } from "drizzle-orm";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { decks } from "@/lib/db/schema";
import { computeBorrowable, computeCompleteness } from "@/lib/decks/completeness";
import { getBorrowSources, getCardsByIds, getOwnedQtyByCardId, loadDecks } from "@/lib/data/queries";

export const metadata = { title: "Borrow" };

function Bar({ own, withFriends }: { own: number; withFriends: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${Math.min(100, withFriends)}%` }} />
      <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, own)}%` }} />
    </div>
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
    <>
      {sources.length === 0 && (
        <div className="mb-6 rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">No friends yet.</p>
          <p className="mt-1 text-muted-foreground">
            Follow a friend or import their collection to see which missing cards they could lend you.{" "}
            <Link href="/friends" className="text-primary underline underline-offset-4">
              Go to Friends
            </Link>
          </p>
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
              <li key={deck.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/decks/${deck.id}`} className="font-medium hover:underline">
                    {deck.name}
                  </Link>
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span>{own}% yours</span>
                    <Badge variant={withFriends > own ? "default" : "secondary"}>{withFriends}% with friends</Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <Bar own={own} withFriends={withFriends} />
                </div>
                {borrowable.cards.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">You own every card in this deck.</p>
                ) : (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      {completeness.totals.missingCopies} missing · {borrowable.coverableCopies} could be borrowed
                    </summary>
                    <ul className="mt-2 divide-y rounded-md border">
                      {borrowable.cards.map((c) => {
                        const card = cardMap.get(c.cardId);
                        return (
                          <li key={c.cardId} className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2">
                            <span className="w-8 shrink-0 text-right font-medium tabular-nums">{c.missing}×</span>
                            <span className="min-w-0 flex-1">
                              {card?.publicCode ? (
                                <Link href={`/cards/${encodeURIComponent(card.publicCode)}`} className="hover:underline">
                                  <span className="font-mono text-xs text-muted-foreground">{card.publicCode}</span>{" "}
                                  {card.name}
                                </Link>
                              ) : (
                                (card?.name ?? c.cardId)
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              {c.sources.length === 0
                                ? "Nobody can lend this"
                                : c.sources.map((s) => `${s.label} (${s.qty})`).join(", ")}
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
    </>
  );
}

export default function BorrowPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Borrow</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        How close you are to each featured deck, counting what your friends could lend.
      </p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <BorrowContent />
      </Suspense>
    </main>
  );
}
