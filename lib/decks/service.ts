/**
 * Deck persistence logic. Deliberately free of `server-only`, cookies and Next
 * imports so scripts (seed, smoke tests) can run it with tsx. Every function
 * takes the acting user id explicitly; callers (Server Actions / route
 * handlers) derive it from the session, never from client input.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { cards, deckCards, decks } from "@/lib/db/schema";
import {
  parseShareJson,
  resolveCodes,
  toDeckJson,
  type DeckExportInput,
  type DeckJson,
  type ShareZone,
} from "@/lib/share/schema";
import { DECK_ZONES, type DeckEntry, type DeckZone } from "./types";

export const deckInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  isPublic: z.boolean().default(false),
  entries: z
    .array(
      z.object({
        cardId: z.string().min(1).max(100),
        zone: z.enum(DECK_ZONES),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(300),
});
export type DeckInputData = z.input<typeof deckInputSchema>;

export type DeckRow = typeof decks.$inferSelect;
export type ServiceResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Merges duplicate (card, zone) rows. */
function mergeEntries(entries: DeckEntry[]): DeckEntry[] {
  const m = new Map<string, DeckEntry>();
  for (const e of entries) {
    const k = `${e.cardId}|${e.zone}`;
    const cur = m.get(k);
    if (cur) cur.quantity += e.quantity;
    else m.set(k, { ...e });
  }
  return [...m.values()];
}

async function insertEntries(
  tx: Pick<typeof db, "insert">,
  deckId: string,
  entries: DeckEntry[],
) {
  if (entries.length === 0) return;
  await tx.insert(deckCards).values(entries.map((e) => ({ deckId, ...e })));
}

async function existingCardIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.select({ id: cards.id }).from(cards).where(inArray(cards.id, ids));
  return new Set(rows.map((r) => r.id));
}

/** Creates (no deckId) or updates a deck owned by `ownerId`. */
export async function saveUserDeck(
  ownerId: string,
  raw: unknown,
  deckId?: string,
  meta: { eventName?: string | null; placement?: string | null } = {},
): Promise<ServiceResult<{ deckId: string }>> {
  const parsed = deckInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;
  const entries = mergeEntries(input.entries);
  const known = await existingCardIds([...new Set(entries.map((e) => e.cardId))]);
  const missing = entries.filter((e) => !known.has(e.cardId));
  if (missing.length) return { ok: false, error: `${missing.length} card(s) do not exist.` };
  const legendCardId = entries.find((e) => e.zone === "LEGEND")?.cardId ?? null;

  if (deckId) {
    const [existing] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
    if (!existing || existing.ownerId !== ownerId) return { ok: false, error: "Deck not found." };
    await db.transaction(async (tx) => {
      await tx
        .update(decks)
        .set({
          name: input.name,
          description: input.description || null,
          isPublic: input.isPublic,
          legendCardId,
          updatedAt: new Date(),
        })
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, ownerId)));
      await tx.delete(deckCards).where(eq(deckCards.deckId, deckId));
      await insertEntries(tx, deckId, entries);
    });
    return { ok: true, deckId };
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(decks)
      .values({
        ownerId,
        name: input.name,
        description: input.description || null,
        isPublic: input.isPublic,
        legendCardId,
        source: "USER",
        isFeatured: false,
        eventName: meta.eventName ?? null,
        placement: meta.placement ?? null,
      })
      .returning({ id: decks.id });
    await insertEntries(tx, row.id, entries);
    return row.id;
  });
  return { ok: true, deckId: id };
}

export async function deleteUserDeck(ownerId: string, deckId: string): Promise<ServiceResult<object>> {
  if (!isUuid(deckId)) return { ok: false, error: "Deck not found." };
  const rows = await db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.ownerId, ownerId)))
    .returning({ id: decks.id });
  return rows.length ? { ok: true } : { ok: false, error: "Deck not found." };
}

/** Parses share JSON and creates a private deck. Unknown codes are reported, not silently dropped. */
export async function importUserDeckJson(
  ownerId: string,
  text: string,
): Promise<ServiceResult<{ deckId: string; unknownCodes: string[]; imported: number }>> {
  if (text.length > 500_000) return { ok: false, error: "File is too large." };
  const parsed = parseShareJson(text);
  if (!parsed.ok) return { ok: false, error: parsed.errors.join("; ") };
  if (parsed.kind !== "deck") return { ok: false, error: "This is a collection file, not a deck." };
  const deck = parsed.data;
  const codeMap = await getCardIdsByCodes(deck.cards.map((c) => c.code));
  const { resolved, unknownCodes } = resolveCodes(deck.cards, codeMap);
  if (resolved.length === 0) {
    return {
      ok: false,
      error: unknownCodes.length
        ? `None of the card codes exist in the card database yet (${unknownCodes.length} unknown: ${unknownCodes.slice(0, 10).join(", ")}${unknownCodes.length > 10 ? ", ..." : ""}).`
        : "The deck has no cards.",
    };
  }
  const res = await saveUserDeck(
    ownerId,
    {
      name: deck.name,
      description: deck.description ?? null,
      isPublic: false,
      entries: resolved.map((c) => ({ cardId: c.cardId, zone: c.zone, quantity: c.qty })),
    },
    undefined,
    { eventName: deck.eventName, placement: deck.placement },
  );
  if (!res.ok) return res;
  return { ok: true, deckId: res.deckId, unknownCodes, imported: resolved.length };
}

