import type { DeckEntry, OwnedQtyByCardId } from "./types";

export interface CompletenessOptions {
  includeSideboard?: boolean;
}

export interface CardCompleteness {
  cardId: string;
  needed: number;
  /** Owned copies, capped at needed. */
  owned: number;
  /** Raw owned copies (uncapped). */
  ownedTotal: number;
  missing: number;
}

export interface CompletenessTotals {
  neededCopies: number;
  ownedCopies: number;
  missingCopies: number;
  /** 0-100, one decimal. 100 for an empty deck. */
  percent: number;
}

export interface CompletenessResult {
  cards: CardCompleteness[];
  totals: CompletenessTotals;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den === 0 ? 100 : round1((num / den) * 100));

/** Ownership is per card regardless of printing/variant. */
export function aggregateOwnership(
  entries: { cardId: string; variant?: string; quantity: number }[],
): OwnedQtyByCardId {
  const out: OwnedQtyByCardId = {};
  for (const e of entries) {
    if (!Number.isFinite(e.quantity) || e.quantity <= 0) continue;
    out[e.cardId] = (out[e.cardId] ?? 0) + e.quantity;
  }
  return out;
}

export function computeCompleteness(
  deckEntries: DeckEntry[],
  ownedQtyByCardId: OwnedQtyByCardId,
  opts: CompletenessOptions = {},
): CompletenessResult {
  const need = new Map<string, number>();
  for (const e of deckEntries) {
    if (e.zone === "SIDEBOARD" && !opts.includeSideboard) continue;
    if (e.quantity <= 0) continue;
    need.set(e.cardId, (need.get(e.cardId) ?? 0) + e.quantity);
  }
  const cards: CardCompleteness[] = [];
  let neededCopies = 0;
  let ownedCopies = 0;
  for (const [cardId, needed] of need) {
    const ownedTotal = Math.max(0, ownedQtyByCardId[cardId] ?? 0);
    const owned = Math.min(ownedTotal, needed);
    cards.push({ cardId, needed, owned, ownedTotal, missing: needed - owned });
    neededCopies += needed;
    ownedCopies += owned;
  }
  return {
    cards,
    totals: {
      neededCopies,
      ownedCopies,
      missingCopies: neededCopies - ownedCopies,
      percent: pct(ownedCopies, neededCopies),
    },
  };
}

export interface BorrowSource {
  sourceId: string;
  label: string;
  kind: "FOLLOW" | "IMPORT";
  ownedQtyByCardId: OwnedQtyByCardId;
}

export interface BorrowableCard {
  cardId: string;
  missing: number;
  sources: { sourceId: string; label: string; kind: BorrowSource["kind"]; qty: number }[];
  /** min(missing, total lendable). */
  coverable: number;
}

export interface BorrowableResult {
  cards: BorrowableCard[];
  /** Missing copies that could be covered if every source lends everything. */
  coverableCopies: number;
  missingCopies: number;
  percentWithFriends: number;
}

export function computeBorrowable(
  completeness: CompletenessResult,
  sources: BorrowSource[],
): BorrowableResult {
  const cards: BorrowableCard[] = [];
  let coverableCopies = 0;
  for (const c of completeness.cards) {
    if (c.missing <= 0) continue;
    const list = sources
      .map((s) => ({ sourceId: s.sourceId, label: s.label, kind: s.kind, qty: s.ownedQtyByCardId[c.cardId] ?? 0 }))
      .filter((s) => s.qty > 0)
      .sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label));
    const lendable = list.reduce((a, s) => a + s.qty, 0);
    const coverable = Math.min(c.missing, lendable);
    coverableCopies += coverable;
    cards.push({ cardId: c.cardId, missing: c.missing, sources: list, coverable });
  }
  const { neededCopies, ownedCopies, missingCopies } = completeness.totals;
  return {
    cards,
    coverableCopies,
    missingCopies,
    percentWithFriends: pct(ownedCopies + coverableCopies, neededCopies),
  };
}

/** Sorts decks by completeness desc (ties: fewer missing copies, then id). */
export function rankDecksByCompleteness<T extends { id: string; entries: DeckEntry[] }>(
  decks: T[],
  owned: OwnedQtyByCardId,
  opts: CompletenessOptions = {},
): { deck: T; completeness: CompletenessResult }[] {
  return decks
    .map((deck) => ({ deck, completeness: computeCompleteness(deck.entries, owned, opts) }))
    .sort(
      (a, b) =>
        b.completeness.totals.percent - a.completeness.totals.percent ||
        a.completeness.totals.missingCopies - b.completeness.totals.missingCopies ||
        a.deck.id.localeCompare(b.deck.id),
    );
}
