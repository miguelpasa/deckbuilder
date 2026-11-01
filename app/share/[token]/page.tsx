import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";

import { PageHeader, PageShell } from "@/components/layout/page";
import { FollowButton } from "@/components/social/follow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="space-y-6">
      <PageHeader
        title={<>{shared.profile.displayName}&apos;s collection</>}
        description={`${shared.totalCards} cards · ${shared.entries.length} entries`}
        actions={
          <>
            {viewer && !isSelf && (
            <FollowButton token={token} userId={shared.profile.userId} following={following} />
          )}
          {!viewer && (
            <Button asChild>
              <Link href="/auth/sign-in">Sign in to follow</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            {/* Plain anchor: this is a file download, not a page navigation. */}
            <a href={`/api/share/${token}/json`} download>
              <Download /> Download JSON
            </a>
          </Button>
          </>
        }
      />

      {shared.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">This collection is empty.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shared.entries.map((e) => (
            <li key={`${e.code}-${e.variant}`} className="flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-muted/40">
              <span className="w-8 shrink-0 text-right font-medium tabular-nums">{e.qty}×</span>
              <Link href={`/cards/${encodeURIComponent(e.code)}`} className="min-w-0 flex-1 truncate rounded-sm outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="font-mono text-xs text-muted-foreground">{e.code}</span> {e.name}
              </Link>
              {e.variant !== "NORMAL" && <Badge variant="outline">{VARIANT_LABEL[e.variant]}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <PageShell>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SharedCollectionContent params={params} />
      </Suspense>
    </PageShell>
  );
}
