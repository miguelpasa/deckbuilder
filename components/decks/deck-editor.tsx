"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { DomainBadge } from "@/components/cards/domain-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteDeckAction,
  saveDeckAction,
  searchCardsAction,
  type CardSearchHit,
} from "@/lib/decks/actions";
import { cardKind } from "@/lib/decks/classify";
import { validateDeck } from "@/lib/decks/rules";
import { DECK_ZONES, type DeckCard, type DeckZone } from "@/lib/decks/types";

export interface EditorEntry {
  card: CardSearchHit;
  zone: DeckZone;
  quantity: number;
}

const ZONE_TITLES: Record<DeckZone, string> = {
  LEGEND: "Legend",
  CHAMPION: "Chosen Champion",
  MAIN: "Main deck",
  RUNE: "Rune deck",
  BATTLEFIELD: "Battlefields",
  SIDEBOARD: "Sideboard",
};

function toDeckCard(c: CardSearchHit): DeckCard {
  return {
    id: c.id,
    publicCode: c.code ?? "",
    name: c.name,
    type: c.type ?? "",
    faction: c.faction,
    rarity: c.rarity,
    tags: c.tags,
  };
}

function defaultZone(c: CardSearchHit): DeckZone {
  switch (cardKind(toDeckCard(c))) {
    case "LEGEND":
      return "LEGEND";
    case "CHAMPION_UNIT":
      return "CHAMPION";
    case "RUNE":
      return "RUNE";
    case "BATTLEFIELD":
      return "BATTLEFIELD";
    default:
      return "MAIN";
  }
}

export function DeckEditor({
  deckId,
  initial,
  ownedQty,
}: {
  deckId: string | null;
  initial: { name: string; description: string; isPublic: boolean; entries: EditorEntry[] };
  ownedQty: Record<string, number>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [entries, setEntries] = useState<EditorEntry[]>(initial.entries);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CardSearchHit[]>([]);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchCardsAction(q);
        if (!cancelled) setHits(res);
      } catch {
        if (!cancelled) toast.error("Search failed");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const validation = useMemo(() => {
    const cards = new Map(entries.map((e) => [e.card.id, toDeckCard(e.card)]));
    return validateDeck(
      { entries: entries.map((e) => ({ cardId: e.card.id, zone: e.zone, quantity: e.quantity })) },
      cards,
    );
  }, [entries]);

  const shownHits = query.trim() ? hits : [];
  const visibleHits = ownedOnly ? shownHits.filter((h) => (ownedQty[h.id] ?? 0) > 0) : shownHits;

  function add(card: CardSearchHit, zone: DeckZone) {
    setEntries((prev) => {
      if (zone === "LEGEND" || zone === "CHAMPION") {
        return [...prev.filter((e) => e.zone !== zone), { card, zone, quantity: 1 }];
      }
      const existing = prev.find((e) => e.card.id === card.id && e.zone === zone);
      if (existing) {
        return prev.map((e) => (e === existing ? { ...e, quantity: Math.min(99, e.quantity + 1) } : e));
      }
      return [...prev, { card, zone, quantity: 1 }];
    });
  }

  function step(entry: EditorEntry, delta: number) {
    setEntries((prev) =>
      prev
        .map((e) => (e === entry ? { ...e, quantity: Math.min(99, e.quantity + delta) } : e))
        .filter((e) => e.quantity > 0),
    );
  }

  function remove(entry: EditorEntry) {
    setEntries((prev) => prev.filter((e) => e !== entry));
  }

  function save() {
    startTransition(async () => {
      const res = await saveDeckAction(deckId, {
        name,
        description,
        isPublic,
        entries: entries.map((e) => ({ cardId: e.card.id, zone: e.zone, quantity: e.quantity })),
      });
      if (res.ok) {
        toast.success("Deck saved");
        router.push(`/decks/${res.deckId}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function del() {
    if (!deckId || !window.confirm("Delete this deck? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteDeckAction(deckId);
      if (res.ok) {
        toast.success("Deck deleted");
        router.push("/decks/mine");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deck-name">Name</Label>
          <Input id="deck-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deck-desc">Description</Label>
          <Textarea
            id="deck-desc"
            value={description}
            maxLength={2000}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="deck-public" checked={isPublic} onCheckedChange={setIsPublic} />
          <Label htmlFor="deck-public">Public (visible on the decks page)</Label>
        </div>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Add cards</h2>
          <Input
            placeholder="Search by name or code (e.g. OGN-042)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cards"
          />
          <div className="flex items-center gap-2">
            <Checkbox id="owned-only" checked={ownedOnly} onCheckedChange={(v) => setOwnedOnly(v === true)} />
            <Label htmlFor="owned-only">Show only cards I own</Label>
          </div>
          {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
          {query.trim() && !searching && visibleHits.length === 0 && (
            <p className="text-sm text-muted-foreground">No cards found.</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {visibleHits.map((h) => {
              const zone = defaultZone(h);
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{h.name}</span>
                    <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle text-xs text-muted-foreground">
                      <span>{[h.code, h.type].filter(Boolean).join(" · ")}</span>
                      <DomainBadge domain={h.faction} />
                      <span className="tabular-nums">{`own ${ownedQty[h.id] ?? 0}`}</span>
                    </span>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => add(h, zone)}>
                    <Plus /> {ZONE_TITLES[zone]}
                  </Button>
                  {zone === "MAIN" && (
                    <Button size="xs" variant="outline" onClick={() => add(h, "SIDEBOARD")}>
                      <Plus /> Sideboard
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="space-y-4">
        <section className="space-y-2 rounded-xl border bg-card p-4" aria-label="Validation">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Validation
            <Badge variant={validation.valid ? "success" : "warning"}>
              {validation.valid ? "Valid" : "Not valid yet"}
            </Badge>
          </h2>
          {!validation.valid && (
            <p className="text-xs text-muted-foreground">These checks are advisory. You can save the deck as it is.</p>
          )}
          {validation.issues.length > 0 && (
            <ul className="space-y-1 text-sm">
              {validation.issues.map((i, idx) => (
                <li key={idx} className={i.severity === "error" ? "text-destructive" : "text-warning"}>
                  {i.severity === "error" ? "Error" : "Warning"}: {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        {DECK_ZONES.map((zone) => {
          const rows = entries.filter((e) => e.zone === zone);
          const total = rows.reduce((a, e) => a + e.quantity, 0);
          return (
            <section key={zone} className="space-y-1">
              <h3 className="text-sm font-semibold">
                {ZONE_TITLES[zone]} <span className="font-normal text-muted-foreground tabular-nums">({total})</span>
              </h3>
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">Empty</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card text-sm">
                  {rows.map((e) => (
                    <li key={`${e.card.id}-${e.zone}`} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate">
                        {e.card.name}
                        <span className="ml-2 text-xs text-muted-foreground">{e.card.code}</span>
                      </span>
                      {zone === "LEGEND" || zone === "CHAMPION" ? null : (
                        <>
                          <Button size="icon-xs" variant="outline" aria-label="Decrease" onClick={() => step(e, -1)}>
                            <Minus />
                          </Button>
                          <span className="w-6 text-center tabular-nums">{e.quantity}</span>
                          <Button size="icon-xs" variant="outline" aria-label="Increase" onClick={() => step(e, 1)}>
                            <Plus />
                          </Button>
                        </>
                      )}
                      <Button size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => remove(e)}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save deck"}
          </Button>
          {deckId && (
            <Button variant="destructive" onClick={del} disabled={pending}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
