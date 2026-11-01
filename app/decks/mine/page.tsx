import Link from "next/link";
import { Suspense } from "react";

import { ImportDeckForm } from "@/components/decks/import-deck-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listUserDecks } from "@/lib/decks/service";

async function MyDecks() {
  const user = await requireUser();
  const mine = await listUserDecks(user.id);
  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">My decks</h1>
        <Button asChild>
          <Link href="/decks/new">New deck</Link>
        </Button>
      </div>
      {mine.length === 0 ? (
        <p className="mt-6 text-muted-foreground">You have no decks yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-4">
              <Link href={`/decks/${d.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                {d.name}
              </Link>
              <Badge variant={d.isPublic ? "secondary" : "outline"}>{d.isPublic ? "Public" : "Private"}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={`/decks/${d.id}/edit`}>Edit</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-semibold">Import from JSON</h2>
        <div className="mt-3">
          <ImportDeckForm />
        </div>
      </section>
    </>
  );
}

export default function MyDecksPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MyDecks />
      </Suspense>
    </main>
  );
}
