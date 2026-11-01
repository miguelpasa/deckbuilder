import { z } from "zod";
import { isCardCode, normalizeCode } from "./codes";

/**
 * Versioned share formats. Exports contain ONLY public card codes and counts:
 * never card text, art or other Riot API data.
 */
export const COLLECTION_FORMAT = "riftbound-collection";
export const DECK_FORMAT = "riftbound-deck";
export const SHARE_VERSION = 1;

export const VARIANTS = ["NORMAL", "FOIL", "ALT_ART"] as const;
export const SHARE_ZONES = ["LEGEND", "CHAMPION", "MAIN", "RUNE", "BATTLEFIELD", "SIDEBOARD"] as const;

const codeSchema = z
  .string()
  .refine((s) => isCardCode(s), { message: "must be a card code like OGN-042" })
  .transform(normalizeCode);

export const collectionSchema = z.object({
  format: z.literal(COLLECTION_FORMAT),
  version: z.literal(SHARE_VERSION),
  exportedAt: z.string().optional(),
  owner: z.string().max(100).optional(),
  cards: z.array(
    z.object({
      code: codeSchema,
      variant: z.enum(VARIANTS),
      qty: z.number().int().positive(),
    }),
  ),
});

export const deckSchema = z.object({
  format: z.literal(DECK_FORMAT),
  version: z.literal(SHARE_VERSION),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  source: z.enum(["META", "USER"]).optional(),
  eventName: z.string().max(200).optional(),
  placement: z.string().max(100).optional(),
  legend: codeSchema.optional(),
  cards: z.array(
    z.object({
      code: codeSchema,
      qty: z.number().int().positive(),
      zone: z.enum(SHARE_ZONES),
    }),
  ),
});

export type CollectionJson = z.output<typeof collectionSchema>;
export type DeckJson = z.output<typeof deckSchema>;
export type ShareVariant = (typeof VARIANTS)[number];
export type ShareZone = (typeof SHARE_ZONES)[number];

export type ParseShareResult =
  | { ok: true; kind: "collection"; data: CollectionJson }
  | { ok: true; kind: "deck"; data: DeckJson }
  | { ok: false; errors: string[] };

function formatIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => {
    const path = i.path
      .map((p, idx) => (typeof p === "number" ? `[${p}]` : idx === 0 ? String(p) : `.${String(p)}`))
      .join("");
    return path ? `${path}: ${i.message}` : i.message;
  });
}

export function parseShareJson(text: string): ParseShareResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This is not valid JSON."] };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["Expected a JSON object."] };
  }
  const format = (raw as { format?: unknown }).format;
  if (format === COLLECTION_FORMAT) {
    const r = collectionSchema.safeParse(raw);
    return r.success ? { ok: true, kind: "collection", data: r.data } : { ok: false, errors: formatIssues(r.error) };
  }
  if (format === DECK_FORMAT) {
    const r = deckSchema.safeParse(raw);
    return r.success ? { ok: true, kind: "deck", data: r.data } : { ok: false, errors: formatIssues(r.error) };
  }
  return {
    ok: false,
    errors: [`Unknown or missing "format". Expected "${COLLECTION_FORMAT}" or "${DECK_FORMAT}".`],
  };
}

export interface ResolveResult<T extends { code: string }> {
  resolved: (T & { cardId: string })[];
  /** Unique, normalized codes that did not match any card. Never silently dropped. */
  unknownCodes: string[];
}

export function resolveCodes<T extends { code: string }>(
  items: T[],
  codeToCardId: Map<string, string> | Record<string, string>,
): ResolveResult<T> {
  const get = (code: string) =>
    codeToCardId instanceof Map ? codeToCardId.get(code) : Object.hasOwn(codeToCardId, code) ? codeToCardId[code] : undefined;
  const resolved: (T & { cardId: string })[] = [];
  const unknown = new Set<string>();
  for (const item of items) {
    const code = normalizeCode(item.code);
    const cardId = get(code) ?? get(item.code);
    if (cardId === undefined) unknown.add(code);
    else resolved.push({ ...item, cardId });
  }
  return { resolved, unknownCodes: [...unknown] };
}

export function toCollectionJson(
  cards: { code: string; variant: ShareVariant; qty: number }[],
  opts: { owner?: string; exportedAt?: Date | string } = {},
): string {
  const exportedAt = opts.exportedAt instanceof Date ? opts.exportedAt.toISOString() : opts.exportedAt;
  const doc = {
    format: COLLECTION_FORMAT,
    version: SHARE_VERSION,
    ...(exportedAt ? { exportedAt } : {}),
    ...(opts.owner ? { owner: opts.owner } : {}),
    cards: cards
      .filter((c) => c.qty > 0)
      .map((c) => ({ code: normalizeCode(c.code), variant: c.variant, qty: c.qty }))
      .sort((a, b) => a.code.localeCompare(b.code) || a.variant.localeCompare(b.variant)),
  };
  return JSON.stringify(collectionSchema.parse(doc), null, 2);
}

export interface DeckExportInput {
  name: string;
  description?: string;
  source?: "META" | "USER";
  eventName?: string;
  placement?: string;
  legend?: string;
  cards: { code: string; qty: number; zone: ShareZone; name?: string }[];
}

export function toDeckJson(deck: DeckExportInput): string {
  const doc = {
    format: DECK_FORMAT,
    version: SHARE_VERSION,
    name: deck.name,
    ...(deck.description ? { description: deck.description } : {}),
    ...(deck.source ? { source: deck.source } : {}),
    ...(deck.eventName ? { eventName: deck.eventName } : {}),
    ...(deck.placement ? { placement: deck.placement } : {}),
    ...(deck.legend ? { legend: deck.legend } : {}),
    cards: deck.cards.map((c) => ({ code: c.code, qty: c.qty, zone: c.zone })),
  };
  return JSON.stringify(deckSchema.parse(doc), null, 2);
}

const ZONE_TITLES: Record<ShareZone, string> = {
  LEGEND: "Legend",
  CHAMPION: "Chosen Champion",
  MAIN: "Main Deck",
  RUNE: "Rune Deck",
  BATTLEFIELD: "Battlefields",
  SIDEBOARD: "Sideboard",
};

/** Plain decklist: "3 OGN-042 Card Name", grouped by zone. */
export function toDeckText(deck: DeckExportInput): string {
  const blocks: string[] = [];
  for (const zone of SHARE_ZONES) {
    const rows = deck.cards.filter((c) => c.zone === zone);
    if (!rows.length) continue;
    const lines = rows.map((c) => `${c.qty} ${normalizeCode(c.code)}${c.name ? ` ${c.name}` : ""}`);
    blocks.push(`${ZONE_TITLES[zone]}:\n${lines.join("\n")}`);
  }
  return `${deck.name}\n\n${blocks.join("\n\n")}\n`;
}
