"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/data/queries";
import * as service from "./service";

type Result<T = object> = service.ServiceResult<T>;

const NOT_SIGNED_IN = { ok: false, error: "You need to sign in." } as const;
const BAD_INPUT = { ok: false, error: "Invalid input." } as const;

async function sessionUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  await ensureProfile(user);
  return user;
}

function refreshSocial() {
  for (const p of ["/friends", "/borrow", "/settings/sharing"]) revalidatePath(p);
  revalidatePath("/share/[token]", "page");
}

const tokenSchema = z.string().trim().min(1).max(500);
const idSchema = z.string().trim().min(1).max(200);
const uuidSchema = z.string().uuid();
const labelSchema = z.string().trim().min(1, "Give the snapshot a label.").max(100);
const jsonSchema = z.string().min(2).max(service.MAX_IMPORT_JSON_CHARS);

export async function follow(token: string): Promise<Result<{ name: string }>> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const t = tokenSchema.safeParse(token);
  if (!t.success) return BAD_INPUT;
  const res = await service.followByToken(user.id, t.data);
  if (res.ok) refreshSocial();
  return res;
}

export async function unfollow(userId: string): Promise<Result> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const id = idSchema.safeParse(userId);
  if (!id.success) return BAD_INPUT;
  const res = await service.unfollow(user.id, id.data);
  refreshSocial();
  return res;
}

export async function setVisibility(visibility: string): Promise<Result> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const v = z.enum(["PRIVATE", "LINK", "PUBLIC"]).safeParse(visibility);
  if (!v.success) return BAD_INPUT;
  const res = await service.setVisibility(user.id, v.data);
  refreshSocial();
  return res;
}

export async function rotateShareToken(): Promise<Result<{ token: string }>> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const res = await service.rotateShareToken(user.id);
  refreshSocial();
  return res;
}

export async function previewImportedCollection(json: string): Promise<Result<{ preview: service.ImportPreview }>> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const j = jsonSchema.safeParse(json);
  if (!j.success) return { ok: false, error: "Paste or upload a riftbound-collection JSON file." };
  return service.previewImportedCollection(j.data);
}

export async function saveImportedCollection(input: {
  label: string;
  json: string;
  replaceId?: string;
}): Promise<Result<{ id: string; preview: service.ImportPreview }>> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = z
    .object({ label: labelSchema, json: jsonSchema, replaceId: uuidSchema.optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? BAD_INPUT.error };
  const res = await service.saveImportedCollection(user.id, parsed.data);
  if (res.ok) refreshSocial();
  return res;
}

export async function renameImportedCollection(id: string, label: string): Promise<Result> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = z.object({ id: uuidSchema, label: labelSchema }).safeParse({ id, label });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? BAD_INPUT.error };
  const res = await service.renameImportedCollection(user.id, parsed.data.id, parsed.data.label);
  if (res.ok) refreshSocial();
  return res;
}

export async function deleteImportedCollection(id: string): Promise<Result> {
  const user = await sessionUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return BAD_INPUT;
  const res = await service.deleteImportedCollection(user.id, parsed.data);
  if (res.ok) refreshSocial();
  return res;
}
