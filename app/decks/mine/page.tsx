import Link from "next/link";
import { Suspense } from "react";

import { ImportDeckForm } from "@/components/decks/import-deck-form";
import { PageHeader, PageShell, SectionHeading } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listUserDecks } from "@/lib/decks/service";

async function MyDecks() {
  const user = await requireUser();
  const mine = await listUserDecks(user.id);
  return (
    <>
      <PageHeader
        title="My decks"
        description="Decks you built or imported."
        actions={
          <Button asChild size="sm">
            <Link href="/decks/new">New deck</Link>
          </Button>
        }
      />
      {mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no decks yet.{" "}
          <Link href="/decks/new" className="underline underline-offset-4 transition-colors hover:text-foreground">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-4">
              <Link
                href={`/decks/${d.id}`}
                className="min-w-0 flex-1 truncate font-semibold transition-colors hover:underline"
              >
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
      <section className="max-w-2xl space-y-3">
        <SectionHeading>Import from JSON</SectionHeading>
        <ImportDeckForm />
      </section>
    </>
  );
}

export default function MyDecksPage() {
  return (
    <PageShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading decks…</p>}>
        <MyDecks />
      </Suspense>
    </PageShell>
  );
}
