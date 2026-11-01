import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CompletenessBar } from "@/components/decks/completeness-bar";
import { DeckActions } from "@/components/decks/deck-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import type { Card } from "@/lib/db/schema";
import { DECK_ZONES, type DeckZone } from "@/lib/decks/types";
import { loadDeckDetail, rarityRank } from "@/lib/decks/view";
import { toDeckText, type ShareZone } from "@/lib/share/schema";

const ZONE_TITLES: Record<DeckZone, string> = {
  LEGEND: "Legend",
  CHAMPION: "Chosen Champion",
  MAIN: "Main deck",
  RUNE: "Rune deck",
  BATTLEFIELD: "Battlefields",
  SIDEBOARD: "Sideboard",
};

function CardLink({ card }: { card: Card }) {
  return card.publicCode ? (
    <Link href={`/cards/${card.publicCode}`} className="hover:underline">
      {card.name}
    </Link>
  ) : (
    <span>{card.name}</span>
  );
}

async function DeckContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const detail = await loadDeckDetail(id, user);
  if (!detail) notFound();
  const { deck, cards, validation, completeness, borrowable, isOwner } = detail;

  const compByCard = new Map(completeness?.cards.map((c) => [c.cardId, c]));
  const event = [deck.eventName, deck.placement].filter(Boolean).join(" · ");

  const sortedEntries = (zone: DeckZone) =>
    deck.entries
      .filter((e) => e.zone === zone && cards.has(e.cardId))
      .sort((a, b) => cards.get(a.cardId)!.name.localeCompare(cards.get(b.cardId)!.name));

  const zoneCount = (zone: DeckZone) => deck.entries.filter((e) => e.zone === zone).reduce((a, e) => a + e.quantity, 0);

  const deckText = toDeckText({
    name: deck.name,
    cards: DECK_ZONES.flatMap((z) =>
      sortedEntries(z).flatMap((e) => {
        const c = cards.get(e.cardId)!;
        return c.publicCode ? [{ code: c.publicCode, qty: e.quantity, zone: z as ShareZone, name: c.name }] : [];
      }),
    ),
  });

  // Missing cards grouped by rarity.
  const missingRows = (completeness?.cards ?? [])
    .filter((c) => c.missing > 0 && cards.has(c.cardId))
    .map((c) => ({ ...c, card: cards.get(c.cardId)! }));
  const byRarity = new Map<string, typeof missingRows>();
  for (const r of missingRows) {
    const key = r.card.rarity ?? "Unknown";
    byRarity.set(key, [...(byRarity.get(key) ?? []), r]);
  }
  const rarityGroups = [...byRarity.entries()].sort((a, b) => rarityRank(a[0]) - rarityRank(b[0]));
  const missingText = completeness
    ? missingRows
        .sort((a, b) => a.card.name.localeCompare(b.card.name))
        .map((r) => `${r.missing} ${r.card.publicCode ?? ""} ${r.card.name}`.replace(/\s+/g, " "))
        .join("\n")
    : null;

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{deck.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {deck.isFeatured && <Badge>Featured</Badge>}
            {deck.source === "META" && <Badge variant="secondary">Meta</Badge>}
            {!deck.isPublic && <Badge variant="outline">Private</Badge>}
            {event && <span>{event}</span>}
          </div>
          {deck.description && <p className="mt-3 max-w-prose text-sm">{deck.description}</p>}
        </div>
        {isOwner && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/decks/${deck.id}/edit`}>Edit</Link>
          </Button>
        )}
      </div>

      <div className="mt-4">
        <DeckActions deckId={deck.id} deckText={deckText} missingText={missingText} />
      </div>

      <section className="mt-6 rounded-lg border p-4" aria-label="Validation">
        <h2 className="font-medium">
          {validation.valid ? "Deck is valid" : "Deck has problems"}{" "}
          <Badge variant={validation.valid ? "secondary" : "destructive"}>
            {validation.valid ? "Valid" : `${validation.issues.filter((i) => i.severity === "error").length} error(s)`}
          </Badge>
        </h2>
        {validation.issues.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {validation.issues.map((i, idx) => (
              <li key={idx} className={i.severity === "error" ? "text-destructive" : "text-muted-foreground"}>
                {i.severity === "error" ? "Error" : "Warning"}: {i.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {completeness ? (
        <section className="mt-4 grid gap-4 rounded-lg border p-4 sm:grid-cols-2" aria-label="Completeness">
          <div>
            <CompletenessBar percent={completeness.totals.percent} label="Complete for your collection" />
            <p className="mt-1 text-xs text-muted-foreground">
              {completeness.totals.ownedCopies} of {completeness.totals.neededCopies} copies owned ·{" "}
              {completeness.totals.missingCopies} missing (sideboard not counted)
            </p>
          </div>
          {borrowable && (
            <div>
              <CompletenessBar percent={borrowable.percentWithFriends} label="With friends" />
              <p className="mt-1 text-xs text-muted-foreground">
                Friends and imports could cover {borrowable.coverableCopies} of {borrowable.missingCopies} missing copies.
              </p>
            </div>
          )}
        </section>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/auth/sign-in" className="underline">
            Sign in
          </Link>{" "}
          to see which cards you own and what is missing.
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {DECK_ZONES.map((zone) => {
          const rows = sortedEntries(zone);
          if (rows.length === 0) return null;
          return (
            <section key={zone} aria-label={ZONE_TITLES[zone]}>
              <h2 className="font-medium">
                {ZONE_TITLES[zone]} <span className="text-muted-foreground">({zoneCount(zone)})</span>
              </h2>
              <ul className="mt-2 divide-y rounded-lg border text-sm">
                {rows.map((e) => {
                  const c = cards.get(e.cardId)!;
                  const comp = zone === "SIDEBOARD" ? undefined : compByCard.get(e.cardId);
                  return (
                    <li key={`${e.cardId}-${e.zone}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 text-right tabular-nums text-muted-foreground">{e.quantity}×</span>
                      <span className="min-w-0 flex-1 truncate">
                        <CardLink card={c} />
                        {c.publicCode && <span className="ml-2 text-xs text-muted-foreground">{c.publicCode}</span>}
                      </span>
                      {comp && (
                        <span
                          className={
                            comp.missing > 0
                              ? "text-xs tabular-nums text-destructive"
                              : "text-xs tabular-nums text-muted-foreground"
                          }
                          title="owned / needed"
                        >
                          {comp.owned}/{comp.needed}
                          {comp.missing > 0 ? ` (missing ${comp.missing})` : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {completeness && (
        <section className="mt-8" aria-label="Missing cards">
          <h2 className="text-lg font-semibold">Missing cards</h2>
          {rarityGroups.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">You own everything in this deck.</p>
          ) : (
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              {rarityGroups.map(([rarity, rows]) => (
                <div key={rarity}>
                  <h3 className="text-sm font-medium">
                    {rarity} <span className="text-muted-foreground">({rows.reduce((a, r) => a + r.missing, 0)})</span>
                  </h3>
                  <ul className="mt-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.cardId}>
                        {r.missing}× <CardLink card={r.card} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {borrowable && (
        <section className="mt-8" aria-label="Borrow from friends">
          <h2 className="text-lg font-semibold">Borrow from friends</h2>
          {borrowable.cards.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing to borrow.</p>
          ) : (
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {borrowable.cards.map((b) => {
                const c = cards.get(b.cardId);
                if (!c) return null;
                return (
                  <li key={b.cardId} className="px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">
                        <CardLink card={c} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        need {b.missing}, can cover {b.coverable}
                      </span>
                    </div>
                    {b.sources.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No friend or import has this card.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {b.sources.map((s) => `${s.label}${s.kind === "IMPORT" ? " (import)" : ""} ×${s.qty}`).join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

export default function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <p className="mb-4 text-sm">
        <Link href="/decks" className="text-muted-foreground hover:text-foreground">
          ← All decks
        </Link>
      </p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <DeckContent params={params} />
      </Suspense>
    </main>
  );
}
