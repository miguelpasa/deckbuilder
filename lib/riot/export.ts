import { derivePublicCode, type RiotContent } from "./schema";

export interface CatalogCard {
  id: string;
  publicCode: string | null;
  name: string;
  subtitle: string | null;
  setId: string;
  setName: string;
  collectorNumber: number | null;
  type: string | null;
  rarity: string | null;
  faction: string | null;
  tags: string[];
  energy: number | null;
  might: number | null;
  cost: number | null;
  power: number | null;
  description: string | null;
  effect: string | null;
  flavorText: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  fullUrl: string | null;
}

export interface Catalog {
  version: string | null;
  lastUpdated: string | null;
  generatedAt: string;
  cardCount: number;
  sets: { id: string; name: string; cardCount: number }[];
  cards: CatalogCard[];
}

/** Flattens Riot content into the searchable catalog. Deterministic ordering. */
export function buildCatalog(content: RiotContent, generatedAt = new Date().toISOString()): Catalog {
  const seen = new Map<string, CatalogCard>();
  for (const s of content.sets) {
    for (const c of s.cards) {
      seen.set(c.id, {
        id: c.id,
        publicCode: derivePublicCode(s.id, c.collectorNumber),
        name: c.name,
        subtitle: c.subtitle,
        setId: s.id,
        setName: s.name,
        collectorNumber: c.collectorNumber,
        type: c.type,
        rarity: c.rarity,
        faction: c.faction,
        tags: c.tags,
        energy: c.energy,
        might: c.might,
        cost: c.cost,
        power: c.power,
        description: c.description,
        effect: c.effect,
        flavorText: c.flavorText,
        artist: c.artist,
        thumbnailUrl: c.thumbnailUrl,
        fullUrl: c.fullUrl,
      });
    }
  }
  const cards = [...seen.values()].sort(
    (a, b) =>
      a.setId.localeCompare(b.setId) ||
      (a.collectorNumber ?? Infinity) - (b.collectorNumber ?? Infinity) ||
      a.id.localeCompare(b.id),
  );
  return {
    version: content.version,
    lastUpdated: content.lastUpdated,
    generatedAt,
    cardCount: cards.length,
    sets: content.sets.map((s) => ({ id: s.id, name: s.name, cardCount: s.cards.length })),
    cards,
  };
}

/** Cards that have no usable art URL. */
export function cardsMissingArt(catalog: Catalog): CatalogCard[] {
  return catalog.cards.filter((c) => !c.fullUrl || !c.thumbnailUrl);
}
