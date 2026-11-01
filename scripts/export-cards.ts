import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell
}

async function main() {
  const { fetchRiotContent } = await import("../lib/riot/client");
  const { parseRiotContent } = await import("../lib/riot/schema");
  const { buildCatalog, cardsMissingArt } = await import("../lib/riot/export");

  const placeholder = process.argv.includes("--placeholder");
  try {
    const content = placeholder
      ? parseRiotContent(
          JSON.parse(readFileSync(path.join(process.cwd(), "lib/riot/fixtures/placeholder-content.json"), "utf8")),
        )
      : await fetchRiotContent();

    const catalog = buildCatalog(content);
    const missing = cardsMissingArt(catalog);
    if (missing.length > 0 && !placeholder) {
      console.error(
        `${missing.length}/${catalog.cardCount} cards lack art URLs (e.g. ${missing
          .slice(0, 5)
          .map((c) => c.id)
          .join(", ")}). Inspect the raw payload and adjust pick() keys in lib/riot/schema.ts.`,
      );
      process.exitCode = 1;
      return;
    }

    const file = path.join(process.cwd(), "data/cards.json");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    console.log(
      `Wrote ${file}: ${catalog.cardCount} cards, ${catalog.sets.length} sets${placeholder ? " (placeholder)" : ""}`,
    );
  } catch (err) {
    const e = err as { name?: string; status?: number; message?: string };
    console.error(`Export failed [${e.name ?? "Error"}${e.status ? ` ${e.status}` : ""}]: ${e.message}`);
    process.exitCode = 1;
  }
}

void main();
