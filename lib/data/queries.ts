import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne, sql, type SQL } from "drizzle-orm";

import type { CurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  cards,
  collectionEntries,
  deckCards,
  decks,
  follows,
  importedCollections,
  importedEntries,
  printings,
  profiles,
} from "@/lib/db/schema";
import { aggregateOwnership, type BorrowSource } from "@/lib/decks/completeness";
import type { DeckEntry, OwnedQtyByCardId } from "@/lib/decks/types";

export type Profile = typeof profiles.$inferSelect;

export function newShareToken(): string {
  return randomBytes(12).toString("base64url");
}

/** Creates the profile row on first use; keeps displayName in sync with the auth user. */
export async function ensureProfile(user: CurrentUser): Promise<Profile> {
  const [row] = await db
    .insert(profiles)
    .values({ userId: user.id, displayName: user.name || null, shareToken: newShareToken() })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: { displayName: sql`coalesce(${profiles.displayName}, excluded.display_name)` },
    })
    .returning();
  return row;
}

export async function getProfileByShareToken(token: string): Promise<Profile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.shareToken, token)).limit(1);
  return row ?? null;
}

/** Owned copies per card id for a user, summed across printings. */
export async function getOwnedQtyByCardId(userId: string): Promise<OwnedQtyByCardId> {
  const rows = await db
    .select({
      cardId: printings.cardId,
      variant: printings.variant,
      quantity: collectionEntries.quantity,
    })
    .from(collectionEntries)
    .innerJoin(printings, eq(collectionEntries.printingId, printings.id))
    .where(eq(collectionEntries.userId, userId));
  return aggregateOwnership(rows);
}

/**
 * Everyone a user can borrow from: followed users whose collection isn't private,
 * plus the user's own imported JSON snapshots.
 */
export async function getBorrowSources(userId: string): Promise<BorrowSource[]> {
  const followed = await db
    .select({ id: profiles.userId, name: profiles.displayName })
    .from(follows)
    .innerJoin(profiles, eq(follows.followeeId, profiles.userId))
    .where(and(eq(follows.followerId, userId), ne(profiles.collectionVisibility, "PRIVATE")));

  const sources: BorrowSource[] = [];
  if (followed.length > 0) {
    const rows = await db
      .select({
        userId: collectionEntries.userId,
        cardId: printings.cardId,
        quantity: collectionEntries.quantity,
      })
      .from(collectionEntries)
      .innerJoin(printings, eq(collectionEntries.printingId, printings.id))
      .where(inArray(collectionEntries.userId, followed.map((f) => f.id)));
    for (const f of followed) {
      sources.push({
        sourceId: `follow:${f.id}`,
        label: f.name ?? "Friend",
        kind: "FOLLOW",
        ownedQtyByCardId: aggregateOwnership(rows.filter((r) => r.userId === f.id)),
      });
    }
  }

  const imports = await db
    .select({
      id: importedCollections.id,
      label: importedCollections.label,
      cardId: importedEntries.cardId,
      quantity: importedEntries.quantity,
    })
    .from(importedCollections)
    .leftJoin(importedEntries, eq(importedEntries.importedCollectionId, importedCollections.id))
    .where(eq(importedCollections.ownerId, userId));
  const byImport = new Map<string, { label: string; rows: { cardId: string; quantity: number }[] }>();
  for (const r of imports) {
    const group = byImport.get(r.id) ?? { label: r.label, rows: [] };
    if (r.cardId) group.rows.push({ cardId: r.cardId, quantity: r.quantity ?? 0 });
    byImport.set(r.id, group);
  }
  for (const [id, g] of byImport) {
    sources.push({
      sourceId: `import:${id}`,
      label: g.label,
      kind: "IMPORT",
      ownedQtyByCardId: aggregateOwnership(g.rows),
    });
  }
  return sources;
}

export type DeckWithEntries = typeof decks.$inferSelect & { entries: DeckEntry[] };

/** Loads decks and their entries in two queries. */
export async function loadDecks(where?: SQL): Promise<DeckWithEntries[]> {
  const deckRows = where ? await db.select().from(decks).where(where) : await db.select().from(decks);
  if (deckRows.length === 0) return [];
  const entryRows = await db
    .select()
    .from(deckCards)
    .where(inArray(deckCards.deckId, deckRows.map((d) => d.id)));
  return deckRows.map((d) => ({
    ...d,
    entries: entryRows
      .filter((e) => e.deckId === d.id)
      .map((e) => ({ cardId: e.cardId, zone: e.zone, quantity: e.quantity })),
  }));
}

/** Card rows by id, for rendering decklists and running validateDeck. */
export async function getCardsByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, typeof cards.$inferSelect>();
  const rows = await db.select().from(cards).where(inArray(cards.id, ids));
  return new Map(rows.map((c) => [c.id, c]));
}

/** public code (e.g. OGN-042) -> card id, for resolving share JSON. */
export async function getCardIdsByCodes(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .select({ id: cards.id, code: cards.publicCode })
    .from(cards)
    .where(inArray(cards.publicCode, codes));
  return new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.id]));
}
