import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeckEditor, type EditorEntry } from "@/components/decks/deck-editor";
import { PageHeader, PageShell } from "@/components/layout/page";
import { requireUser } from "@/lib/auth/session";
import { getCardsByIds, getOwnedQtyByCardId, loadDecks } from "@/lib/data/queries";
import { eq } from "drizzle-orm";
import { decks } from "@/lib/db/schema";
import { isUuid } from "@/lib/decks/service";

async function EditDeck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!isUuid(id)) notFound();
  const [deck] = await loadDecks(eq(decks.id, id));
  // Only the owner may edit; system decks (ownerId null) are never editable here.
  if (!deck || deck.ownerId !== user.id) notFound();

  const cards = await getCardsByIds([...new Set(deck.entries.map((e) => e.cardId))]);
  const owned = await getOwnedQtyByCardId(user.id);
  const entries: EditorEntry[] = deck.entries.flatMap((e) => {
    const c = cards.get(e.cardId);
    if (!c) return [];
    return [
      {
        zone: e.zone,
        quantity: e.quantity,
        card: {
          id: c.id,
          code: c.publicCode,
          name: c.name,
          type: c.type,
          faction: c.faction,
          rarity: c.rarity,
          tags: c.tags,
        },
      },
    ];
  });

  return (
    <>
      <PageHeader
        title="Edit deck"
        description="You can save at any time, even while the deck has validation problems."
      />
      <DeckEditor
        deckId={deck.id}
        ownedQty={owned}
        initial={{
          name: deck.name,
          description: deck.description ?? "",
          isPublic: deck.isPublic,
          entries,
        }}
      />
    </>
  );
}

export default function EditDeckPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading deck…</p>}>
        <EditDeck params={params} />
      </Suspense>
    </PageShell>
  );
}
