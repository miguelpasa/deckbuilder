import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CardArt } from "@/components/cards/card-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getFilterOptions, listCards, PAGE_SIZE } from "@/lib/collection/library";

export const metadata: Metadata = { title: "Cards | Riftbound Deckbuilder" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select name={name} aria-label={label} defaultValue={value} className={selectClass}>
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

async function CardLibrary({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = {
    q: one(sp.q).slice(0, 100),
    type: one(sp.type),
    faction: one(sp.faction),
    rarity: one(sp.rarity),
    set: one(sp.set),
    page: Math.max(1, Number.parseInt(one(sp.page), 10) || 1),
  };
  const [opts, result] = await Promise.all([getFilterOptions(), listCards(f)]);
  const asOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const k of ["q", "type", "faction", "rarity", "set"] as const) if (f[k]) p.set(k, f[k]);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `/cards?${s}` : "/cards";
  };

  return (
    <>
      <form action="/cards" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={f.q}
          placeholder="Search name or code (OGN-042)"
          aria-label="Search cards"
          className="w-full sm:max-w-xs"
        />
        <FilterSelect name="type" label="Type" value={f.type} options={asOpts(opts.types)} />
        <FilterSelect name="faction" label="Domain" value={f.faction} options={asOpts(opts.factions)} />
        <FilterSelect name="rarity" label="Rarity" value={f.rarity} options={asOpts(opts.rarities)} />
        <FilterSelect
          name="set"
          label="Set"
          value={f.set}
          options={opts.sets.map((s) => ({ value: s.id, label: `${s.id} - ${s.name}` }))}
        />
        <Button type="submit">Search</Button>
        <Button asChild variant="ghost">
          <Link href="/cards">Reset</Link>
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? "card" : "cards"}
        {result.pageCount > 1 && ` - page ${result.page} of ${result.pageCount}`}
      </p>

      {result.rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No cards match those filters.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {result.rows.map((c) => (
            <li key={c.id}>
              <Link href={`/cards/${encodeURIComponent(c.publicCode ?? c.id)}`} className="group block space-y-1">
                <CardArt
                  name={c.name}
                  type={c.type}
                  faction={c.faction}
                  imageUrl={c.thumbnailUrl}
                  isPlaceholder={c.isPlaceholder}
                  className="transition-shadow group-hover:shadow-md"
                />
                <p className="truncate text-sm font-medium group-hover:underline">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[c.publicCode, c.rarity].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {result.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={href(result.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            {(result.page - 1) * PAGE_SIZE + 1}-{Math.min(result.page * PAGE_SIZE, result.total)} of {result.total}
          </span>
          {result.page < result.pageCount ? (
            <Button asChild variant="outline">
              <Link href={href(result.page + 1)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="aspect-[5/7] w-full" />
      ))}
    </div>
  );
}

export default function CardsPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Cards</h1>
      <Suspense fallback={<LibrarySkeleton />}>
        <CardLibrary searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
