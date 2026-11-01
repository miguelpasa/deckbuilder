import { Suspense } from "react";

import { SharingSettings } from "@/components/social/sharing-settings";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">Sharing</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Control who can see your collection and manage your share link.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <SharingContent />
      </Suspense>
    </main>
  );
}
