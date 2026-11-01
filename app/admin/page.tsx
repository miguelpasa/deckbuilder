import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminDeckRow } from "@/components/decks/admin-deck-row";
import { ImportMetaDeckForm, SyncButton } from "@/components/decks/admin-tools";
import { PageHeader, PageShell, SectionHeading } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdmin, requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { decks, syncRuns } from "@/lib/db/schema";

function SyncStatus({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">Success</Badge>;
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        Failed
      </Badge>
    );
  }
  return <Badge variant="info">Running</Badge>;
}

async function AdminContent() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();

  const [allDecks, runs] = await Promise.all([
    db.select().from(decks).orderBy(desc(decks.updatedAt)),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5),
  ]);

  return (
    <>
      <PageHeader
        title="Admin"
        description="Catalog and deck tools for administrators."
        actions={<Badge variant="outline">Admin only</Badge>}
      />

      <section className="space-y-2">
        <SectionHeading>Decks</SectionHeading>
        {allDecks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decks.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border bg-card">
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

      <section className="max-w-2xl space-y-2">
        <SectionHeading>Import meta deck JSON</SectionHeading>
        <ImportMetaDeckForm />
      </section>

      <section className="max-w-2xl space-y-3">
        <SectionHeading>Riot catalog</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Sync adds and updates cards from the Riot catalog. It never removes cards that Riot no longer lists.
        </p>
        <SyncButton />
        <h3 className="pt-3 text-sm font-medium">Last 5 sync runs</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sync runs yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border bg-card text-sm">
            {runs.map((r) => (
              <li key={r.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium tabular-nums">#{r.id}</span>
                  <SyncStatus status={r.status} />
                  <span className="tabular-nums text-muted-foreground">{r.startedAt.toISOString()}</span>
                  {r.cardCount !== null && (
                    <span className="tabular-nums text-muted-foreground">{r.cardCount} cards</span>
                  )}
                </div>
                {r.error && <p className="break-words text-xs text-destructive">{r.error}</p>}
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
    <PageShell>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AdminContent />
      </Suspense>
    </PageShell>
  );
}
