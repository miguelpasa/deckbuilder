/**
 * Smoke test for collection DB logic. Run:
 *   npx tsx --conditions=react-server scripts/smoke-collection.ts
 * Uses the test user's id found via the neon_auth schema (email from .env.test.local).
 * Restores the user's collection to its previous state when done.
 */
try {
  process.loadEnvFile(".env");
} catch {}
try {
  process.loadEnvFile(".env.test.local");
} catch {}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  const { pool, db } = await import("../lib/db");
  const { collectionEntries, printings, cards } = await import("../lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const svc = await import("../lib/collection/service");
  const { summarize } = await import("../lib/collection/stats");
  const { ensureProfile } = await import("../lib/data/queries");
  const { getOwnedQtyByCardId } = await import("../lib/data/queries");

  try {
    const email = process.env.TEST_USER_EMAIL;
    assert(email, "TEST_USER_EMAIL is not set");
    const u = await pool.query('select id, name from neon_auth."user" where lower(email) = lower($1) limit 1', [email]);
    assert(u.rows[0], "test user not found in neon_auth.user");
    const userId: string = u.rows[0].id;
    await ensureProfile({ id: userId, email, name: u.rows[0].name ?? "", image: null });

    // Back up and clear the user's collection so totals are deterministic.
    const backup = await db.select().from(collectionEntries).where(eq(collectionEntries.userId, userId));
    await db.delete(collectionEntries).where(eq(collectionEntries.userId, userId));

    try {
      const picks = await db
        .select({ pid: printings.id, code: cards.publicCode, cardId: cards.id })
        .from(printings)
        .innerJoin(cards, eq(printings.cardId, cards.id))
        .where(eq(printings.variant, "NORMAL"))
        .orderBy(cards.publicCode)
        .limit(3);
      assert(picks.length === 3, "need 3 NORMAL printings");
      const quantities = [2, 1, 3];
      const r = await svc.bulkAddFor(
        userId,
        picks.map((p, i) => ({ printingId: p.pid, qty: quantities[i] })),
      );
      console.log("bulkAdd:", JSON.stringify(r));
      assert(r.copies === 6, "bulkAdd copies");

      // adjust / set
      const up = await svc.adjustQuantityFor(userId, picks[0].pid, 1);
      const down = await svc.adjustQuantityFor(userId, picks[0].pid, -1);
      const floor = await svc.adjustQuantityFor(userId, picks[1].pid, -5);
      console.log(`adjust +1 -> ${up}, -1 -> ${down}, -5 on qty 1 -> ${floor}`);
      assert(up === 3 && down === 2 && floor === 0, "adjust results");
      const set = await svc.setQuantityFor(userId, picks[1].pid, 1);
      assert(set === 1, "setQuantity");

      const owned = await getOwnedQtyByCardId(userId);
      console.log("owned by card:", JSON.stringify(Object.fromEntries(picks.map((p) => [p.code, owned[p.cardId]]))));
      assert(owned[picks[0].cardId] === 2 && owned[picks[2].cardId] === 3, "owned qty read back");

      const before = summarize(await svc.getCollectionRows(userId));
      console.log("before:", JSON.stringify(before));
      assert(before.totalCopies === 6 && before.uniqueCards === 3, "totals before");

      const json = await svc.exportCollectionJson(userId);
      const parsed = JSON.parse(json);
      console.log("export:", JSON.stringify({ format: parsed.format, version: parsed.version, cards: parsed.cards }));
      assert(parsed.format === "riftbound-collection" && parsed.cards.length === 3, "export shape");

      const merge = await svc.importCollectionFor(userId, json, "merge");
      assert(merge.ok, "merge import ok");
      const after = summarize(await svc.getCollectionRows(userId));
      console.log("after merge:", JSON.stringify(after));
      assert(after.totalCopies === before.totalCopies * 2, "totals doubled");

      const replace = await svc.importCollectionFor(userId, json, "replace");
      assert(replace.ok, "replace import ok");
      const afterReplace = summarize(await svc.getCollectionRows(userId));
      console.log("after replace:", JSON.stringify(afterReplace));
      assert(afterReplace.totalCopies === before.totalCopies, "replace restores totals");

      // Unknown code / missing printing handling
      const bad = JSON.stringify({
        format: "riftbound-collection",
        version: 1,
        cards: [{ code: "ZZZ-999", variant: "NORMAL", qty: 1 }],
      });
      const badRes = await svc.importCollectionFor(userId, bad, "replace");
      console.log("unknown-only import:", JSON.stringify(badRes));
      assert(!badRes.ok, "unknown-only import must be refused (and not wipe)");
      assert(summarize(await svc.getCollectionRows(userId)).totalCopies === 6, "collection untouched after refused import");

      // Bulk preview
      const pv = await svc.previewBulkFor(`2 ${picks[0].code}\n1 ZZZ-999\nbogus card name xyz\n1 ${picks[0].code} alt`);
      console.log("bulk preview:", JSON.stringify(pv.rows.map((x) => [x.lineNo, x.status, x.message ?? x.warning ?? ""])));
      assert(pv.rows.filter((x) => x.status === "ok").length === 1, "one ok line");
      assert(pv.rows.filter((x) => x.status === "error").length === 3, "three error lines");
      console.log("SMOKE OK");
    } finally {
      await db.delete(collectionEntries).where(eq(collectionEntries.userId, userId));
      if (backup.length) {
        await db
          .insert(collectionEntries)
          .values(backup.map(({ userId: uid, printingId, quantity }) => ({ userId: uid, printingId, quantity })));
      }
      void and;
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

export {};
