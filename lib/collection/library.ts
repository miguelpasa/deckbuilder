import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { cards, collectionEntries, printings, sets, type Card, type Printing } from "@/lib/db/schema";

export const PAGE_SIZE = 24;

export type CardFilters = {
  q?: string;
  type?: string;
  faction?: string;
  rarity?: string;
  set?: string;
  page?: number;
};

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listCards(f: CardFilters) {
  const conds: SQL[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    conds.push(
      or(ilike(cards.name, like), ilike(cards.publicCode, like), eq(cards.id, q), ilike(cards.subtitle, like))!,
    );
  }
  if (f.type) conds.push(eq(cards.type, f.type));
  if (f.faction) conds.push(eq(cards.faction, f.faction));
  if (f.rarity) conds.push(eq(cards.rarity, f.rarity));
  if (f.set) conds.push(eq(cards.setId, f.set));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, Math.floor(f.page ?? 1));

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(cards).where(where);
  const rows = await db
    .select()
    .from(cards)
    .where(where)
    .orderBy(asc(cards.setId), asc(cards.collectorNumber), asc(cards.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows, total: n, page, pageCount: Math.max(1, Math.ceil(n / PAGE_SIZE)) };
}

async function distinct(col: typeof cards.type | typeof cards.faction | typeof cards.rarity) {
  const rows = await db.selectDistinct({ v: col }).from(cards).orderBy(asc(col));
  return rows.map((r) => r.v).filter((v): v is string => !!v);
}

export async function getFilterOptions() {
  const [types, factions, rarities, setRows] = await Promise.all([
    distinct(cards.type),
    distinct(cards.faction),
    distinct(cards.rarity),
    db.select({ id: sets.id, name: sets.name }).from(sets).orderBy(asc(sets.id)),
  ]);
  return { types, factions, rarities, sets: setRows };
}

export type CardDetail = Card & { setName: string; printings: Printing[] };

/** Looks up by public code (case-insensitive) or Riot card id. */
export async function getCardDetail(codeOrId: string): Promise<CardDetail | null> {
  const key = codeOrId.trim();
  if (!key) return null;
  const [row] = await db
    .select({ card: cards, setName: sets.name })
    .from(cards)
    .innerJoin(sets, eq(cards.setId, sets.id))
    .where(or(sql`upper(${cards.publicCode}) = upper(${key})`, eq(cards.id, key)))
    .limit(1);
  if (!row) return null;
  const prints = await db.select().from(printings).where(eq(printings.cardId, row.card.id)).orderBy(asc(printings.id));
  return { ...row.card, setName: row.setName, printings: prints };
}

export async function getOwnedByPrinting(userId: string, printingIds: number[]): Promise<Map<number, number>> {
  if (printingIds.length === 0) return new Map();
  const rows = await db
    .select({ id: collectionEntries.printingId, q: collectionEntries.quantity })
    .from(collectionEntries)
    .where(and(eq(collectionEntries.userId, userId), inArray(collectionEntries.printingId, printingIds)));
  return new Map(rows.map((r) => [r.id, r.q]));
}
