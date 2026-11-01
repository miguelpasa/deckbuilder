import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell
}

/**
 * Idempotently upserts system decks (ownerId null, META, featured, public)
 * from data/meta-decks/*.json and data/dev-decks/*.json. Decks with card codes
 * that do not exist in the DB yet are skipped and the missing codes printed.
 */
async function main() {
  // Dynamic imports so DATABASE_URL is loaded before the pool is created.
  const { upsertSystemDeck } = await import("../lib/decks/service");
  const { parseShareJson } = await import("../lib/share/schema");
  const { pool } = await import("../lib/db");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (const dir of ["data/meta-decks", "data/dev-decks"]) {
      const full = path.join(process.cwd(), dir);
      const files = readdirSync(full).filter((f) => f.endsWith(".json")).sort();
      for (const file of files) {
        const label = `${dir}/${file}`;
        const parsed = parseShareJson(readFileSync(path.join(full, file), "utf8"));
        if (!parsed.ok || parsed.kind !== "deck") {
          failed++;
          console.error(`FAILED  ${label}: ${parsed.ok ? "not a deck file" : parsed.errors.join("; ")}`);
          continue;
        }
        const res = await upsertSystemDeck(parsed.data, { source: "META", isFeatured: true });
        if (res.status === "skipped") {
          skipped++;
          console.log(
            `SKIPPED ${label} ("${res.name}"): ${res.missingCodes.length} unknown code(s): ${res.missingCodes.join(", ")}`,
          );
        } else {
          if (res.status === "created") created++;
          else updated++;
          console.log(`${res.status.toUpperCase().padEnd(7)} ${label} ("${res.name}") id=${res.deckId} lines=${res.cards}`);
        }
      }
    }
    console.log(`Seed done: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed.`);
    if (failed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
