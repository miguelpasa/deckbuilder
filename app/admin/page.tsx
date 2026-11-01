import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminDeckRow } from "@/components/decks/admin-deck-row";
import { ImportMetaDeckForm, SyncButton } from "@/components/decks/admin-tools";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { decks, syncRuns } from "@/lib/db/schema";

async function AdminContent() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();

  const [allDecks, runs] = await Promise.all([
    db.select().from(decks).orderBy(desc(decks.updatedAt)),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Decks</h2>
        {allDecks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No decks.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {allDecks.map((d) => (
              <AdminDeckRow
                key={d.id}
                deck={{
                  id: d.id,
                  name: d.name,
                  isPublic: d.isPublic,
                  isFeatured: d.isFeatured,
                  source: d.source,
                  system: d.ownerId === null,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-lg font-semibold">Import meta deck JSON</h2>
        <div className="mt-2">
          <ImportMetaDeckForm />
        </div>
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-lg font-semibold">Riot catalog</h2>
        <div className="mt-2">
          <SyncButton />
        </div>
        <h3 className="mt-6 text-sm font-medium">Last 5 sync runs</h3>
        {runs.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No sync runs yet.</p>
        ) : (
          <ul className="mt-1 divide-y rounded-lg border text-sm">
            {runs.map((r) => (
              <li key={r.id} className="p-3">
                <span className="font-medium">#{r.id}</span> · {r.status} · {r.startedAt.toISOString()}
                {r.cardCount !== null && ` · ${r.cardCount} cards`}
                {r.error && <p className="mt-1 break-words text-xs text-muted-foreground">{r.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
