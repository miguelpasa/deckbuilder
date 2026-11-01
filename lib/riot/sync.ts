import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cards, printings, sets, syncRuns } from "@/lib/db/schema";
import { fetchRiotContent } from "./client";
import { derivePublicCode, type RiotCard, type RiotContent } from "./schema";

export interface SyncOptions {
  /** Pre-loaded content (e.g. the placeholder fixture). Skips the network. */
  content?: RiotContent;
  /** Marks upserted cards as development placeholders. */
  placeholder?: boolean;
}

export interface SyncSummary {
  runId: number;
  sets: number;
  cards: number;
  printings: number;
  placeholder: boolean;
}

const CHUNK = 500;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Fetches (or takes) the catalog and upserts sets, cards and NORMAL+FOIL
 * printings in one transaction. Idempotent. Never deletes anything, so cards
 * referenced by collections/decks are always safe.
 */
export async function syncCatalog(options: SyncOptions = {}): Promise<SyncSummary> {
  const placeholder = options.placeholder ?? false;
  const [run] = await db.insert(syncRuns).values({ status: "running" }).returning({ id: syncRuns.id });

  try {
    const content = options.content ?? (await fetchRiotContent());
    const now = new Date();

    const setRows = content.sets.map((s) => ({ id: s.id, name: s.name, raw: s.raw, updatedAt: now }));
    const cardMap = new Map<string, typeof cards.$inferInsert>();
    for (const s of content.sets) {
      for (const c of s.cards as RiotCard[]) {
        cardMap.set(c.id, {
          id: c.id,
          setId: s.id,
          collectorNumber: c.collectorNumber,
          publicCode: derivePublicCode(s.id, c.collectorNumber),
          name: c.name,
          subtitle: c.subtitle,
          type: c.type,
          rarity: c.rarity,
          faction: c.faction,
          description: c.description,
          effect: c.effect,
          flavorText: c.flavorText,
          tags: c.tags,
          energy: c.energy,
          might: c.might,
          cost: c.cost,
          power: c.power,
          thumbnailUrl: c.thumbnailUrl,
          fullUrl: c.fullUrl,
          artist: c.artist,
          isPlaceholder: placeholder,
          raw: c.raw,
          updatedAt: now,
        });
      }
    }
    const cardRows = [...cardMap.values()];

    const printingCount = await db.transaction(async (tx) => {
      for (const part of chunks(setRows)) {
        await tx
          .insert(sets)
          .values(part)
          .onConflictDoUpdate({
            target: sets.id,
            set: { name: sql`excluded.name`, raw: sql`excluded.raw`, updatedAt: sql`excluded.updated_at` },
          });
      }

      for (const part of chunks(cardRows)) {
        await tx
          .insert(cards)
          .values(part)
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              setId: sql`excluded.set_id`,
              collectorNumber: sql`excluded.collector_number`,
              publicCode: sql`excluded.public_code`,
              name: sql`excluded.name`,
              subtitle: sql`excluded.subtitle`,
              type: sql`excluded.type`,
              rarity: sql`excluded.rarity`,
              faction: sql`excluded.faction`,
              description: sql`excluded.description`,
              effect: sql`excluded.effect`,
              flavorText: sql`excluded.flavor_text`,
              tags: sql`excluded.tags`,
              energy: sql`excluded.energy`,
              might: sql`excluded.might`,
              cost: sql`excluded.cost`,
              power: sql`excluded.power`,
              thumbnailUrl: sql`excluded.thumbnail_url`,
              fullUrl: sql`excluded.full_url`,
              artist: sql`excluded.artist`,
              isPlaceholder: sql`excluded.is_placeholder`,
              raw: sql`excluded.raw`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      const printingRows = cardRows.flatMap((c) => [
        { cardId: c.id, variant: "NORMAL" as const },
        { cardId: c.id, variant: "FOIL" as const },
      ]);
      for (const part of chunks(printingRows)) {
        await tx.insert(printings).values(part).onConflictDoNothing();
      }
      return printingRows.length;
    });

    await db
      .update(syncRuns)
      .set({ status: "success", finishedAt: new Date(), cardCount: cardRows.length })
      .where(eq(syncRuns.id, run.id));

    return {
      runId: run.id,
      sets: setRows.length,
      cards: cardRows.length,
      printings: printingCount,
      placeholder,
    };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await db
      .update(syncRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 2000) })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}