export async function getCardIdsByCodes(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .select({ id: cards.id, code: cards.publicCode })
    .from(cards)
    .where(inArray(cards.publicCode, [...new Set(codes)]));
  return new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.id]));
}

export type UpsertSystemResult =
  | { status: "created" | "updated"; deckId: string; name: string; cards: number }
  | { status: "skipped"; name: string; missingCodes: string[] };

/**
 * Upserts a system deck (ownerId null) by name. If any code is unknown the deck
 * is skipped and the missing codes are returned.
 */
export async function upsertSystemDeck(
  deck: DeckJson,
  opts: { source?: "META" | "USER"; isFeatured?: boolean } = {},
): Promise<UpsertSystemResult> {
  const codeMap = await getCardIdsByCodes(deck.cards.map((c) => c.code));
  const { resolved, unknownCodes } = resolveCodes(deck.cards, codeMap);
  if (unknownCodes.length) return { status: "skipped", name: deck.name, missingCodes: unknownCodes };

  const entries = mergeEntries(
    resolved.map((c) => ({ cardId: c.cardId, zone: c.zone as DeckZone, quantity: c.qty })),
  );
  const legendCardId = entries.find((e) => e.zone === "LEGEND")?.cardId ?? null;
  const values = {
    description: deck.description ?? null,
    legendCardId,
    source: opts.source ?? deck.source ?? "META",
    isFeatured: opts.isFeatured ?? true,
    isPublic: true,
    eventName: deck.eventName ?? null,
    placement: deck.placement ?? null,
    updatedAt: new Date(),
  } as const;

  const [existing] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(isNull(decks.ownerId), eq(decks.name, deck.name)))
    .limit(1);

  const id = await db.transaction(async (tx) => {
    let deckId: string;
    if (existing) {
      deckId = existing.id;
      await tx.update(decks).set(values).where(eq(decks.id, deckId));
      await tx.delete(deckCards).where(eq(deckCards.deckId, deckId));
    } else {
      const [row] = await tx
        .insert(decks)
        .values({ ownerId: null, name: deck.name, ...values })
        .returning({ id: decks.id });
      deckId = row.id;
    }
    await insertEntries(tx, deckId, entries);
    return deckId;
  });
  return {
    status: existing ? "updated" : "created",
    deckId: id,
    name: deck.name,
    cards: entries.length,
  };
}

/** Visibility rule: public decks are visible to everyone, private ones only to their owner. */
export function canViewDeck(deck: Pick<DeckRow, "isPublic" | "ownerId">, viewerId: string | null): boolean {
  return deck.isPublic || (viewerId !== null && deck.ownerId === viewerId);
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function getDeckRow(deckId: string): Promise<DeckRow | null> {
  if (!isUuid(deckId)) return null;
  const [row] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
  return row ?? null;
}

export async function listUserDecks(ownerId: string): Promise<DeckRow[]> {
  return db.select().from(decks).where(eq(decks.ownerId, ownerId)).orderBy(desc(decks.updatedAt));
}

/** Builds the export input (public codes only) for a deck; cards without a code are omitted. */
export async function buildDeckExport(
  deckId: string,
  viewerId: string | null,
): Promise<{ deck: DeckRow; input: DeckExportInput } | null> {
  const deck = await getDeckRow(deckId);
  if (!deck || !canViewDeck(deck, viewerId)) return null;
  const rows = await db
    .select({
      zone: deckCards.zone,
      qty: deckCards.quantity,
      code: cards.publicCode,
      name: cards.name,
    })
    .from(deckCards)
    .innerJoin(cards, eq(deckCards.cardId, cards.id))
    .where(eq(deckCards.deckId, deckId));
  const order = new Map<string, number>(DECK_ZONES.map((z, i) => [z, i]));
  const list = rows
    .filter((r): r is typeof r & { code: string } => !!r.code)
    .sort((a, b) => order.get(a.zone)! - order.get(b.zone)! || a.code.localeCompare(b.code));
  const legend = list.find((r) => r.zone === "LEGEND")?.code;
  return {
    deck,
    input: {
      name: deck.name,
      description: deck.description ?? undefined,
      source: deck.source,
      eventName: deck.eventName ?? undefined,
      placement: deck.placement ?? undefined,
      legend,
      cards: list.map((r) => ({ code: r.code, qty: r.qty, zone: r.zone as ShareZone, name: r.name })),
    },
  };
}

export async function exportDeckJson(deckId: string, viewerId: string | null) {
  const built = await buildDeckExport(deckId, viewerId);
  if (!built) return null;
  return { filename: slug(built.deck.name), json: toDeckJson(built.input) };
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "deck";
}
