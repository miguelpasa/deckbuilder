/** Public card codes look like `OGN-042` (set id + collector number); suffix letters/`*` allowed. */
const CODE_RE = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,4})([A-Za-z*]?)$/;

export function isCardCode(s: string): boolean {
  return CODE_RE.test(s.trim());
}

/** Uppercases and zero-pads the collector number to 3 digits (OGN-7 -> OGN-007). Non-codes are returned trimmed. */
export function normalizeCode(s: string): string {
  const t = s.trim();
  const m = CODE_RE.exec(t);
  if (!m) return t;
  return `${m[1].toUpperCase()}-${m[2].padStart(3, "0")}${m[3].toUpperCase()}`;
}
