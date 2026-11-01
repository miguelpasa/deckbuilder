import { eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, printings, type Card, type Printing } from "@/lib/db/schema";
import { classifyQuery } from "./query";

export { classifyQuery, normalisePublicCode, type QueryKind } from "./query";

export type CardWithPrintings = Card & { printings: Printing[] };

async function attachPrintings(rows: Card[]): Promise<CardWithPrintings[]> {
  if (rows.length === 0) return [];
  const prints = await db
    .select()
    .from(printings)
    .where(
      inArray(
        printings.cardId,
        rows.map((r) => r.id),
      ),
    );
  const byCard = new Map<string, Printing[]>();
  for (const p of prints) {
    const list = byCard.get(p.cardId) ?? [];
    list.push(p);
    byCard.set(p.cardId, list);
  }
  return rows.map((r) => ({ ...r, printings: byCard.get(r.id) ?? [] }));
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function findCards(query: string, limit = 20): Promise<CardWithPrintings[]> {
  const q = query.trim();
  if (!q) return [];
  const max = Math.min(Math.max(1, Math.floor(limit)), 100);
  const { kind, value } = classifyQuery(q);

  if (kind === "publicCode") {
    const rows = await db.select().from(cards).where(eq(cards.publicCode, value)).limit(max);
    if (rows.length > 0) return attachPrintings(rows);
  }

  const byId = await db.select().from(cards).where(eq(cards.id, q)).limit(1);
  if (byId.length > 0) return attachPrintings(byId);

  const similarity = sql<number>`similarity(${cards.name}, ${q})`;
  const rows = await db
    .select()
    .from(cards)
    .where(sql`${cards.name} % ${q} OR ${ilike(cards.name, `%${escapeLike(q)}%`)}`)
    .orderBy(sql`${similarity} DESC`, cards.name)
    .limit(max);
  return attachPrintings(rows);
}
