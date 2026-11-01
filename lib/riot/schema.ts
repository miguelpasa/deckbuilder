import { z } from "zod";

/**
 * Permissive schema for Riot's Riftbound content payload.
 *
 * A Riot GitHub issue reports the real response does not match the documented
 * art DTO, so everything except ids and names is optional/nullable, objects are
 * loose, and alternative art keys are accepted. The full raw object is kept.
 */

const lenientString = z.unknown().transform((v): string | null => {
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
});

const lenientInt = z.unknown().transform((v): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
});

const lenientStringArray = z.unknown().transform((v): string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
});

const idString = z.union([z.string().min(1), z.number()]).transform(String);

const looseRecord = z.record(z.string(), z.unknown());

function pick(obj: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

export const riotCardSchema = z
  .looseObject({
    id: idString,
    name: z.string().min(1),
    collectorNumber: lenientInt.optional(),
    set: z.unknown().optional(),
    description: lenientString.optional(),
    type: lenientString.optional(),
    rarity: lenientString.optional(),
    faction: lenientString.optional(),
    stats: looseRecord.nullish(),
    art: looseRecord.nullish(),
    flavorText: lenientString.optional(),
    tags: lenientStringArray.optional(),
    subtitle: lenientString.optional(),
    effect: lenientString.optional(),
  })
  .transform((raw) => {
    const stats = (raw.stats ?? {}) as Record<string, unknown>;
    const art = (raw.art ?? undefined) as Record<string, unknown> | undefined;
    const r = raw as Record<string, unknown>;
    const setRef =
      typeof raw.set === "string"
        ? raw.set
        : raw.set && typeof raw.set === "object"
          ? pick(raw.set as Record<string, unknown>, ["id", "setId"])
          : null;
    return {
      id: raw.id,
      name: raw.name,
      setRef: setRef ? setRef.toUpperCase() : null,
      collectorNumber: raw.collectorNumber ?? null,
      subtitle: raw.subtitle ?? null,
      type: raw.type ?? null,
      rarity: raw.rarity ?? null,
      faction: raw.faction ?? null,
      description: raw.description ?? null,
      effect: raw.effect ?? null,
      flavorText: raw.flavorText ?? null,
      tags: raw.tags ?? [],
      energy: lenientInt.parse(stats.energy),
      might: lenientInt.parse(stats.might),
      cost: lenientInt.parse(stats.cost),
      power: lenientInt.parse(stats.power),
      thumbnailUrl:
        pick(art, ["thumbnailURL", "thumbnailUrl", "thumbnail", "thumb", "small"]) ??
        pick(r, ["thumbnailURL", "thumbnailUrl", "thumbnail"]),
      fullUrl:
        pick(art, ["fullURL", "fullUrl", "full", "url", "image", "large"]) ??
        pick(r, ["fullURL", "fullUrl", "imageUrl", "image"]),
      artist: pick(art, ["artist", "illustrator"]) ?? pick(r, ["artist"]),
      raw: r,
    };
  });

export const riotSetSchema = z
  .looseObject({
    id: idString,
    name: z.string().min(1),
    cards: z.array(riotCardSchema).default([]),
  })
  .transform((s) => ({
    id: s.id.toUpperCase(),
    name: s.name,
    cards: s.cards,
    raw: Object.fromEntries(Object.entries(s).filter(([k]) => k !== "cards")),
  }));

export const riotContentSchema = z
  .looseObject({
    game: lenientString.optional(),
    version: lenientString.optional(),
    lastUpdated: lenientString.optional(),
    sets: z.array(riotSetSchema),
  })
  .transform((c) => ({
    game: c.game ?? null,
    version: c.version ?? null,
    lastUpdated: c.lastUpdated ?? null,
    sets: c.sets,
  }));

export type RiotCard = z.output<typeof riotCardSchema>;
export type RiotSet = z.output<typeof riotSetSchema>;
export type RiotContent = z.output<typeof riotContentSchema>;

/** `OGN-042`: `${setId}-${collectorNumber padded to 3}`; null without a number. */
export function derivePublicCode(setId: string, collectorNumber: number | null | undefined): string | null {
  if (collectorNumber === null || collectorNumber === undefined || !Number.isInteger(collectorNumber) || collectorNumber < 0) {
    return null;
  }
  return `${setId.toUpperCase()}-${String(collectorNumber).padStart(3, "0")}`;
}

export function parseRiotContent(input: unknown): RiotContent {
  return riotContentSchema.parse(input);
}
