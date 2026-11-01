"use client";

import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { PlaceholderBadge } from "@/components/cards/card-art";
import { DomainBadge } from "@/components/cards/domain-badge";
import { QuantityStepper } from "@/components/collection/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setQuantity } from "@/lib/collection/actions";
import { summarize } from "@/lib/collection/stats";
import { VARIANT_LABEL, type CollectionRow } from "@/lib/collection/types";

type Group = "none" | "set" | "type";
type Sort = "code" | "name" | "qty";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function CollectionTable({ initialRows }: { initialRows: CollectionRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState("");
  const [group, setGroup] = useState<Group>("set");
  const [sort, setSort] = useState<Sort>("code");
  const [, start] = useTransition();

  const stats = useMemo(() => summarize(rows), [rows]);

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const shown = rows.filter(
      (r) =>
        !f ||
        r.name.toLowerCase().includes(f) ||
        (r.code ?? "").toLowerCase().includes(f) ||
        (r.type ?? "").toLowerCase().includes(f) ||
        (r.faction ?? "").toLowerCase().includes(f),
    );
    shown.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant);
      if (sort === "qty") return b.quantity - a.quantity || a.name.localeCompare(b.name);
      return (
        a.setId.localeCompare(b.setId) ||
        (a.code ?? "").localeCompare(b.code ?? "") ||
        a.variant.localeCompare(b.variant)
      );
    });
    const m = new Map<string, CollectionRow[]>();
    for (const r of shown) {
      const key = group === "set" ? r.setName : group === "type" ? (r.type ?? "Unknown type") : "";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, filter, group, sort]);

  function setQty(printingId: number, n: number) {
    setRows((rs) => rs.map((r) => (r.printingId === printingId ? { ...r, quantity: n } : r)));
  }

  function remove(r: CollectionRow) {
    const prev = r.quantity;
    setQty(r.printingId, 0);
    start(async () => {
      const res = await setQuantity(r.printingId, 0);
      if (!res.ok) {
        setQty(r.printingId, prev);
        toast.error(res.error);
      } else {
        setRows((rs) => rs.filter((x) => x.printingId !== r.printingId));
        toast.success(`Removed ${r.name} (${VARIANT_LABEL[r.variant]})`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border bg-card">
        {[
          ["Unique cards", stats.uniqueCards],
          ["Total copies", stats.totalCopies],
          ["Foils", stats.foils],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-full sm:max-w-xs"
          placeholder="Filter by name, code, type…"
          aria-label="Filter collection"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Group
          <select className={selectClass} value={group} onChange={(e) => setGroup(e.target.value as Group)}>
            <option value="set">Set</option>
            <option value="type">Type</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="code">Code</option>
            <option value="name">Name</option>
            <option value="qty">Quantity</option>
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards match your filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs text-muted-foreground">Code</TableHead>
                <TableHead className="px-3 text-xs text-muted-foreground">Card</TableHead>
                <TableHead className="hidden px-3 text-xs text-muted-foreground sm:table-cell">Type</TableHead>
                <TableHead className="hidden px-3 text-xs text-muted-foreground md:table-cell">Domain</TableHead>
                <TableHead className="px-3 text-xs text-muted-foreground">Printing</TableHead>
                <TableHead className="px-3 text-right text-xs text-muted-foreground">Quantity</TableHead>
                <TableHead className="w-10 px-3">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(([name, list]) => (
                <Fragment key={name || "all"}>
                  {name && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {name} <span className="tabular-nums font-normal">({list.reduce((s, r) => s + r.quantity, 0)})</span>
                      </TableCell>
                    </TableRow>
                  )}
                  {list.map((r) => (
                    <TableRow key={r.printingId} className="border-border/60">
                      <TableCell className="px-3 font-mono text-xs text-muted-foreground">{r.code ?? "-"}</TableCell>
                      <TableCell className="px-3">
                        <Link
                          href={`/cards/${encodeURIComponent(r.code ?? r.cardId)}`}
                          className="rounded-sm font-medium outline-none transition-colors hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {r.name}
                        </Link>
                        {r.isPlaceholder && <PlaceholderBadge className="ml-2" />}
                      </TableCell>
                      <TableCell className="hidden px-3 text-muted-foreground sm:table-cell">{r.type ?? "-"}</TableCell>
                      <TableCell className="hidden px-3 md:table-cell">
                        {r.faction ? <DomainBadge domain={r.faction} /> : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="px-3">
                        {r.variant === "NORMAL" ? (
                          <span className="text-muted-foreground">{VARIANT_LABEL[r.variant]}</span>
                        ) : (
                          <Badge variant="outline">{VARIANT_LABEL[r.variant]}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 text-right tabular-nums">
                        <QuantityStepper
                          printingId={r.printingId}
                          quantity={r.quantity}
                          label={`${r.name} (${VARIANT_LABEL[r.variant]})`}
                          onChange={(n) => setQty(r.printingId, n)}
                        />
                      </TableCell>
                      <TableCell className="px-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${r.name} (${VARIANT_LABEL[r.variant]}) from collection`}
                          onClick={() => remove(r)}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
