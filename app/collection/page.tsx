import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageShell } from "@/components/layout/page";
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
      <div className="rounded-xl border border-dashed p-10 text-center">
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
    <PageShell>
      <PageHeader
        title="Your collection"
        description="Every card you own, by printing."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/collection/export" download="riftbound-collection.json">
                Export JSON
              </a>
            </Button>
            <Button asChild>
              <Link href="/collection/add">Add cards</Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <CollectionContent />
      </Suspense>
    </PageShell>
  );
}
