import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  cards,
  collectionEntries,
  follows,
  importedCollections,
  importedEntries,
  printings,
  profiles,
} from "@/lib/db/schema";
import { getCardIdsByCodes, getProfileByShareToken, newShareToken } from "@/lib/data/queries";
import { parseShareJson, resolveCodes, type ShareVariant } from "@/lib/share/schema";

/**
 * Plain, HTTP-free social logic. Server Actions in ./actions.ts wrap these with
 * session + zod validation; the smoke script calls them directly.
 */

export type Visibility = "PRIVATE" | "LINK" | "PUBLIC";
export type ServiceResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const MAX_IMPORT_JSON_CHARS = 2_000_000;
export const MAX_IMPORTS_PER_USER = 20;
const NOT_FOUND = "No shareable collection found for that link.";

/** Accepts a full share URL (".../share/<token>[/...]") or a bare token. */
export function parseTokenInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = /\/share\/([A-Za-z0-9_-]+)/.exec(s);
  const token = m ? m[1] : s;
  return /^[A-Za-z0-9_-]{8,64}$/.test(token) ? token : null;
}

export async function setVisibility(userId: string, visibility: Visibility): Promise<ServiceResult> {
  const rows = await db
    .update(profiles)
    .set({ collectionVisibility: visibility })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  return rows.length ? { ok: true } : { ok: false, error: "Profile not found." };
}

export async function rotateShareToken(userId: string): Promise<ServiceResult<{ token: string }>> {
  const token = newShareToken();
  const rows = await db
    .update(profiles)
    .set({ shareToken: token })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  return rows.length ? { ok: true, token } : { ok: false, error: "Profile not found." };
}

export async function followByToken(userId: string, tokenInput: string): Promise<ServiceResult<{ name: string }>> {
  const token = parseTokenInput(tokenInput);
  if (!token) return { ok: false, error: "That doesn't look like a share link or token." };
  const target = await getProfileByShareToken(token);
  if (target && target.userId === userId) return { ok: false, error: "You can't follow yourself." };
  if (!target || target.collectionVisibility === "PRIVATE") return { ok: false, error: NOT_FOUND };
  await db.insert(follows).values({ followerId: userId, followeeId: target.userId }).onConflictDoNothing();
  return { ok: true, name: target.displayName ?? "Friend" };
}

export async function unfollow(userId: string, followeeId: string): Promise<ServiceResult> {
  await db.delete(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, followeeId)));
  return { ok: true };
}

export async function isFollowing(userId: string, followeeId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followeeId, followeeId)));
  return (row?.n ?? 0) > 0;
}

export type FriendRow = {
  userId: string;
  name: string;
  shareToken: string | null;
  visibility: Visibility;
  cardCount: number;
};

export async function listFollowing(userId: string): Promise<FriendRow[]> {
  const rows = await db
    .select({
      userId: profiles.userId,
      name: profiles.displayName,
      shareToken: profiles.shareToken,
      visibility: profiles.collectionVisibility,
    })
    .from(follows)
    .innerJoin(profiles, eq(follows.followeeId, profiles.userId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt));
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      userId: collectionEntries.userId,
      total: sql<number>`coalesce(sum(${collectionEntries.quantity}), 0)::int`,
    })
    .from(collectionEntries)
    .where(
      inArray(
        collectionEntries.userId,
        rows.map((r) => r.userId),
      ),
    )
    .groupBy(collectionEntries.userId);
  const byUser = new Map(counts.map((c) => [c.userId, c.total]));
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name ?? "Friend",
    shareToken: r.shareToken,
    visibility: r.visibility,
    // Private collections aren't visible to followers.
    cardCount: r.visibility === "PRIVATE" ? 0 : (byUser.get(r.userId) ?? 0),
  }));
}

export async function countFollowers(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, userId));
  return row?.n ?? 0;
}

export type SharedCollection = {
  profile: { userId: string; displayName: string; visibility: Visibility };
  entries: { code: string; name: string; variant: ShareVariant; qty: number }[];
  totalCards: number;
};

/** Returns null (indistinguishable) for unknown tokens and PRIVATE collections. */
export async function getSharedCollection(token: string): Promise<SharedCollection | null> {
  if (!parseTokenInput(token)) return null;
  const profile = await getProfileByShareToken(token);
  if (!profile || profile.collectionVisibility === "PRIVATE") return null;
  const rows = await db
    .select({
      code: cards.publicCode,
      name: cards.name,
      variant: printings.variant,
      qty: collectionEntries.quantity,
    })
    .from(collectionEntries)
    .innerJoin(printings, eq(collectionEntries.printingId, printings.id))
    .innerJoin(cards, eq(printings.cardId, cards.id))
    .where(eq(collectionEntries.userId, profile.userId));
  const entries = rows
    .filter((r): r is typeof r & { code: string } => !!r.code && r.qty > 0)
    .sort((a, b) => a.code.localeCompare(b.code) || a.variant.localeCompare(b.variant));
  return {
    profile: {
      userId: profile.userId,
      displayName: profile.displayName ?? "A Riftbound player",
      visibility: profile.collectionVisibility,
    },
    entries,
    totalCards: entries.reduce((a, e) => a + e.qty, 0),
  };
}

