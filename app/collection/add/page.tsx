import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AddTabs } from "@/components/collection/add-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add cards | Riftbound Deckbuilder" };

async function AddContent() {
  await requireUser();
  return <AddTabs />;
}

export default function AddCardsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Add cards</h1>
        <Link href="/collection" className="text-sm text-muted-foreground hover:text-foreground">
          Back to collection
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AddContent />
      </Suspense>
    </main>
  );
}
