import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CollectionTable } from "@/components/collection/collection-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getCollectionRows } from "@/lib/collection/service";

export const metadata: Metadata = { title: "Your collection | Riftbound Deckbuilder" };

async function CollectionContent() {
  const user = await requireUser();
  const rows = await getCollectionRows(user.id);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="mb-4 text-muted-foreground">Your collection is empty.</p>
        <Button asChild>
          <Link href="/collection/add">Add cards</Link>
        </Button>
      </div>
    );
  }
  return <CollectionTable initialRows={rows} />;
}

export default function CollectionPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Your collection</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/collection/add">Add cards</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/collection/export" download="riftbound-collection.json">
              Export JSON
            </a>
          </Button>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CollectionContent />
      </Suspense>
    </main>
  );
}
