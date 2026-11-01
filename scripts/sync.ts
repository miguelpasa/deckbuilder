import { readFileSync } from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell
}

async function main() {
  // Dynamic imports so DATABASE_URL is loaded before the pool is created.
  const { syncCatalog } = await import("../lib/riot/sync");
  const { parseRiotContent } = await import("../lib/riot/schema");
  const { pool } = await import("../lib/db");

  const placeholder = process.argv.includes("--placeholder");
  try {
    if (placeholder) {
      const file = path.join(process.cwd(), "lib/riot/fixtures/placeholder-content.json");
      const content = parseRiotContent(JSON.parse(readFileSync(file, "utf8")));
      const summary = await syncCatalog({ content, placeholder: true });
      console.log("Placeholder sync OK:", JSON.stringify(summary));
    } else {
      const summary = await syncCatalog();
      console.log("Riot sync OK:", JSON.stringify(summary));
    }
  } catch (err) {
    const e = err as { name?: string; status?: number; message?: string };
    console.error(`Sync failed [${e.name ?? "Error"}${e.status ? ` ${e.status}` : ""}]: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
