import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";

import { AddFriendForm, UnfollowButton } from "@/components/social/friends-client";
import { ImportedList, NewImportCard } from "@/components/social/imports-manager";
import { PageHeader, PageShell, SectionHeading } from "@/components/layout/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="max-w-2xl space-y-10">
      <section className="space-y-3">
        <SectionHeading>Add a friend</SectionHeading>
        <AddFriendForm />
        <p className="text-sm text-muted-foreground">
          Paste the link a friend sent you (like <span className="font-mono">/share/abc123…</span>) or the token.
          {" "}
          {followers === 0 ? "Nobody follows you yet." : `${followers} ${followers === 1 ? "person follows" : "people follow"} you.`}
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>
          Following <span className="font-normal tabular-nums text-muted-foreground">({following.length})</span>
        </SectionHeading>
        {following.length === 0 ? (
          <p className="text-sm text-muted-foreground">You aren&apos;t following anyone yet. Add a friend above.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {following.map((f) => {
              const isPrivate = f.visibility === "PRIVATE";
              return (
                <li
                  key={f.userId}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <Avatar>
                    <AvatarFallback>{f.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    {f.shareToken && !isPrivate ? (
                      <Link
                        href={`/share/${f.shareToken}`}
                        className="block truncate rounded-sm font-medium outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        {f.name}
                      </Link>
                    ) : (
                      <div className="truncate font-medium">{f.name}</div>
                    )}
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {isPrivate ? "Collection hidden" : `${f.cardCount} cards`}
                    </div>
                  </div>
                  <Badge variant="outline">{isPrivate ? "Private" : "Shared"}</Badge>
                  <UnfollowButton userId={f.userId} name={f.name} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading>Imported snapshots</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Got a friend&apos;s collection as a JSON file? Import it as a snapshot and the Borrow page will count it as a
          source. Snapshots don&apos;t update on their own; re-import to refresh one.
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
    <PageShell>
      <PageHeader
        title="Friends"
        description="Follow friends to see which cards they own."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings/sharing">
              <Settings /> Sharing settings
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-2xl" />}>
        <FriendsContent />
      </Suspense>
    </PageShell>
  );
}
