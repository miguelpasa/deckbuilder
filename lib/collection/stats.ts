import type { CollectionRow } from "@/lib/collection/types";

/** Pure collection totals; counts only rows with quantity > 0. */
export function summarize(rows: Pick<CollectionRow, "cardId" | "variant" | "quantity">[]) {
  const unique = new Set<string>();
  let total = 0;
  let foils = 0;
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    unique.add(r.cardId);
    total += r.quantity;
    if (r.variant === "FOIL") foils += r.quantity;
  }
  return { uniqueCards: unique.size, totalCopies: total, foils };
}
