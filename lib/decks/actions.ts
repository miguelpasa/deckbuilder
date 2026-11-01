"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isAdmin, requireUser } from "@/lib/auth/session";
import { searchCatalog } from "@/lib/cards/catalog";
import { db } from "@/lib/db";
import { decks } from "@/lib/db/schema";
import { parseShareJson } from "@/lib/share/schema";
import { syncCatalog } from "@/lib/riot/sync";
import {
  deleteUserDeck,
  importUserDeckJson,
  saveUserDeck,
  upsertSystemDeck,
  type UpsertSystemResult,
} from "./service";

const uuid = z.string().uuid();

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ---------------------------------------------------------------------------
// User deck actions. The user id always comes from the session.
// ---------------------------------------------------------------------------

export async function saveDeckAction(
  deckId: string | null,
  input: unknown,
): Promise<ActionResult<{ deckId: string }>> {
  const user = await requireUser();
  const id = deckId === null ? null : uuid.safeParse(deckId);
  if (id && !id.success) return { ok: false, error: "Invalid deck id." };
  const res = await saveUserDeck(user.id, input, id?.data);
  if (res.ok) {
    revalidatePath("/decks", "layout");
  }
  return res;
}

export async function deleteDeckAction(deckId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = uuid.safeParse(deckId);
  if (!id.success) return { ok: false, error: "Invalid deck id." };
  const res = await deleteUserDeck(user.id, id.data);
  if (res.ok) revalidatePath("/decks", "layout");
  return res;
}

const importSchema = z.string().min(2).max(500_000);

export async function importDeckAction(
  text: string,
): Promise<ActionResult<{ deckId: string; unknownCodes: string[]; imported: number }>> {
  const user = await requireUser();
  const parsed = importSchema.safeParse(text);
  if (!parsed.success) return { ok: false, error: "Paste or upload a deck JSON file." };
  const res = await importUserDeckJson(user.id, parsed.data);
  if (res.ok) revalidatePath("/decks", "layout");
  return res;
}

export interface CardSearchHit {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  faction: string | null;
  rarity: string | null;
  tags: string[];
}

export async function searchCardsAction(query: string): Promise<CardSearchHit[]> {
  await requireUser();
  const q = z.string().trim().min(1).max(100).safeParse(query);
  if (!q.success) return [];
  const rows = searchCatalog(q.data, 24);
  return rows.map((c) => ({
    id: c.id,
    code: c.publicCode,
    name: c.name,
    type: c.type,
    faction: c.faction,
    rarity: c.rarity,
    tags: c.tags,
  }));
}

// ---------------------------------------------------------------------------
// Admin actions. Gated by ADMIN_EMAILS in addition to the proxy.
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) throw new Error("Forbidden");
  return user;
}

const flagsSchema = z.object({
  isFeatured: z.boolean().optional(),
  source: z.enum(["META", "USER"]).optional(),
});

export async function setDeckFlagsAction(deckId: string, flags: unknown): Promise<ActionResult> {
  await requireAdmin();
  const id = uuid.safeParse(deckId);
  const f = flagsSchema.safeParse(flags);
  if (!id.success || !f.success) return { ok: false, error: "Invalid input." };
  const patch = { ...f.data, updatedAt: new Date() };
  await db.update(decks).set(patch).where(eq(decks.id, id.data));
  revalidatePath("/admin");
  revalidatePath("/decks", "layout");
  return { ok: true };
}

export async function importMetaDeckAction(
  text: string,
): Promise<ActionResult<{ result: UpsertSystemResult }>> {
  await requireAdmin();
  const t = importSchema.safeParse(text);
  if (!t.success) return { ok: false, error: "Paste a deck JSON file." };
  const parsed = parseShareJson(t.data);
  if (!parsed.ok) return { ok: false, error: parsed.errors.join("; ") };
  if (parsed.kind !== "deck") return { ok: false, error: "This is a collection file, not a deck." };
  const result = await upsertSystemDeck(parsed.data, { source: "META", isFeatured: true });
  revalidatePath("/admin");
  revalidatePath("/decks", "layout");
  return { ok: true, result };
}

export type SyncActionResult =
  | { ok: true; summary: { runId: number; sets: number; cards: number; printings: number } }
  | { ok: false; errorName: string; status: number | null; message: string };

export async function syncCatalogAction(): Promise<SyncActionResult> {
  await requireAdmin();
  try {
    const s = await syncCatalog();
    revalidatePath("/admin");
    return { ok: true, summary: { runId: s.runId, sets: s.sets, cards: s.cards, printings: s.printings } };
  } catch (err) {
    revalidatePath("/admin");
    const e = err as { name?: string; status?: number; message?: string };
    return {
      ok: false,
      errorName: e.name ?? "Error",
      status: e.status ?? null,
      message: e.message ?? "Sync failed",
    };
  }
}
