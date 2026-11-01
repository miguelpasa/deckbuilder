import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";

import { FollowButton } from "@/components/social/follow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getSharedCollection, isFollowing } from "@/lib/social/service";

export const metadata = { title: "Shared collection", robots: { index: false } };

const VARIANT_LABEL = { NORMAL: "Normal", FOIL: "Foil", ALT_ART: "Alt art" } as const;

async function SharedCollectionContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedCollection(token);
  if (!shared) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === shared.profile.userId;
  const following = viewer && !isSelf ? await isFollowing(viewer.id, shared.profile.userId) : false;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{shared.profile.displayName}&apos;s collection</h1>
          <p className="mt-1 text-muted-foreground">
            {shared.totalCards} cards · {shared.entries.length} entries
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewer && !isSelf && (
            <FollowButton token={token} userId={shared.profile.userId} following={following} />
          )}
          {!viewer && (
            <Button asChild variant="outline">
              <Link href="/auth/sign-in">Sign in to follow</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            {/* Plain anchor: this is a file download, not a page navigation. */}
            <a href={`/api/share/${token}/json`} download>
              <Download /> Download JSON
            </a>
          </Button>
        </div>
      </div>

      {shared.entries.length === 0 ? (
        <p className="mt-8 text-muted-foreground">This collection is empty.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {shared.entries.map((e) => (
            <li key={`${e.code}-${e.variant}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-8 shrink-0 text-right font-medium tabular-nums">{e.qty}×</span>
              <Link href={`/cards/${encodeURIComponent(e.code)}`} className="min-w-0 flex-1 truncate hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{e.code}</span> {e.name}
              </Link>
              {e.variant !== "NORMAL" && <Badge variant="secondary">{VARIANT_LABEL[e.variant]}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <SharedCollectionContent params={params} />
      </Suspense>
    </main>
  );
}
