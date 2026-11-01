import { eq } from "drizzle-orm";
import Link from "next/link";

import { CompletenessBar } from "@/components/decks/completeness-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CurrentUser } from "@/lib/auth/session";
import { getCollectionRows } from "@/lib/collection/service";
import { summarize } from "@/lib/collection/stats";
import { getOwnedQtyByCardId, loadDecks } from "@/lib/data/queries";
import { computeCompleteness, rankDecksByCompleteness } from "@/lib/decks/completeness";
import { decks } from "@/lib/db/schema";

const RECENT_LIMIT = 4;

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 py-8 md:grid-cols-3" aria-busy="true">
      <Skeleton className="h-56 md:col-span-2" />
      <Skeleton className="h-56" />
    </div>
  );
}

export async function Dashboard({ user }: { user: CurrentUser }) {
  const [mine, featured, rows, owned] = await Promise.all([
    loadDecks(eq(decks.ownerId, user.id)),
    loadDecks(eq(decks.isPublic, true)),
    getCollectionRows(user.id),
    getOwnedQtyByCardId(user.id),
  ]);

  const recent = [...mine]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RECENT_LIMIT)
    .map((deck) => ({ deck, percent: computeCompleteness(deck.entries, owned).totals.percent }));

  const closest = rankDecksByCompleteness(
    featured.filter((d) => d.isFeatured && d.entries.length > 0),
    owned,
  )[0];

  const stats = summarize(rows);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/decks/new">New deck</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/decks">Browse decks</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/collection/add">Update collection</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gap-4 md:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent decks</CardTitle>
            {mine.length > 0 && (
              <Link href="/decks/mine" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                All my decks
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">You have no decks yet.</p>
                <Button asChild size="sm">
                  <Link href="/decks/new">Build your first deck</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {recent.map(({ deck, percent }) => (
                  <li key={deck.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                    <Link href={`/decks/${deck.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {deck.name}
                    </Link>
                    <Badge variant={deck.isPublic ? "secondary" : "outline"}>
                      {deck.isPublic ? "Public" : "Private"}
                    </Badge>
                    <CompletenessBar percent={percent} label="Owned" className="w-full sm:w-40" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-lg">Collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">Your collection is empty.</p>
                <Button asChild size="sm">
                  <Link href="/collection/add">Add cards</Link>
                </Button>
              </div>
            ) : (
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Unique</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stats.uniqueCards}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Copies</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stats.totalCopies}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Foils</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stats.foils}</dd>
                </div>
              </dl>
            )}
            {closest && rows.length > 0 && (
              <div className="space-y-1.5 border-t pt-4">
                <p className="text-sm text-muted-foreground">Closest featured deck</p>
                <Link href={`/decks/${closest.deck.id}`} className="block truncate font-medium hover:underline">
                  {closest.deck.name}
                </Link>
                <CompletenessBar percent={closest.completeness.totals.percent} label="Owned" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
