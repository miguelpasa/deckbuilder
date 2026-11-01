/** Minimal card shape the domain logic needs. Fed from DB rows later. */
export interface DeckCard {
  id: string;
  publicCode: string;
  name: string;
  type: string;
  faction: string | null;
  rarity: string | null;
  tags: string[];
}

export const DECK_ZONES = [
  "LEGEND",
  "CHAMPION",
  "MAIN",
  "RUNE",
  "BATTLEFIELD",
  "SIDEBOARD",
] as const;
export type DeckZone = (typeof DECK_ZONES)[number];

export interface DeckEntry {
  cardId: string;
  zone: DeckZone;
  quantity: number;
}

export interface DeckInput {
  entries: DeckEntry[];
}

export type IssueSeverity = "error" | "warning";

export interface DeckIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  cardIds?: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: DeckIssue[];
}

/** Owned copies per card id (all printings summed). */
export type OwnedQtyByCardId = Record<string, number>;