// ---- Imported snapshots -------------------------------------------------

export type ImportPreview = {
  cardCount: number;
  distinctCards: number;
  unknownCodes: string[];
  owner?: string;
};

async function prepareImport(json: string) {
  if (json.length > MAX_IMPORT_JSON_CHARS) return { ok: false as const, error: "That file is too large." };
  const parsed = parseShareJson(json);
  if (!parsed.ok) return { ok: false as const, error: parsed.errors.slice(0, 5).join("; ") };
  if (parsed.kind !== "collection") return { ok: false as const, error: "This is a deck file, not a collection." };
  const codes = [...new Set(parsed.data.cards.map((c) => c.code))];
  const map = await getCardIdsByCodes(codes);
  const { resolved, unknownCodes } = resolveCodes(parsed.data.cards, map);
  // Merge duplicates on (cardId, variant) since that's the primary key.
  const merged = new Map<string, { cardId: string; variant: ShareVariant; quantity: number }>();
  for (const r of resolved) {
    const key = `${r.cardId}|${r.variant}`;
    const cur = merged.get(key);
    if (cur) cur.quantity += r.qty;
    else merged.set(key, { cardId: r.cardId, variant: r.variant, quantity: r.qty });
  }
  const rows = [...merged.values()];
  const preview: ImportPreview = {
    cardCount: rows.reduce((a, r) => a + r.quantity, 0),
    distinctCards: new Set(rows.map((r) => r.cardId)).size,
    unknownCodes,
    owner: parsed.data.owner,
  };
  return { ok: true as const, rows, preview };
}

export async function previewImportedCollection(json: string): Promise<ServiceResult<{ preview: ImportPreview }>> {
  const p = await prepareImport(json);
  return p.ok ? { ok: true, preview: p.preview } : p;
}

export async function saveImportedCollection(
  userId: string,
  input: { label: string; json: string; replaceId?: string },
): Promise<ServiceResult<{ id: string; preview: ImportPreview }>> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give the snapshot a label." };
  const p = await prepareImport(input.json);
  if (!p.ok) return p;

  if (input.replaceId) {
    const [existing] = await db
      .select({ id: importedCollections.id })
      .from(importedCollections)
      .where(and(eq(importedCollections.id, input.replaceId), eq(importedCollections.ownerId, userId)));
    if (!existing) return { ok: false, error: "Snapshot not found." };
  } else {
    const [row] = await db
      .select({ n: count() })
      .from(importedCollections)
      .where(eq(importedCollections.ownerId, userId));
    if ((row?.n ?? 0) >= MAX_IMPORTS_PER_USER) {
      return { ok: false, error: `You can keep at most ${MAX_IMPORTS_PER_USER} snapshots.` };
    }
  }

  const id = await db.transaction(async (tx) => {
    let collectionId = input.replaceId;
    if (collectionId) {
      await tx.delete(importedEntries).where(eq(importedEntries.importedCollectionId, collectionId));
      await tx
        .update(importedCollections)
        .set({ label, importedAt: new Date() })
        .where(and(eq(importedCollections.id, collectionId), eq(importedCollections.ownerId, userId)));
    } else {
      const [created] = await tx
        .insert(importedCollections)
        .values({ ownerId: userId, label })
        .returning({ id: importedCollections.id });
      collectionId = created.id;
    }
    const target = collectionId;
    for (let i = 0; i < p.rows.length; i += 500) {
      await tx
        .insert(importedEntries)
        .values(p.rows.slice(i, i + 500).map((r) => ({ importedCollectionId: target, ...r })));
    }
    return target;
  });
  return { ok: true, id, preview: p.preview };
}

export async function renameImportedCollection(userId: string, id: string, label: string): Promise<ServiceResult> {
  const next = label.trim();
  if (!next) return { ok: false, error: "Label can't be empty." };
  const rows = await db
    .update(importedCollections)
    .set({ label: next })
    .where(and(eq(importedCollections.id, id), eq(importedCollections.ownerId, userId)))
    .returning({ id: importedCollections.id });
  return rows.length ? { ok: true } : { ok: false, error: "Snapshot not found." };
}

export async function deleteImportedCollection(userId: string, id: string): Promise<ServiceResult> {
  const rows = await db
    .delete(importedCollections)
    .where(and(eq(importedCollections.id, id), eq(importedCollections.ownerId, userId)))
    .returning({ id: importedCollections.id });
  return rows.length ? { ok: true } : { ok: false, error: "Snapshot not found." };
}

export type ImportedRow = { id: string; label: string; importedAt: Date; cardCount: number };

export async function listImportedCollections(userId: string): Promise<ImportedRow[]> {
  return db
    .select({
      id: importedCollections.id,
      label: importedCollections.label,
      importedAt: importedCollections.importedAt,
      cardCount: sql<number>`coalesce(sum(${importedEntries.quantity}), 0)::int`,
    })
    .from(importedCollections)
    .leftJoin(importedEntries, eq(importedEntries.importedCollectionId, importedCollections.id))
    .where(eq(importedCollections.ownerId, userId))
    .groupBy(importedCollections.id)
    .orderBy(desc(importedCollections.importedAt));
}
