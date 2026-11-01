import type { DeckCard, DeckEntry, DeckInput } from "./types";

let n = 0;
export function card(p: Partial<DeckCard> & { name: string }): DeckCard {
  n++;
  return {
    id: p.id ?? `c${n}`,
    publicCode: p.publicCode ?? `TST-${String(n).padStart(3, "0")}`,
    name: p.name,
    type: p.type ?? "Unit",
    faction: p.faction ?? null,
    rarity: p.rarity ?? null,
    tags: p.tags ?? [],
  };
}

/** Builds a valid Fury/Mind deck for a Kai'Sa legend (test fixture only). */
export function buildValidDeck() {
  const cards: Record<string, DeckCard> = {};
  const reg = (c: DeckCard) => ((cards[c.id] = c), c);
  const legend = reg(card({ id: "legend", name: "Kai'Sa Legend", type: "Legend", faction: "Fury/Mind", tags: ["Kai'Sa"] }));
  const champ = reg(card({ id: "champ", name: "Kai'Sa Champion", type: "Champion Unit", faction: "Fury", tags: ["Kai'Sa", "Champion"] }));
  const entries: DeckEntry[] = [
    { cardId: legend.id, zone: "LEGEND", quantity: 1 },
    { cardId: champ.id, zone: "CHAMPION", quantity: 1 },
  ];
  // 13 distinct cards x3 = 39 main cards (+ champion = 40)
  for (let i = 0; i < 13; i++) {
    const c = reg(card({ id: `m${i}`, name: `Main ${i}`, type: i % 2 ? "Spell" : "Unit", faction: i % 2 ? "Mind" : "Fury" }));
    entries.push({ cardId: c.id, zone: "MAIN", quantity: 3 });
  }
  const r1 = reg(card({ id: "rf", name: "Fury Rune", type: "Rune", faction: "Fury" }));
  const r2 = reg(card({ id: "rm", name: "Mind Rune", type: "Rune", faction: "Mind" }));
  entries.push({ cardId: r1.id, zone: "RUNE", quantity: 6 }, { cardId: r2.id, zone: "RUNE", quantity: 6 });
  for (let i = 0; i < 3; i++) {
    const b = reg(card({ id: `b${i}`, name: `Battlefield ${i}`, type: "Battlefield" }));
    entries.push({ cardId: b.id, zone: "BATTLEFIELD", quantity: 1 });
  }
  const deck: DeckInput = { entries };
  return { deck, cards, legend, champ };
}
