import {
  cardKind, cardNameKey, fitsDomainIdentity, isSignature, parseDomains, sharesChampionTag,
} from "./classify";
import { DECK_RULES as R } from "./rules-config";
import type { DeckCard, DeckInput, DeckIssue, DeckZone, ValidationResult } from "./types";

type Cards = Record<string, DeckCard> | Map<string, DeckCard>;

function lookup(cards: Cards, id: string): DeckCard | undefined {
  return cards instanceof Map ? cards.get(id) : cards[id];
}

export function validateDeck(deck: DeckInput, cardsById: Cards): ValidationResult {
  const issues: DeckIssue[] = [];
  const add = (code: string, severity: DeckIssue["severity"], message: string, cardIds?: string[]) =>
    issues.push({ code, severity, message, ...(cardIds?.length ? { cardIds } : {}) });

  // Merge duplicate (cardId, zone) rows and drop non-positive quantities.
  const byZone: Record<DeckZone, Map<string, number>> = {
    LEGEND: new Map(), CHAMPION: new Map(), MAIN: new Map(),
    RUNE: new Map(), BATTLEFIELD: new Map(), SIDEBOARD: new Map(),
  };
  const unknown = new Set<string>();
  for (const e of deck.entries) {
    if (!Number.isInteger(e.quantity) || e.quantity <= 0) {
      add("INVALID_QUANTITY", "error", `Invalid quantity ${e.quantity} for card ${e.cardId}.`, [e.cardId]);
      continue;
    }
    if (!lookup(cardsById, e.cardId)) {
      unknown.add(e.cardId);
      continue;
    }
    const m = byZone[e.zone];
    m.set(e.cardId, (m.get(e.cardId) ?? 0) + e.quantity);
  }
  if (unknown.size) {
    add("UNKNOWN_CARD", "error", `${unknown.size} card(s) not found in the card database.`, [...unknown]);
  }

  const total = (z: DeckZone) => [...byZone[z].values()].reduce((a, b) => a + b, 0);
  const cardsIn = (z: DeckZone) =>
    [...byZone[z].entries()].map(([id, qty]) => ({ card: lookup(cardsById, id)!, qty }));

  // Legend
  const legends = cardsIn("LEGEND");
  const legend = legends[0]?.card;
  if (total("LEGEND") !== R.legendCount) {
    add("LEGEND_COUNT", "error",
      total("LEGEND") === 0 ? "Deck needs a Champion Legend." : `Deck must have exactly ${R.legendCount} Legend (found ${total("LEGEND")}).`,
      legends.map((l) => l.card.id));
  }
  for (const { card } of legends) {
    if (cardKind(card) !== "LEGEND") add("ZONE_TYPE_MISMATCH", "error", `${card.name} is not a Legend.`, [card.id]);
  }

  // Domain identity
  const identity = legend ? parseDomains(legend.faction) : [];
  if (legend && identity.length !== R.legendDomainCount) {
    add("LEGEND_DOMAINS", "warning",
      `Legend ${legend.name} has ${identity.length} recognised domain(s); expected ${R.legendDomainCount}. Domain checks may be inaccurate.`, [legend.id]);
  }

  // Chosen champion
  const champs = cardsIn("CHAMPION");
  const champCount = total("CHAMPION");
  if (champCount !== R.championCount) {
    add("CHAMPION_COUNT", "error",
      champCount === 0 ? "Deck needs a Chosen Champion." : `Deck must have exactly ${R.championCount} Chosen Champion (found ${champCount}).`,
      champs.map((c) => c.card.id));
  }
  for (const { card } of champs) {
    if (cardKind(card) !== "CHAMPION_UNIT") {
      add("CHAMPION_NOT_CHAMPION", "error", `${card.name} is not a champion unit.`, [card.id]);
    } else if (isSignature(card)) {
      add("CHAMPION_IS_SIGNATURE", "error", `${card.name} is a Signature card and cannot be the Chosen Champion.`, [card.id]);
    } else if (legend && !sharesChampionTag(card, legend)) {
      add("CHAMPION_TAG_MISMATCH", "error", `${card.name} does not match Legend ${legend.name}'s champion tag.`, [card.id, legend.id]);
    }
  }

  // Main deck size (chosen champion counts toward it)
  const mainTotal = total("MAIN") + champCount;
  if (mainTotal < R.mainDeckMin) {
    add("MAIN_TOO_SMALL", "error", `Main deck has ${mainTotal} cards (including Chosen Champion); minimum is ${R.mainDeckMin}.`);
  } else if (mainTotal > R.mainDeckTournamentMax) {
    add("MAIN_ABOVE_TOURNAMENT", "warning", `Main deck has ${mainTotal} cards; tournaments require exactly ${R.mainDeckTournamentMax}.`);
  }
  for (const { card } of cardsIn("MAIN")) {
    const k = cardKind(card);
    if (k === "LEGEND" || k === "RUNE" || k === "BATTLEFIELD") {
      add("ZONE_TYPE_MISMATCH", "error", `${card.name} (${card.type}) cannot be in the main deck.`, [card.id]);
    }
  }

  // Copy limit by name
  const names = new Map<string, { qty: number; side: number; ids: Set<string>; name: string }>();
  const bump = (card: DeckCard, qty: number, side: boolean) => {
    const key = cardNameKey(card);
    const cur = names.get(key) ?? { qty: 0, side: 0, ids: new Set<string>(), name: card.name };
    if (side) cur.side += qty; else cur.qty += qty;
    cur.ids.add(card.id);
    names.set(key, cur);
  };
  for (const z of ["MAIN", "CHAMPION"] as const) for (const { card, qty } of cardsIn(z)) bump(card, qty, false);
  for (const { card, qty } of cardsIn("SIDEBOARD")) bump(card, qty, true);
  for (const v of names.values()) {
    if (v.qty > R.maxCopiesPerName) {
      add("TOO_MANY_COPIES", "error", `${v.name}: ${v.qty} copies in the main deck; max is ${R.maxCopiesPerName}.`, [...v.ids]);
    } else if (R.copyCapIncludesSideboard && v.qty + v.side > R.maxCopiesPerName) {
      add("TOO_MANY_COPIES_WITH_SIDEBOARD", "warning",
        `${v.name}: ${v.qty + v.side} copies including sideboard; max is ${R.maxCopiesPerName}.`, [...v.ids]);
    }
  }

  // Signature cards (main deck only; champion zone handled above)
  let sigTotal = 0;
  const sigIds: string[] = [];
  for (const z of ["MAIN", "SIDEBOARD"] as const) {
    for (const { card, qty } of cardsIn(z)) {
      if (!isSignature(card)) continue;
      if (legend && !sharesChampionTag(card, legend)) {
        add("SIGNATURE_WRONG_CHAMPION", "error", `${card.name} is a Signature card for a different champion than ${legend.name}.`, [card.id]);
      } else if (z === "MAIN") {
        sigTotal += qty;
        sigIds.push(card.id);
      }
    }
  }
  if (sigTotal > R.maxSignatureCards) {
    add("TOO_MANY_SIGNATURE", "error", `Deck has ${sigTotal} Signature cards; max is ${R.maxSignatureCards}.`, sigIds);
  }

  // Rune deck
  const runeTotal = total("RUNE");
  if (runeTotal !== R.runeDeckSize) {
    add("RUNE_COUNT", "error", `Rune deck has ${runeTotal} cards; it must have exactly ${R.runeDeckSize}.`);
  }
  for (const { card } of cardsIn("RUNE")) {
    if (cardKind(card) !== "RUNE") add("ZONE_TYPE_MISMATCH", "error", `${card.name} is not a Rune.`, [card.id]);
  }

  // Battlefields
  const bfTotal = total("BATTLEFIELD");
  if (bfTotal !== R.battlefieldCount) {
    add("BATTLEFIELD_COUNT", "error", `Deck has ${bfTotal} battlefields; it must have exactly ${R.battlefieldCount}.`);
  }
  const bfNames = new Map<string, { ids: Set<string>; copies: number }>();
  for (const { card, qty } of cardsIn("BATTLEFIELD")) {
    if (cardKind(card) !== "BATTLEFIELD") add("ZONE_TYPE_MISMATCH", "error", `${card.name} is not a Battlefield.`, [card.id]);
    const key = cardNameKey(card);
    const cur = bfNames.get(key) ?? { ids: new Set<string>(), copies: 0 };
    cur.ids.add(card.id);
    cur.copies += qty;
    bfNames.set(key, cur);
  }
  for (const [name, v] of bfNames) {
    if (v.copies > 1) add("DUPLICATE_BATTLEFIELD", "error", `Battlefield "${name}" appears more than once; battlefields must be distinct.`, [...v.ids]);
  }

  // Sideboard
  if (total("SIDEBOARD") > R.sideboardMax) {
    add("SIDEBOARD_TOO_LARGE", "error", `Sideboard has ${total("SIDEBOARD")} cards; max is ${R.sideboardMax}.`);
  }

  // Domain identity (battlefields are exempt; they are usually colorless)
  if (legend) {
    const bad = new Set<string>();
    for (const z of ["MAIN", "CHAMPION", "RUNE", "SIDEBOARD"] as const) {
      for (const { card } of cardsIn(z)) {
        if (!fitsDomainIdentity(card, identity)) bad.add(card.id);
      }
    }
    if (bad.size) {
      add("DOMAIN_IDENTITY", "error",
        `${bad.size} card(s) are outside the Legend's domain identity (${identity.join("/") || "none"}).`, [...bad]);
    }
  }

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}
