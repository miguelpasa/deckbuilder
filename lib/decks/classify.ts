import type { DeckCard } from "./types";

/**
 * All card type / domain classification lives here (Riot API strings are unconfirmed).
 * Matching is lenient and case-insensitive.
 */
export const KNOWN_DOMAINS = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"] as const;

/** Tags that are not champion names; ignored when matching legend <-> champion. */
const GENERIC_TAGS = new Set([
  "champion", "signature", "legend", "unit", "spell", "gear", "rune", "battlefield",
  "token", "action", "reaction", "equipment", "mech", "yordle", "poro", "dragon",
]);

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export type CardKind =
  | "LEGEND" | "CHAMPION_UNIT" | "UNIT" | "SPELL" | "GEAR" | "RUNE" | "BATTLEFIELD" | "OTHER";

export function cardKind(card: Pick<DeckCard, "type" | "tags">): CardKind {
  const t = norm(card.type);
  const tags = card.tags.map(norm);
  if (t.includes("legend")) return "LEGEND";
  if (t.includes("rune")) return "RUNE";
  if (t.includes("battlefield")) return "BATTLEFIELD";
  if (t.includes("champion")) return "CHAMPION_UNIT";
  if (t.includes("unit")) return tags.includes("champion") ? "CHAMPION_UNIT" : "UNIT";
  if (t.includes("spell")) return "SPELL";
  if (t.includes("gear") || t.includes("equipment")) return "GEAR";
  return "OTHER";
}

export function isSignature(card: Pick<DeckCard, "type" | "tags">): boolean {
  return norm(card.type).includes("signature") || card.tags.some((t) => norm(t) === "signature");
}

/** Parses "Fury/Mind", "Fury, Mind", "Fury & Mind" etc. Unknown tokens are kept (capitalised). */
export function parseDomains(faction: string | null | undefined): string[] {
  const raw = (faction ?? "").trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(/[\/,&+|;]|\band\b/i)) {
    const p = norm(part);
    if (!p || p === "colorless" || p === "none" || p === "neutral") continue;
    const name = p.charAt(0).toUpperCase() + p.slice(1);
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** Champion-identifying tags (generic tags removed), lowercased. */
export function championTags(card: Pick<DeckCard, "tags">): string[] {
  return card.tags.map(norm).filter((t) => t && !GENERIC_TAGS.has(t));
}

export function sharesChampionTag(a: Pick<DeckCard, "tags">, b: Pick<DeckCard, "tags">): boolean {
  const bt = new Set(championTags(b));
  return championTags(a).some((t) => bt.has(t));
}

/** Card is permitted in the identity if it has no domain, or all its domains are in the identity. */
export function fitsDomainIdentity(card: Pick<DeckCard, "faction">, identity: string[]): boolean {
  const doms = parseDomains(card.faction);
  const id = new Set(identity.map((d) => d.toLowerCase()));
  return doms.every((d) => id.has(d.toLowerCase()));
}

export function cardNameKey(card: Pick<DeckCard, "name">): string {
  return norm(card.name).replace(/\s+/g, " ");
}
