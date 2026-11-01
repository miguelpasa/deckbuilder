// Regenerates data/dev-decks/placeholder-deck.json from the placeholder fixture
// and checks it passes validateDeck. Development data only.
import { readFileSync, writeFileSync } from "node:fs";

import type { DeckCard, DeckEntry } from "@/lib/decks/types";
import { validateDeck } from "@/lib/decks/rules";
import { derivePublicCode } from "@/lib/riot/schema";

type FixtureCard = {
  id: string;
  set?: string;
  collectorNumber: number;
  name: string;
  type: string;
  faction: string | null;
  rarity: string | null;
  tags?: string[];
};

const fixture = JSON.parse(readFileSync("lib/riot/fixtures/placeholder-content.json", "utf8"));
const cards: DeckCard[] = (fixture.sets[0].cards as FixtureCard[]).map((c) => ({
  id: c.id,
  publicCode: derivePublicCode(c.set ?? "DEV", c.collectorNumber) ?? c.id,
  name: c.name,
  type: c.type,
  faction: c.faction,
  rarity: c.rarity,
  tags: c.tags ?? [],
}));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
const inIdentity = (c: DeckCard) => c.faction === "Fury" || c.faction === "Body";

const champion = cards.find((c) => c.type === "Champion Unit" && c.faction === "Fury")!;
const entries: DeckEntry[] = [
  { cardId: "dev-001", zone: "LEGEND", quantity: 1 },
  { cardId: champion.id, zone: "CHAMPION", quantity: 1 },
];
let main = 0;
for (const c of cards) {
  if (main >= 39) break;
  if (!inIdentity(c) || c.id === champion.id) continue;
  if (!["Unit", "Spell", "Gear", "Champion Unit"].includes(c.type)) continue;
  const qty = Math.min(3, 39 - main);
  entries.push({ cardId: c.id, zone: "MAIN", quantity: qty });
  main += qty;
}
for (const c of cards.filter((c) => c.type === "Rune" && inIdentity(c))) {
  entries.push({ cardId: c.id, zone: "RUNE", quantity: 6 });
}
for (const c of cards.filter((c) => c.type === "Battlefield").slice(0, 3)) {
  entries.push({ cardId: c.id, zone: "BATTLEFIELD", quantity: 1 });
}

const result = validateDeck({ entries }, byId);
console.log(`main=${main}`, JSON.stringify(result));
if (!result.valid) process.exit(1);

const path = "data/dev-decks/placeholder-deck.json";
const deck = JSON.parse(readFileSync(path, "utf8"));
deck.legend = byId["dev-001"].publicCode;
deck.cards = entries.map((e) => ({ code: byId[e.cardId].publicCode, qty: e.quantity, zone: e.zone }));
writeFileSync(path, JSON.stringify(deck, null, 2) + "\n");
console.log(`wrote ${path}`);
