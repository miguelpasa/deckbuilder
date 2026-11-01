import { isCardCode, normalizeCode } from "@/lib/share/codes";

export type BulkVariant = "NORMAL" | "FOIL" | "ALT_ART";

export interface BulkItem {
  lineNo: number;
  qty: number;
  /** A normalized card code (OGN-007) when the line contains one, otherwise the card name. */
  codeOrName: string;
  isCode: boolean;
  variant: BulkVariant;
  raw: string;
}

export interface BulkError {
  lineNo: number;
  raw: string;
  error: string;
}

export interface BulkParseResult {
  items: BulkItem[];
  errors: BulkError[];
}

export const MAX_BULK_QTY = 999;

const VARIANT_TOKENS: Record<string, BulkVariant> = {
  foil: "FOIL",
  alt: "ALT_ART",
  "alt-art": "ALT_ART",
  altart: "ALT_ART",
  alt_art: "ALT_ART",
  normal: "NORMAL",
};

type Parsed = { ok: true; item: Omit<BulkItem, "lineNo" | "raw"> } | { ok: false; error: string };

export function parseBulkLine(line: string): Parsed {
  let tokens = line.trim().split(/\s+/);
  let variant: BulkVariant | null = null;
  let trailingQty: number | null = null;

  // Strip trailing variant / quantity tokens in any order.
  for (;;) {
    const last = tokens[tokens.length - 1]?.replace(/^[(\[]|[)\]]$/g, "");
    if (tokens.length < 2 || !last) break;
    const v = VARIANT_TOKENS[last.toLowerCase()];
    if (v) {
      if (variant) return { ok: false, error: "More than one variant given." };
      variant = v;
      tokens = tokens.slice(0, -1);
      continue;
    }
    const q = /^[x×](\d+)$/i.exec(last) ?? /^(\d+)[x×]$/i.exec(last);
    if (q) {
      if (trailingQty !== null) return { ok: false, error: "More than one quantity given." };
      trailingQty = Number(q[1]);
      tokens = tokens.slice(0, -1);
      continue;
    }
    break;
  }

  let leadingQty: number | null = null;
  const first = tokens[0];
  const lq = /^(\d+)[x×]?$/i.exec(first);
  if (lq && tokens.length > 1) {
    leadingQty = Number(lq[1]);
    tokens = tokens.slice(1);
  } else if (/^[x×]\d+$/i.test(first) && tokens.length > 1) {
    leadingQty = Number(first.slice(1));
    tokens = tokens.slice(1);
  }

  if (leadingQty !== null && trailingQty !== null) {
    return { ok: false, error: "Quantity given twice (before and after the card)." };
  }
  const qty = leadingQty ?? trailingQty ?? 1;
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Quantity must be at least 1." };
  if (qty > MAX_BULK_QTY) return { ok: false, error: `Quantity must be at most ${MAX_BULK_QTY}.` };

  const text = tokens.join(" ").trim();
  if (!text || /^\d+$/.test(text)) return { ok: false, error: "Missing card code or name." };

  const isCode = isCardCode(text);
  return {
    ok: true,
    item: { qty, codeOrName: isCode ? normalizeCode(text) : text, isCode, variant: variant ?? "NORMAL" },
  };
}

/** Blank lines and lines starting with # or // are ignored. */
export function parseBulk(text: string): BulkParseResult {
  const items: BulkItem[] = [];
  const errors: BulkError[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("//")) return;
    const r = parseBulkLine(t);
    if (r.ok) items.push({ lineNo, raw, ...r.item });
    else errors.push({ lineNo, raw, error: r.error });
  });
  return { items, errors };
}
