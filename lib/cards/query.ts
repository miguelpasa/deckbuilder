export type QueryKind = "publicCode" | "id" | "name";

const PUBLIC_CODE_RE = /^[A-Z0-9]+-\d+$/i;

/**
 * Classifies a search string. Public codes look like `OGN-042`. Anything else
 * is treated as a Riot id or a name; since ids can't be told apart from names
 * without a lookup, the caller tries id first then falls back to name.
 */
export function classifyQuery(query: string): { kind: QueryKind; value: string } {
  const value = query.trim();
  if (PUBLIC_CODE_RE.test(value)) return { kind: "publicCode", value: normalisePublicCode(value) };
  return { kind: "id", value };
}

/** `ogn-42` -> `OGN-042` (matches derivePublicCode). */
export function normalisePublicCode(code: string): string {
  const [set, num] = code.trim().split("-");
  return `${set.toUpperCase()}-${num.padStart(3, "0")}`;
}
