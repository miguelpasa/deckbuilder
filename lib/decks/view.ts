import "server-only";

import { eq } from "drizzle-orm";

import type { CurrentUser } from "@/lib/auth/session";
import { decks, type Card } from "@/lib/db/schema";
import {
  getBorrowSources,
  getCardsByIds,
  getOwnedQtyByCardId,
  loadDecks,
  type DeckWithEntries,
} from "@/lib/data/queries";
import { computeBorrowable, computeCompleteness } from "./completeness";
import type { BorrowableResult, CompletenessResult } from "./completeness";
import { validateDeck } from "./rules";
import { canViewDeck, isUuid } from "./service";
import type { DeckCard, ValidationResult } from "./types";

export function toDeckCard(c: Card): DeckCard {
  return {
    id: c.id,
    publicCode: c.publicCode ?? "",
    name: c.name,
    type: c.type ?? "",
    faction: c.faction,
    rarity: c.rarity,
    tags: c.tags,
  };
}

export interface DeckDetail {
  deck: DeckWithEntries;
  cards: Map<string, Card>;
  validation: ValidationResult;
  completeness: CompletenessResult | null;
  borrowable: BorrowableResult | null;
  isOwner: boolean;
}

/** Loads everything the deck page needs. Returns null if missing or not visible to the viewer. */
export async function loadDeckDetail(deckId: string, user: CurrentUser | null): Promise<DeckDetail | null> {
  if (!isUuid(deckId)) return null;
  const [deck] = await loadDecks(eq(decks.id, deckId));
  if (!deck || !canViewDeck(deck, user?.id ?? null)) return null;

  const cards = await getCardsByIds([...new Set(deck.entries.map((e) => e.cardId))]);
  const deckCards = new Map([...cards].map(([id, c]) => [id, toDeckCard(c)]));
  const validation = validateDeck({ entries: deck.entries }, deckCards);

  let completeness: CompletenessResult | null = null;
  let borrowable: BorrowableResult | null = null;
  if (user) {
    const owned = await getOwnedQtyByCardId(user.id);
    completeness = computeCompleteness(deck.entries, owned);
    borrowable = computeBorrowable(completeness, await getBorrowSources(user.id));
  }
  return { deck, cards, validation, completeness, borrowable, isOwner: !!user && deck.ownerId === user.id };
}

export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Showcase", "Overnumbered"];

export function rarityRank(r: string | null): number {
  const i = RARITY_ORDER.findIndex((x) => x.toLowerCase() === (r ?? "").toLowerCase());
  return i === -1 ? RARITY_ORDER.length : i;
}
