import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CardArt } from "@/components/cards/card-art";
import { OwnedControls } from "@/components/collection/owned-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getCardDetail, getOwnedByPrinting } from "@/lib/collection/library";
import { VARIANT_LABEL, type Variant } from "@/lib/collection/types";

async function Owned({ cardName, printings }: { cardName: string; printings: { id: number; variant: Variant }[] }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href="/auth/sign-in" className="underline">
          Sign in
        </Link>{" "}
        to track how many copies you own.
      </p>
    );
  }
  const owned = await getOwnedByPrinting(
    user.id,
    printings.map((p) => p.id),
  );
  return (
    <OwnedControls
      cardName={cardName}
      printings={printings.map((p) => ({ printingId: p.id, variant: p.variant, quantity: owned.get(p.id) ?? 0 }))}
    />
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

async function CardDetailContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const card = await getCardDetail(decodeURIComponent(code));
  if (!card) notFound();

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
      <CardArt
        name={card.name}
        type={card.type}
        faction={card.faction}
        imageUrl={card.fullUrl ?? card.thumbnailUrl}
        isPlaceholder={card.isPlaceholder}
        priority
      />
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="font-mono text-sm text-muted-foreground">{card.publicCode ?? card.id}</p>
          <h1 className="text-3xl font-semibold">{card.name}</h1>
          {card.subtitle && <p className="text-muted-foreground">{card.subtitle}</p>}
          {card.isPlaceholder && <Badge variant="outline">Development placeholder data</Badge>}
        </header>

        <dl className="max-w-md">
          <Field label="Set" value={`${card.setName} (${card.setId})`} />
          <Field label="Collector number" value={card.collectorNumber} />
          <Field label="Type" value={card.type} />
          <Field label="Domain" value={card.faction} />
          <Field label="Rarity" value={card.rarity} />
          <Field label="Energy" value={card.energy} />
          <Field label="Cost" value={card.cost} />
          <Field label="Might" value={card.might} />
          <Field label="Power" value={card.power} />
          <Field label="Tags" value={card.tags.length ? card.tags.join(", ") : null} />
          <Field label="Artist" value={card.artist} />
        </dl>

        {(card.description || card.effect || card.flavorText) && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Card text</h2>
            {card.description && <p className="whitespace-pre-line">{card.description}</p>}
            {card.effect && card.effect !== card.description && (
              <p className="whitespace-pre-line">{card.effect}</p>
            )}
            {card.flavorText && <p className="whitespace-pre-line italic text-muted-foreground">{card.flavorText}</p>}
          </section>
        )}

        <section className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">Printings</h2>
          {card.printings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No printings recorded.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {card.printings.map((p) => VARIANT_LABEL[p.variant]).join(", ")}
              </p>
              <h3 className="pt-2 text-sm font-medium">Copies you own</h3>
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <Owned cardName={card.name} printings={card.printings} />
              </Suspense>
            </>
          )}
        </section>

        <Button asChild variant="outline">
          <Link href="/cards">Back to cards</Link>
        </Button>
      </div>
    </div>
  );
}

export default function CardPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CardDetailContent params={params} />
      </Suspense>
    </main>
  );
}
