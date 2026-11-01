import { Suspense } from "react";

import { PageHeader, PageShell } from "@/components/layout/page";
import { SharingSettings } from "@/components/social/sharing-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/data/queries";

export const metadata = { title: "Sharing settings" };

async function SharingContent() {
  const user = await requireUser();
  const profile = await ensureProfile(user);
  return (
    <SharingSettings
      token={profile.shareToken ?? ""}
      visibility={profile.collectionVisibility}
    />
  );
}

export default function SharingPage() {
  return (
    <PageShell>
      <PageHeader
        title="Sharing"
        description="Control who can see your collection and manage your share link."
      />
      <div className="max-w-2xl">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SharingContent />
        </Suspense>
      </div>
    </PageShell>
  );
}
