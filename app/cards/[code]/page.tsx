import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CardArt } from "@/components/cards/card-art";
import { DomainBadge } from "@/components/cards/domain-badge";
import { OwnedControls } from "@/components/collection/owned-controls";
import { PageHeader, PageShell, SectionHeading } from "@/components/layout/page";
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
        <Link
          href="/auth/sign-in"
          className="rounded-sm text-foreground underline underline-offset-4 outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
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

function Field({ label, value, numeric }: { label: string; value: React.ReactNode; numeric?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={numeric ? "text-right font-medium tabular-nums" : "text-right font-medium"}>{value}</dd>
    </div>
  );
}

async function CardDetailContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const card = await getCardDetail(decodeURIComponent(code));
  if (!card) notFound();

  return (
    <>
      <PageHeader
        title={card.name}
        description={
          <>
            <span className="font-mono tabular-nums">{card.publicCode ?? card.id}</span>
            {card.subtitle && ` · ${card.subtitle}`}
          </>
        }
        actions={
          <>
            {card.isPlaceholder && <Badge variant="outline">Development placeholder data</Badge>}
            <Button asChild variant="outline" size="sm">
              <Link href="/cards">Back to cards</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
        <CardArt
          name={card.name}
          type={card.type}
          faction={card.faction}
          imageUrl={card.fullUrl ?? card.thumbnailUrl}
          isPlaceholder={card.isPlaceholder}
          priority
        />
        <div className="space-y-8">
          <dl className="max-w-md rounded-xl border bg-card px-4">
            <Field label="Set" value={`${card.setName} (${card.setId})`} />
            <Field label="Collector number" value={card.collectorNumber} numeric />
            <Field label="Type" value={card.type} />
            <Field label="Domain" value={card.faction ? <DomainBadge domain={card.faction} /> : null} />
            <Field label="Rarity" value={card.rarity} />
            <Field label="Energy" value={card.energy} numeric />
            <Field label="Cost" value={card.cost} numeric />
            <Field label="Might" value={card.might} numeric />
            <Field label="Power" value={card.power} numeric />
            <Field label="Tags" value={card.tags.length ? card.tags.join(", ") : null} />
            <Field label="Artist" value={card.artist} />
          </dl>

          {(card.description || card.effect || card.flavorText) && (
            <section className="max-w-prose space-y-3">
              <SectionHeading>Card text</SectionHeading>
              {card.description && <p className="whitespace-pre-line leading-relaxed">{card.description}</p>}
              {card.effect && card.effect !== card.description && (
                <p className="whitespace-pre-line leading-relaxed">{card.effect}</p>
              )}
              {card.flavorText && (
                <p className="whitespace-pre-line italic leading-relaxed text-muted-foreground">{card.flavorText}</p>
              )}
            </section>
          )}

          <section className="max-w-md space-y-2">
            <SectionHeading>Printings</SectionHeading>
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
        </div>
      </div>
    </>
  );
}

export default function CardPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <PageShell>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CardDetailContent params={params} />
      </Suspense>
    </PageShell>
  );
}
