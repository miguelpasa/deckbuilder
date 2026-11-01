import { Suspense } from "react";

import { DeckEditor } from "@/components/decks/deck-editor";
import { ImportDeckForm } from "@/components/decks/import-deck-form";
import { requireUser } from "@/lib/auth/session";
import { getOwnedQtyByCardId } from "@/lib/data/queries";

async function NewDeck() {
  const user = await requireUser();
  const owned = await getOwnedQtyByCardId(user.id);
  return (
    <>
      <h1 className="text-2xl font-semibold">New deck</h1>
      <div className="mt-6">
        <DeckEditor
          deckId={null}
          ownedQty={owned}
          initial={{ name: "", description: "", isPublic: false, entries: [] }}
        />
      </div>
      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-semibold">Import from JSON</h2>
        <div className="mt-3">
          <ImportDeckForm />
        </div>
      </section>
    </>
  );
}

export default function NewDeckPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <NewDeck />
      </Suspense>
    </main>
  );
}
