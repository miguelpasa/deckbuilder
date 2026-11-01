"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { PlaceholderBadge } from "@/components/cards/card-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bulkAdd } from "@/lib/collection/actions";
import { VARIANT_LABEL, type Variant } from "@/lib/collection/types";

type Result = {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  faction: string | null;
  setId: string;
  isPlaceholder: boolean;
  printings: { id: number; variant: Variant }[];
};

const VARIANT_ORDER: Variant[] = ["NORMAL", "FOIL", "ALT_ART"];

export function SingleAdd() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [qty, setQty] = useState("1");
  const [pending, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (selected || q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/collection/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(((await res.json()) as { results: Result[] }).results);
      } catch {
        // aborted or offline: keep the previous results
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, selected]);

  function choose(r: Result) {
    setSelected(r);
    setQuery(r.name);
    setResults([]);
    const normal = r.printings.find((p) => p.variant === "NORMAL") ?? r.printings[0];
    setPrintingId(normal?.id ?? null);
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setPrintingId(null);
    setQty("1");
  }

  function add() {
    const n = Math.floor(Number(qty));
    if (!selected || printingId === null || !Number.isFinite(n) || n < 1) return;
    start(async () => {
      const r = await bulkAdd([{ printingId, qty: n }]);
      if (r.ok) {
        toast.success(`Added ${n} x ${selected.name}`);
        reset();
      } else toast.error(r.error);
    });
  }

  const visible = !selected && query.trim().length >= 2 ? results : [];
  const variants = selected ? VARIANT_ORDER.filter((v) => selected.printings.some((p) => p.variant === v)) : [];

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="card-search" className="mb-1 block text-sm font-medium">
          Card code, Riot card id or name
        </label>
        <Input
          id="card-search"
          autoComplete="off"
          placeholder="OGN-042, or start typing a name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null);
          }}
        />
        {!selected && (searching || visible.length > 0 || query.trim().length >= 2) && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-md">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-x-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => choose(r)}
                >
                  <span className="font-mono text-xs text-muted-foreground">{r.code ?? r.id}</span>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[r.type, r.faction].filter(Boolean).join(" · ")}
                  </span>
                  {r.isPlaceholder && <PlaceholderBadge />}
                </button>
              </li>
            ))}
            {!searching && visible.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching cards.</li>
            )}
            {searching && visible.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
            )}
          </ul>
        )}
      </div>

      {selected && (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm">
            <span className="font-mono text-xs text-muted-foreground">{selected.code ?? selected.id}</span>{" "}
            <span className="font-semibold">{selected.name}</span>
          </p>
          {variants.length === 0 ? (
            <p className="text-sm text-destructive">This card has no printings to add.</p>
          ) : (
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-1 text-sm font-medium">Printing</legend>
              {variants.map((v) => {
                const p = selected.printings.find((x) => x.variant === v)!;
                return (
                  <label key={v} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="printing"
                      checked={printingId === p.id}
                      onChange={() => setPrintingId(p.id)}
                    />
                    {VARIANT_LABEL[v]}
                  </label>
                );
              })}
            </fieldset>
          )}
          <div className="flex items-end gap-3">
            <div>
              <label htmlFor="add-qty" className="mb-1 block text-sm font-medium">
                Quantity
              </label>
              <Input
                id="add-qty"
                type="number"
                min={1}
                max={9999}
                className="w-24"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <Button onClick={add} disabled={pending || printingId === null}>
              {pending ? "Adding…" : "Add to collection"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
