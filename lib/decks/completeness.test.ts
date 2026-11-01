import { describe, expect, it } from "vitest";
import {
  aggregateOwnership, computeBorrowable, computeCompleteness, rankDecksByCompleteness,
} from "./completeness";
import type { DeckEntry } from "./types";

const e = (cardId: string, zone: DeckEntry["zone"], quantity: number): DeckEntry => ({ cardId, zone, quantity });

describe("aggregateOwnership", () => {
  it("sums across variants and ignores non-positive", () => {
    expect(
      aggregateOwnership([
        { cardId: "a", variant: "NORMAL", quantity: 2 },
        { cardId: "a", variant: "FOIL", quantity: 1 },
        { cardId: "b", variant: "NORMAL", quantity: 0 },
      ]),
    ).toEqual({ a: 3 });
  });
});

describe("computeCompleteness", () => {
  it("computes per-card and totals, capping ownership", () => {
    const r = computeCompleteness([e("a", "MAIN", 3), e("b", "MAIN", 2)], { a: 1, b: 5 });
    expect(r.cards).toEqual([
      { cardId: "a", needed: 3, owned: 1, ownedTotal: 1, missing: 2 },
      { cardId: "b", needed: 2, owned: 2, ownedTotal: 5, missing: 0 },
    ]);
    expect(r.totals).toEqual({ neededCopies: 5, ownedCopies: 3, missingCopies: 2, percent: 60 });
  });
  it("sums needs across zones", () => {
    const r = computeCompleteness([e("a", "CHAMPION", 1), e("a", "MAIN", 2)], { a: 2 });
    expect(r.cards[0]).toMatchObject({ needed: 3, owned: 2, missing: 1 });
  });
  it("rounds to one decimal", () => {
    expect(computeCompleteness([e("a", "MAIN", 3)], { a: 1 }).totals.percent).toBe(33.3);
  });
  it("excludes sideboard by default, includes on request", () => {
    const entries = [e("a", "MAIN", 1), e("s", "SIDEBOARD", 3)];
    expect(computeCompleteness(entries, { a: 1 }).totals.percent).toBe(100);
    const r = computeCompleteness(entries, { a: 1 }, { includeSideboard: true });
    expect(r.totals).toMatchObject({ neededCopies: 4, missingCopies: 3, percent: 25 });
  });
  it("empty deck is 100%, nothing owned is 0%", () => {
    expect(computeCompleteness([], {}).totals.percent).toBe(100);
    expect(computeCompleteness([e("a", "MAIN", 2)], {}).totals.percent).toBe(0);
  });
});

describe("computeBorrowable", () => {
  // missing: a:2, b:2 ; owned a:1, c:1
  const comp = computeCompleteness([e("a", "MAIN", 3), e("b", "MAIN", 2), e("c", "MAIN", 1)], { a: 1, c: 1 });
  it("lists sources and caps coverable at missing", () => {
    const r = computeBorrowable(comp, [
      { sourceId: "f1", label: "Ann", kind: "FOLLOW", ownedQtyByCardId: { a: 5, b: 1 } },
      { sourceId: "i1", label: "Imp", kind: "IMPORT", ownedQtyByCardId: { b: 3 } },
    ]);
    expect(r.cards.map((c) => c.cardId)).toEqual(["a", "b"]);
    expect(r.cards[0]).toMatchObject({ coverable: 2, sources: [{ sourceId: "f1", qty: 5 }] });
    expect(r.cards[1].sources.map((s) => s.sourceId)).toEqual(["i1", "f1"]);
    expect(r.cards[1].coverable).toBe(2);
    expect(r.coverableCopies).toBe(4);
    expect(r.percentWithFriends).toBe(100);
  });
  it("partial coverage and uncovered cards", () => {
    const r = computeBorrowable(comp, [{ sourceId: "f1", label: "Ann", kind: "FOLLOW", ownedQtyByCardId: { a: 1 } }]);
    expect(r.cards[1]).toMatchObject({ cardId: "b", sources: [], coverable: 0 });
    expect(r.coverableCopies).toBe(1);
    expect(r.missingCopies).toBe(4);
    expect(r.percentWithFriends).toBe(50);
  });
  it("no sources leaves percent unchanged; complete deck has no cards", () => {
    expect(computeBorrowable(comp, []).percentWithFriends).toBe(comp.totals.percent);
    const done = computeCompleteness([e("a", "MAIN", 1)], { a: 1 });
    expect(computeBorrowable(done, []).cards).toEqual([]);
  });
});

describe("rankDecksByCompleteness", () => {
  it("sorts by percent desc then missing asc", () => {
    const decks = [
      { id: "low", entries: [e("a", "MAIN", 4)] },
      { id: "high", entries: [e("a", "MAIN", 2)] },
      { id: "bigger", entries: [e("a", "MAIN", 2), e("z", "MAIN", 2)] },
    ];
    expect(rankDecksByCompleteness(decks, { a: 2 }).map((x) => x.deck.id)).toEqual(["high", "bigger", "low"]);
  });
});
