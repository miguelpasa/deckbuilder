import catalogJson from "@/data/cards.json";
import type { Catalog, CatalogCard } from "@/lib/riot/export";
import { classifyQuery } from "./query";

const catalog = catalogJson as Catalog;

interface Indexed {
  card: CatalogCard;
  name: string;
  subtitle: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

const indexed: Indexed[] = catalog.cards.map((card) => ({
  card,
  name: norm(card.name),
  subtitle: norm(card.subtitle ?? ""),
}));
const byId = new Map(catalog.cards.map((c) => [c.id, c]));
const byCode = new Map(catalog.cards.flatMap((c) => (c.publicCode ? [[c.publicCode, c] as const] : [])));

export function getCatalogCard(id: string): CatalogCard | undefined {
  return byId.get(id);
}

export function catalogInfo() {
  return { version: catalog.version, generatedAt: catalog.generatedAt, cardCount: catalog.cardCount };
}

/** Score a name match; higher is better, 0 means no match. */
function score(entry: Indexed, tokens: string[], q: string): number {
  if (entry.name === q) return 100;
  if (entry.name.startsWith(q)) return 80;
  const hay = `${entry.name} ${entry.subtitle}`;
  if (tokens.every((t) => hay.includes(t))) {
    return entry.name.split(/\s+/).some((w) => w.startsWith(tokens[0])) ? 60 : 40;
  }
  return 0;
}

/**
 * Searches the exported catalog: exact public code, then exact id, then name
 * (exact > prefix > all-words substring, subtitle included).
 */
export function searchCatalog(query: string, limit = 20): CatalogCard[] {
  const raw = query.trim();
  if (!raw) return [];
  const max = Math.min(Math.max(1, Math.floor(limit)), 100);

  const { kind, value } = classifyQuery(raw);
  if (kind === "publicCode") {
    const hit = byCode.get(value);
    if (hit) return [hit];
  }
  const idHit = byId.get(raw);
  if (idHit) return [idHit];

  const q = norm(raw);
  const tokens = q.split(/\s+/).filter(Boolean);
  return indexed
    .map((e) => ({ card: e.card, s: score(e, tokens, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.card.name.localeCompare(b.card.name))
    .slice(0, max)
    .map((r) => r.card);
}
