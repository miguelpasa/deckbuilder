import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { AddFriendForm, UnfollowButton } from "@/components/social/friends-client";
import { ImportedList, NewImportCard } from "@/components/social/imports-manager";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/data/queries";
import { countFollowers, listFollowing, listImportedCollections } from "@/lib/social/service";

export const metadata = { title: "Friends" };

async function FriendsContent() {
  const user = await requireUser();
  await ensureProfile(user);
  const [following, followers, imports] = await Promise.all([
    listFollowing(user.id),
    countFollowers(user.id),
    listImportedCollections(user.id),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Add a friend</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/sharing">
              <Settings /> Sharing settings
            </Link>
          </Button>
        </div>
        <AddFriendForm />
        <p className="text-sm text-muted-foreground">
          Paste the link a friend sent you (like <span className="font-mono">/share/abc123…</span>) or just the token.
          {" "}
          {followers === 0 ? "Nobody follows you yet." : `${followers} ${followers === 1 ? "person follows" : "people follow"} you.`}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Following ({following.length})</h2>
        {following.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren&apos;t following anyone yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {following.map((f) => (
              <li key={f.userId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.visibility === "PRIVATE" ? "Collection is now private" : `${f.cardCount} cards`}
                  </div>
                </div>
                {f.shareToken && f.visibility !== "PRIVATE" && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/share/${f.shareToken}`}>View</Link>
                  </Button>
                )}
                <UnfollowButton userId={f.userId} name={f.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Imported snapshots</h2>
        <p className="text-sm text-muted-foreground">
          Got a friend&apos;s collection as a JSON file? Import it as a snapshot and it will count as a lending source on
          the Borrow page. Snapshots don&apos;t update on their own; re-import to refresh one.
        </p>
        <NewImportCard />
        <ImportedList
          items={imports.map((i) => ({
            id: i.id,
            label: i.label,
            importedAt: i.importedAt.toISOString(),
            cardCount: i.cardCount,
          }))}
        />
      </section>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Friends</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <FriendsContent />
      </Suspense>
    </main>
  );
}
