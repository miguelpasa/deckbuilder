"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/data/queries";
import {
  adjustQuantityFor,
  bulkAddFor,
  importCollectionFor,
  MAX_BULK_LINES,
  MAX_QTY,
  previewBulkFor,
  resolveImport,
  setQuantityFor,
} from "@/lib/collection/service";
import type { ActionResult, ImportPreview, PreviewRow } from "@/lib/collection/types";

const printingId = z.number().int().positive();
const qty = z.number().int().min(0).max(MAX_QTY);
const MAX_TEXT = 200_000;

async function authed() {
  const user = await getCurrentUser();
  if (!user) return null;
  await ensureProfile(user);
  return user;
}

function refresh() {
  revalidatePath("/collection");
  revalidatePath("/cards", "layout");
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

export async function setQuantity(id: number, quantity: number): Promise<ActionResult<{ quantity: number }>> {
  try {
    const input = z.object({ id: printingId, quantity: qty }).parse({ id, quantity });
    const user = await authed();
    if (!user) return { ok: false, error: "Sign in to edit your collection." };
    const q = await setQuantityFor(user.id, input.id, input.quantity);
    refresh();
    return { ok: true, quantity: q };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustQuantity(id: number, delta: number): Promise<ActionResult<{ quantity: number }>> {
  try {
    const input = z
      .object({ id: printingId, delta: z.number().int().min(-MAX_QTY).max(MAX_QTY) })
      .parse({ id, delta });
    const user = await authed();
    if (!user) return { ok: false, error: "Sign in to edit your collection." };
    const q = await adjustQuantityFor(user.id, input.id, input.delta);
    refresh();
    return { ok: true, quantity: q };
  } catch (e) {
    return fail(e);
  }
}

const itemsSchema = z
  .array(z.object({ printingId, qty: z.number().int().min(1).max(MAX_QTY) }))
  .min(1, "Nothing to add.")
  .max(MAX_BULK_LINES, `At most ${MAX_BULK_LINES} lines at once.`);

export async function bulkAdd(
  items: { printingId: number; qty: number }[],
): Promise<ActionResult<{ lines: number; copies: number }>> {
  try {
    const parsed = itemsSchema.parse(items);
    const user = await authed();
    if (!user) return { ok: false, error: "Sign in to edit your collection." };
    const r = await bulkAddFor(user.id, parsed);
    refresh();
    return { ok: true, ...r };
  } catch (e) {
    return fail(e);
  }
}

const textSchema = z.string().max(MAX_TEXT, "Input is too large.");

export async function previewBulk(
  text: string,
): Promise<ActionResult<{ rows: PreviewRow[]; truncated: boolean }>> {
  try {
    const t = textSchema.parse(text);
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sign in first." };
    return { ok: true, ...(await previewBulkFor(t)) };
  } catch (e) {
    return fail(e);
  }
}

export async function previewImport(json: string): Promise<ActionResult<{ preview: ImportPreview }>> {
  try {
    const t = textSchema.parse(json);
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sign in first." };
    const r = await resolveImport(t);
    if (!r.ok) return { ok: false, error: r.errors.slice(0, 5).join(" ") };
    return { ok: true, preview: r.preview };
  } catch (e) {
    return fail(e);
  }
}

export async function importCollection(
  json: string,
  mode: "merge" | "replace",
): Promise<ActionResult<{ preview: ImportPreview }>> {
  try {
    const input = z.object({ json: textSchema, mode: z.enum(["merge", "replace"]) }).parse({ json, mode });
    const user = await authed();
    if (!user) return { ok: false, error: "Sign in to edit your collection." };
    const r = await importCollectionFor(user.id, input.json, input.mode);
    if (!r.ok) return r;
    refresh();
    return { ok: true, preview: r.preview };
  } catch (e) {
    return fail(e);
  }
}
