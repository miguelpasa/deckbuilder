import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageShell } from "@/components/layout/page";
import { AddTabs } from "@/components/collection/add-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add cards | Riftbound Deckbuilder" };

async function AddContent() {
  await requireUser();
  return <AddTabs />;
}

export default function AddCardsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Add cards"
        actions={
          <Button asChild variant="ghost">
            <Link href="/collection">Back to collection</Link>
          </Button>
        }
      />
      <div className="max-w-2xl">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <AddContent />
        </Suspense>
      </div>
    </PageShell>
  );
}
