import { Suspense } from "react";

import { DeckEditor } from "@/components/decks/deck-editor";
import { ImportDeckForm } from "@/components/decks/import-deck-form";
import { PageHeader, PageShell, SectionHeading } from "@/components/layout/page";
import { requireUser } from "@/lib/auth/session";
import { getOwnedQtyByCardId } from "@/lib/data/queries";

async function NewDeck() {
  const user = await requireUser();
  const owned = await getOwnedQtyByCardId(user.id);
  return (
    <>
      <PageHeader
        title="New deck"
        description="You can save at any time, even while the deck has validation problems."
      />
      <DeckEditor
        deckId={null}
        ownedQty={owned}
        initial={{ name: "", description: "", isPublic: false, entries: [] }}
      />
      <section className="max-w-2xl space-y-3">
        <SectionHeading>Import from JSON</SectionHeading>
        <ImportDeckForm />
      </section>
    </>
  );
}

export default function NewDeckPage() {
  return (
    <PageShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewDeck />
      </Suspense>
    </PageShell>
  );
}
