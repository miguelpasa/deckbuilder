import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cards, collectionEntries, printings, sets } from "@/lib/db/schema";
import { getCardIdsByCodes } from "@/lib/data/queries";
import { findCards } from "@/lib/cards/search";
import { parseBulk } from "@/lib/collection/bulk-parse";
import type { CollectionRow, ImportPreview, PreviewRow, Variant } from "@/lib/collection/types";
import { parseShareJson, resolveCodes, toCollectionJson } from "@/lib/share/schema";

export const MAX_QTY = 9999;
export const MAX_BULK_LINES = 500;

export type AddItem = { printingId: number; qty: number };

function clamp(n: number): number {
  return Math.min(MAX_QTY, Math.max(0, Math.floor(n)));
}

function aggregate(items: AddItem[]): AddItem[] {
  const m = new Map<number, number>();
  for (const i of items) m.set(i.printingId, (m.get(i.printingId) ?? 0) + i.qty);
  return [...m].map(([printingId, qty]) => ({ printingId, qty: Math.min(qty, MAX_QTY) }));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function addInTx(tx: Tx, userId: string, items: AddItem[]) {
  const agg = aggregate(items).filter((i) => i.qty > 0);
  for (let i = 0; i < agg.length; i += 500) {
    const chunk = agg.slice(i, i + 500);
    await tx
      .insert(collectionEntries)
      .values(chunk.map((c) => ({ userId, printingId: c.printingId, quantity: c.qty })))
      .onConflictDoUpdate({
        target: [collectionEntries.userId, collectionEntries.printingId],
        set: {
          quantity: sql`least(${MAX_QTY}, ${collectionEntries.quantity} + excluded.quantity)`,
          updatedAt: sql`now()`,
        },
      });
  }
}

async function assertPrintingsExist(ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const rows = await db.select({ id: printings.id }).from(printings).where(inArray(printings.id, unique));
  if (rows.length !== unique.length) throw new Error("Unknown printing.");
}

export async function getQuantity(userId: string, printingId: number): Promise<number> {
  const [row] = await db
    .select({ q: collectionEntries.quantity })
    .from(collectionEntries)
    .where(and(eq(collectionEntries.userId, userId), eq(collectionEntries.printingId, printingId)));
  return row?.q ?? 0;
}

export async function setQuantityFor(userId: string, printingId: number, qty: number): Promise<number> {
  const q = clamp(qty);
  await assertPrintingsExist([printingId]);
  if (q === 0) {
    await db
      .delete(collectionEntries)
      .where(and(eq(collectionEntries.userId, userId), eq(collectionEntries.printingId, printingId)));
    return 0;
  }
  await db
    .insert(collectionEntries)
    .values({ userId, printingId, quantity: q })
    .onConflictDoUpdate({
      target: [collectionEntries.userId, collectionEntries.printingId],
      set: { quantity: q, updatedAt: sql`now()` },
    });
  return q;
}

export async function adjustQuantityFor(userId: string, printingId: number, delta: number): Promise<number> {
  await assertPrintingsExist([printingId]);
  if (delta > 0) {
    await db.transaction((tx) => addInTx(tx, userId, [{ printingId, qty: Math.floor(delta) }]));
  } else if (delta < 0) {
    await db
      .update(collectionEntries)
      .set({
        quantity: sql`greatest(0, ${collectionEntries.quantity} - ${Math.floor(-delta)})`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(collectionEntries.userId, userId), eq(collectionEntries.printingId, printingId)));
  }
  const q = await getQuantity(userId, printingId);
  if (q === 0) {
    await db
      .delete(collectionEntries)
      .where(and(eq(collectionEntries.userId, userId), eq(collectionEntries.printingId, printingId)));
  }
  return q;
}

/** Adds all items in one transaction (quantities are added to existing ones). */
export async function bulkAddFor(userId: string, items: AddItem[]): Promise<{ lines: number; copies: number }> {
  const agg = aggregate(items);
  await assertPrintingsExist(agg.map((i) => i.printingId));
  await db.transaction((tx) => addInTx(tx, userId, agg));
  return { lines: agg.length, copies: agg.reduce((s, i) => s + i.qty, 0) };
}

export async function getCollectionRows(userId: string): Promise<CollectionRow[]> {
  return db
    .select({
      printingId: printings.id,
      variant: printings.variant,
      quantity: collectionEntries.quantity,
      cardId: cards.id,
      code: cards.publicCode,
      name: cards.name,
      type: cards.type,
      faction: cards.faction,
      rarity: cards.rarity,
      setId: cards.setId,
      setName: sets.name,
      thumbnailUrl: cards.thumbnailUrl,
      isPlaceholder: cards.isPlaceholder,
    })
    .from(collectionEntries)
    .innerJoin(printings, eq(collectionEntries.printingId, printings.id))
    .innerJoin(cards, eq(printings.cardId, cards.id))
    .innerJoin(sets, eq(cards.setId, sets.id))
    .where(and(eq(collectionEntries.userId, userId), sql`${collectionEntries.quantity} > 0`))
    .orderBy(asc(cards.setId), asc(cards.collectorNumber), asc(printings.variant));
}

export async function exportCollectionJson(userId: string): Promise<string> {
  const rows = await getCollectionRows(userId);
  return toCollectionJson(
    rows.filter((r) => r.code).map((r) => ({ code: r.code!, variant: r.variant, qty: r.quantity })),
    { exportedAt: new Date() },
  );
}

async function printingMap(cardIds: string[]): Promise<Map<string, number>> {
  if (cardIds.length === 0) return new Map();
  const rows = await db.select().from(printings).where(inArray(printings.cardId, cardIds));
  return new Map(rows.map((p) => [`${p.cardId}|${p.variant}`, p.id]));
}

export async function previewBulkFor(text: string): Promise<{ rows: PreviewRow[]; truncated: boolean }> {
  const parsed = parseBulk(text);
  const truncated = parsed.items.length > MAX_BULK_LINES;
  const items = parsed.items.slice(0, MAX_BULK_LINES);

  const codeMap = await getCardIdsByCodes([...new Set(items.filter((i) => i.isCode).map((i) => i.codeOrName))]);
  const nameCache = new Map<string, Awaited<ReturnType<typeof findCards>>>();
  for (const i of items) {
    const key = i.codeOrName.toLowerCase();
    if (!i.isCode && !nameCache.has(key)) nameCache.set(key, await findCards(i.codeOrName, 5));
  }

  type Resolved = { cardId: string; warning?: string };
  const resolved = new Map<number, Resolved>();
  const failures = new Map<number, string>();
  const cardInfo = new Map<string, { name: string; code: string | null }>();
  for (const i of items) {
    if (i.isCode) {
      const id = codeMap.get(i.codeOrName);
      if (!id) failures.set(i.lineNo, `Unknown card code ${i.codeOrName}.`);
      else resolved.set(i.lineNo, { cardId: id });
    } else {
      const hits = nameCache.get(i.codeOrName.toLowerCase()) ?? [];
      if (hits.length === 0) {
        failures.set(i.lineNo, `No card found matching "${i.codeOrName}".`);
        continue;
      }
      const top = hits[0];
      const exact = top.name.toLowerCase() === i.codeOrName.toLowerCase();
      const sameName = hits.filter((h) => h.name.toLowerCase() === top.name.toLowerCase()).length > 1;
      let warning: string | undefined;
      if (!exact) {
        warning = `Matched "${top.name}"${top.publicCode ? ` (${top.publicCode})` : ""} from ${hits.length} possible ${hits.length === 1 ? "match" : "matches"}; check it is the right card.`;
      } else if (sameName) {
        warning = `Several cards are named "${top.name}"; using ${top.publicCode ?? top.id}. Use the card code to be exact.`;
      }
      resolved.set(i.lineNo, { cardId: top.id, warning });
      cardInfo.set(top.id, { name: top.name, code: top.publicCode });
    }
  }
  const missing = [...new Set([...resolved.values()].map((r) => r.cardId))].filter((id) => !cardInfo.has(id));
  if (missing.length) {
    const rows = await db
      .select({ id: cards.id, name: cards.name, code: cards.publicCode })
      .from(cards)
      .where(inArray(cards.id, missing));
    for (const r of rows) cardInfo.set(r.id, { name: r.name, code: r.code });
  }
  const pmap = await printingMap([...new Set([...resolved.values()].map((r) => r.cardId))]);

  const out: PreviewRow[] = parsed.errors.map((e) => ({
    lineNo: e.lineNo,
    raw: e.raw,
    status: "error" as const,
    qty: 0,
    variant: "NORMAL" as Variant,
    message: e.error,
  }));
  for (const i of items) {
    const base = { lineNo: i.lineNo, raw: i.raw, qty: i.qty, variant: i.variant };
    const fail = failures.get(i.lineNo);
    if (fail) {
      out.push({ ...base, status: "error", message: fail });
      continue;
    }
    const r = resolved.get(i.lineNo)!;
    const info = cardInfo.get(r.cardId);
    const printingId = pmap.get(`${r.cardId}|${i.variant}`);
    if (printingId === undefined) {
      out.push({
        ...base,
        status: "error",
        cardName: info?.name,
        code: info?.code,
        message: `${info?.name ?? r.cardId} has no ${i.variant} printing.`,
      });
      continue;
    }
    out.push({ ...base, status: "ok", printingId, cardName: info?.name, code: info?.code, warning: r.warning });
  }
  out.sort((a, b) => a.lineNo - b.lineNo);
  return { rows: out, truncated };
}

type ResolvedImport =
  | { ok: false; errors: string[] }
  | { ok: true; items: AddItem[]; preview: ImportPreview };

export async function resolveImport(json: string): Promise<ResolvedImport> {
  const parsed = parseShareJson(json);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  if (parsed.kind !== "collection") return { ok: false, errors: ["This is a deck file, not a collection file."] };
  const data = parsed.data;
  const codeMap = await getCardIdsByCodes([...new Set(data.cards.map((c) => c.code))]);
  const { resolved, unknownCodes } = resolveCodes(data.cards, codeMap);
  const pmap = await printingMap([...new Set(resolved.map((r) => r.cardId))]);
  const items: AddItem[] = [];
  const missingPrintings: { code: string; variant: Variant }[] = [];
  for (const r of resolved) {
    const pid = pmap.get(`${r.cardId}|${r.variant}`);
    if (pid === undefined) missingPrintings.push({ code: r.code, variant: r.variant });
    else items.push({ printingId: pid, qty: r.qty });
  }
  const agg = aggregate(items);
  return {
    ok: true,
    items: agg,
    preview: {
      totalLines: data.cards.length,
      resolvedCount: agg.length,
      resolvedQty: agg.reduce((s, i) => s + i.qty, 0),
      unknownCodes,
      missingPrintings,
    },
  };
}

export async function importCollectionFor(
  userId: string,
  json: string,
  mode: "merge" | "replace",
): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  const r = await resolveImport(json);
  if (!r.ok) return { ok: false, error: r.errors.slice(0, 5).join(" ") };
  if (r.items.length === 0) {
    return { ok: false, error: "Nothing to import: no cards in the file match known printings." };
  }
  await db.transaction(async (tx) => {
    if (mode === "replace") await tx.delete(collectionEntries).where(eq(collectionEntries.userId, userId));
    await addInTx(tx, userId, r.items);
  });
  return { ok: true, preview: r.preview };
}
