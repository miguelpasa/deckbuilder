import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { XIcon } from "lucide-react";

import { CardArt } from "@/components/cards/card-art";
import { PageHeader, PageShell } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getFilterOptions, listCards, PAGE_SIZE } from "@/lib/collection/library";

export const metadata: Metadata = { title: "Cards | Riftbound Deckbuilder" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const FILTER_KEYS = ["q", "type", "faction", "rarity", "set"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

// Native select styled to match the shared Input (height, border, radius, focus ring).
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground";

const labelClass = "text-xs font-medium text-muted-foreground";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} className={selectClass}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
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

  const href = (page: number, omit?: FilterKey) => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) if (f[k] && k !== omit) p.set(k, f[k]);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `/cards?${s}` : "/cards";
  };

  const filterLabels: Record<FilterKey, string> = {
    q: "Search",
    type: "Type",
    faction: "Domain",
    rarity: "Rarity",
    set: "Set",
  };
  const active = FILTER_KEYS.filter((k) => f[k]);

  return (
    <>
      <form
        action="/cards"
        className="grid grid-cols-2 items-end gap-x-3 gap-y-3 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
      >
        <div className="col-span-2 space-y-1 sm:col-span-3 lg:col-span-1">
          <label htmlFor="filter-q" className={labelClass}>
            Search
          </label>
          <Input
            id="filter-q"
            name="q"
            defaultValue={f.q}
            placeholder="Name or code (OGN-042)"
          />
        </div>
        <FilterSelect id="filter-type" name="type" label="Type" value={f.type} options={asOpts(opts.types)} />
        <FilterSelect
          id="filter-faction"
          name="faction"
          label="Domain"
          value={f.faction}
          options={asOpts(opts.factions)}
        />
        <FilterSelect
          id="filter-rarity"
          name="rarity"
          label="Rarity"
          value={f.rarity}
          options={asOpts(opts.rarities)}
        />
        <FilterSelect
          id="filter-set"
          name="set"
          label="Set"
          value={f.set}
          options={opts.sets.map((s) => ({ value: s.id, label: `${s.id} - ${s.name}` }))}
        />
        <div className="col-span-2 flex items-center gap-2 sm:col-span-3 lg:col-span-1">
          <Button type="submit" className="flex-1 lg:flex-none">
            Search
          </Button>
          {active.length > 0 && (
            <Button asChild variant="ghost">
              <Link href="/cards">Reset</Link>
            </Button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <p className="tabular-nums text-muted-foreground">
          {result.total} {result.total === 1 ? "card" : "cards"}
          {result.pageCount > 1 && `, page ${result.page} of ${result.pageCount}`}
        </p>
        {active.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
            {active.map((k) => (
              <li key={k}>
                <Link
                  href={href(1, k)}
                  aria-label={`Remove ${filterLabels[k]} filter: ${f[k]}`}
                  className="inline-flex h-6 items-center gap-1 rounded-full border bg-accent px-2 text-xs font-medium text-accent-foreground outline-none transition-colors hover:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="text-muted-foreground">{filterLabels[k]}:</span>
                  <span className="max-w-32 truncate">{f[k]}</span>
                  <XIcon className="size-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No cards match those filters.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {result.rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cards/${encodeURIComponent(c.publicCode ?? c.id)}`}
                className="group block space-y-2 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CardArt
                  name={c.name}
                  type={c.type}
                  faction={c.faction}
                  imageUrl={c.thumbnailUrl}
                  isPlaceholder={c.isPlaceholder}
                  className="group-hover:border-primary/60 group-hover:shadow-md group-focus-visible:border-primary/60"
                />
                <div className="space-y-0.5">
                  <p className="truncate text-sm font-medium leading-tight">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.publicCode && <span className="font-mono tabular-nums">{c.publicCode}</span>}
                    {c.publicCode && c.rarity && " · "}
                    {c.rarity}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          {result.page > 1 ? (
            <Button asChild variant="outline">
              <Link href={href(result.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm tabular-nums text-muted-foreground">
            {(result.page - 1) * PAGE_SIZE + 1}-{Math.min(result.page * PAGE_SIZE, result.total)} of {result.total}
          </span>
          {result.page < result.pageCount ? (
            <Button asChild variant="outline">
              <Link href={href(result.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Next
            </Button>
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
        <Skeleton key={i} className="aspect-[5/7] w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function CardsPage({ searchParams }: { searchParams: SP }) {
  return (
    <PageShell>
      <PageHeader title="Cards" description="Search and filter every card in the catalog." />
      <Suspense fallback={<LibrarySkeleton />}>
        <CardLibrary searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
