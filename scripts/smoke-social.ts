/**
 * Smoke test for the social service layer (no HTTP).
 * Run: npx tsx --conditions=react-server scripts/smoke-social.ts
 * (`react-server` lets lib/data/queries.ts import the `server-only` marker package.)
 */
try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell
}

const A = "smoke-user-a";
const B = "smoke-user-b";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok   ${msg}`);
}

async function main() {
  const { inArray, like } = await import("drizzle-orm");
  const { db, pool } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { ensureProfile, getBorrowSources, getProfileByShareToken } = await import("../lib/data/queries");
  const svc = await import("../lib/social/service");

  async function cleanup() {
    await db.delete(schema.follows).where(inArray(schema.follows.followerId, [A, B]));
    await db.delete(schema.follows).where(inArray(schema.follows.followeeId, [A, B]));
    await db.delete(schema.importedCollections).where(inArray(schema.importedCollections.ownerId, [A, B]));
    await db.delete(schema.collectionEntries).where(inArray(schema.collectionEntries.userId, [A, B]));
    await db.delete(schema.profiles).where(like(schema.profiles.userId, "smoke-user-%"));
  }

  try {
    await cleanup();

    const a = await ensureProfile({ id: A, email: "a@smoke.test", name: "Smoke A", image: null });
    const b = await ensureProfile({ id: B, email: "b@smoke.test", name: "Smoke B", image: null });
    assert(a.shareToken && b.shareToken && a.shareToken !== b.shareToken, "created two profiles with distinct tokens");
    assert(b.collectionVisibility === "PRIVATE", "new profile is PRIVATE by default");

    // B owns a few DEV cards.
    const devCards = await db
      .select({ id: schema.cards.id, code: schema.cards.publicCode })
      .from(schema.cards)
      .where(like(schema.cards.publicCode, "DEV-%"))
      .limit(3);
    assert(devCards.length === 3, "found 3 DEV cards");
    const printingRows = [];
    for (const c of devCards) {
      const [p] = await db
        .insert(schema.printings)
        .values({ cardId: c.id, variant: "NORMAL" })
        .onConflictDoUpdate({ target: [schema.printings.cardId, schema.printings.variant], set: { variant: "NORMAL" } })
        .returning();
      printingRows.push(p);
    }
    await db
      .insert(schema.collectionEntries)
      .values(printingRows.map((p, i) => ({ userId: B, printingId: p.id, quantity: i + 1 })));

    // Following a PRIVATE profile is refused; yourself is refused.
    let r = await svc.followByToken(A, b.shareToken!);
    assert(!r.ok, "cannot follow a PRIVATE profile");
    r = await svc.followByToken(A, a.shareToken!);
    assert(!r.ok && /yourself/.test(r.error), "cannot follow yourself");
    assert((await svc.getSharedCollection(b.shareToken!)) === null, "PRIVATE share page resolves to null");

    await svc.setVisibility(B, "LINK");
    const shared = await svc.getSharedCollection(b.shareToken!);
    assert(shared && shared.totalCards === 6 && shared.entries.length === 3, "LINK collection visible with 6 cards");

    // Follow by full URL.
    r = await svc.followByToken(A, `https://example.com/share/${b.shareToken}`);
    assert(r.ok, "A follows B by share URL");
    assert(await svc.isFollowing(A, B), "isFollowing is true");
    assert((await svc.countFollowers(B)) === 1, "B has 1 follower");
    const friends = await svc.listFollowing(A);
    assert(friends.length === 1 && friends[0].cardCount === 6, "listFollowing shows B with 6 cards");

    const sources = await getBorrowSources(A);
    const bSource = sources.find((s) => s.sourceId === `follow:${B}`);
    assert(bSource, "getBorrowSources(A) includes B");
    assert(
      devCards.every((c, i) => bSource.ownedQtyByCardId[c.id] === i + 1),
      "B's source has the expected card quantities",
    );

    // Imported snapshot from JSON.
    const json = JSON.stringify({
      format: "riftbound-collection",
      version: 1,
      owner: "Alex",
      cards: [
        { code: devCards[0].code, variant: "NORMAL", qty: 2 },
        { code: devCards[0].code, variant: "NORMAL", qty: 1 },
        { code: "ZZZ-999", variant: "FOIL", qty: 1 },
      ],
    });
    const prev = await svc.previewImportedCollection(json);
    assert(prev.ok && prev.preview.unknownCodes.join() === "ZZZ-999" && prev.preview.cardCount === 3, "preview reports unknown code");
    const saved = await svc.saveImportedCollection(A, { label: "Alex's binder", json });
    assert(saved.ok, "saved imported snapshot");
    const after = await getBorrowSources(A);
    assert(after.some((s) => s.kind === "IMPORT" && s.label === "Alex's binder"), "snapshot appears as a borrow source");
    assert(!(await svc.saveImportedCollection(A, { label: "x", json: "{nope" })).ok, "invalid JSON rejected");
    if (saved.ok) {
      assert((await svc.renameImportedCollection(A, saved.id, "Renamed")).ok, "rename snapshot");
      assert(!(await svc.renameImportedCollection(B, saved.id, "Hijack")).ok, "other user cannot rename it");
      assert(!(await svc.deleteImportedCollection(B, saved.id)).ok, "other user cannot delete it");
      const re = await svc.saveImportedCollection(A, { label: "Renamed", json, replaceId: saved.id });
      assert(re.ok && (await svc.listImportedCollections(A))[0].cardCount === 3, "re-import replaces entries");
      assert((await svc.deleteImportedCollection(A, saved.id)).ok, "delete snapshot");
    }

    // Rotate B's token.
    const oldToken = b.shareToken!;
    const rot = await svc.rotateShareToken(B);
    assert(rot.ok && rot.token !== oldToken, "rotated B's token");
    assert((await getProfileByShareToken(oldToken)) === null, "old token no longer resolves");
    assert((await svc.getSharedCollection(oldToken)) === null, "old token share page is null");
    assert(rot.ok && (await svc.getSharedCollection(rot.token)) !== null, "new token resolves");
    assert(await svc.isFollowing(A, B), "A still follows B after rotation");

    // Unfollow.
    await svc.unfollow(A, B);
    assert(!(await svc.isFollowing(A, B)), "unfollow works");

    // Private again => not a borrow source even if followed.
    await svc.followByToken(A, rot.ok ? rot.token : "");
    await svc.setVisibility(B, "PRIVATE");
    assert(
      !(await getBorrowSources(A)).some((s) => s.sourceId === `follow:${B}`),
      "PRIVATE followee is excluded from borrow sources",
    );
  } finally {
    await cleanup();
    console.log("cleaned up smoke rows");
    await pool.end();
  }
}

main().then(
  () => console.log("SMOKE OK"),
  (e) => {
    console.error(e);
    process.exitCode = 1;
  },
);

export {};
