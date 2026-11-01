/**
 * Exercises the deck service logic directly against the DB for the test user:
 * create -> export -> re-parse -> import -> update -> visibility -> delete.
 * Run: npx tsx scripts/smoke-decks.ts
 */
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell
}
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // optional
}

async function main() {
  const svc = await import("../lib/decks/service");
  const { parseShareJson } = await import("../lib/share/schema");
  const { pool, db } = await import("../lib/db");
  const { decks } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const email = process.env.TEST_USER_EMAIL;
  if (!email) throw new Error("TEST_USER_EMAIL not set");
  // Look the test user's id up from the auth schema (read-only).
  const res = await pool.query<{ id: string }>("select id from neon_auth.\"user\" where email = $1 limit 1", [email]);
  const userId = res.rows[0]?.id;
  if (!userId) throw new Error("Test user not found in neon_auth.user");
  const other = "smoke-other-user";

  let failures = 0;
  const check = (label: string, ok: boolean, extra = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` - ${extra}` : ""}`);
  };

  const created: string[] = [];
  try {
    // Source: the seeded dev deck, via export -> import.
    const [dev] = await db.select().from(decks).where(eq(decks.name, "[DEV] Placeholder Deck")).limit(1);
    check("dev deck exists (run db:seed first)", !!dev);
    if (!dev) return;

    const exp = await svc.exportDeckJson(dev.id, userId);
    check("export dev deck", !!exp);
    const reparsed = exp ? parseShareJson(exp.json) : null;
    check("export re-parses with parseShareJson", !!reparsed?.ok && reparsed.kind === "deck",
      reparsed?.ok ? `${reparsed.kind === "deck" ? reparsed.data.cards.length : 0} card lines` : "");

    const imp = await svc.importUserDeckJson(userId, exp!.json.replace('"[DEV] Placeholder Deck"', '"[SMOKE] Imported"'));
    check("import deck JSON", imp.ok, imp.ok ? `imported=${imp.imported} unknown=${imp.unknownCodes.length}` : imp.error);
    if (imp.ok) created.push(imp.deckId);

    const bad = await svc.importUserDeckJson(userId, "{not json");
    check("import rejects invalid JSON", !bad.ok);
    const unknownDeck = JSON.stringify({
      format: "riftbound-deck", version: 1, name: "[SMOKE] unknown",
      cards: [{ code: "OGN-001", qty: 1, zone: "LEGEND" }, { code: "DEV-009", qty: 2, zone: "MAIN" }],
    });
    const partial = await svc.importUserDeckJson(userId, unknownDeck);
    check("import reports unknown codes", partial.ok && partial.unknownCodes.join() === "OGN-001",
      partial.ok ? `unknown=${partial.unknownCodes}` : partial.error);
    if (partial.ok) created.push(partial.deckId);

    // Create directly, then update, check ownership.
    const make = await svc.saveUserDeck(userId, {
      name: "[SMOKE] Created", description: "smoke", isPublic: false,
      entries: [{ cardId: "dev-001", zone: "LEGEND", quantity: 1 }, { cardId: "dev-009", zone: "MAIN", quantity: 3 }],
    });
    check("create deck", make.ok, make.ok ? make.deckId : make.error);
    if (!make.ok) return;
    created.push(make.deckId);

    check("private deck hidden from other user", (await svc.exportDeckJson(make.deckId, other)) === null);
    check("private deck hidden from signed-out", (await svc.exportDeckJson(make.deckId, null)) === null);
    check("private deck visible to owner", (await svc.exportDeckJson(make.deckId, userId)) !== null);

    const upd = await svc.saveUserDeck(userId, {
      name: "[SMOKE] Updated", isPublic: true,
      entries: [{ cardId: "dev-001", zone: "LEGEND", quantity: 1 }, { cardId: "dev-010", zone: "MAIN", quantity: 2 }],
    }, make.deckId);
    check("owner can update", upd.ok);
    check("public deck visible to signed-out", (await svc.exportDeckJson(make.deckId, null)) !== null);

    const hijack = await svc.saveUserDeck(other, { name: "x", isPublic: true, entries: [] }, make.deckId);
    check("other user cannot update", !hijack.ok);
    const sysEdit = await svc.saveUserDeck(userId, { name: "x", isPublic: true, entries: [] }, dev.id);
    check("system deck cannot be edited by a user", !sysEdit.ok);
    const badCard = await svc.saveUserDeck(userId, {
      name: "x", isPublic: false, entries: [{ cardId: "nope", zone: "MAIN", quantity: 1 }],
    });
    check("unknown card id rejected", !badCard.ok);
    const badQty = await svc.saveUserDeck(userId, {
      name: "x", isPublic: false, entries: [{ cardId: "dev-009", zone: "MAIN", quantity: 0 }],
    });
    check("zero quantity rejected by zod", !badQty.ok);

    check("other user cannot delete", !(await svc.deleteUserDeck(other, make.deckId)).ok);
    check("owner can delete", (await svc.deleteUserDeck(userId, make.deckId)).ok);
    created.splice(created.indexOf(make.deckId), 1);
  } finally {
    for (const id of created) await svc.deleteUserDeck(userId, id);
    await pool.end();
  }
  console.log(failures ? `${failures} check(s) FAILED` : "All smoke checks passed");
  if (failures) process.exitCode = 1;
}

void main();
