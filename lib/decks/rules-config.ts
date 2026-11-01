/**
 * Riftbound deckbuilding rules, centralised. Update here only.
 *
 * Sources (checked 2026-11-01):
 *  - Core Rules 1.4/1.5 (Vendetta-era, unofficial mirror of Riot's Core Rules doc), rule 103:
 *    https://www.riftboundfaq.com/reference/core-rules/1.4 and /1.5
 *    Official PDF (2025-06-02): https://riftbound.gg/wp-content/uploads/sites/67/2025/06/Riftbound-Core-Rules-2025-06-02.pdf
 *  - Deckbuilding Primer (Riot): https://playriftbound.com/en-us/news/rules-and-releases/deckbuilding-primer/
 *  - Tournament Rules July 2026 changelog (sideboard 8 -> 10):
 *    https://playriftbound.com/en-us/news/announcements/july-2026-tournament-rules-update-changelog/
 *
 * Confirmed: legend (1), main deck >= 40 incl. chosen champion, 3 copies per name,
 * 12 runes, 3 distinct battlefields (primer), 3 signature cards total, domain identity,
 * sideboard max 10 (July 2026).
 * NOT directly confirmed from primary text: tournament "exactly 40" main deck (secondary
 * sources only), battlefield count per Mode of Play (rule 483 not read), exact Riot API
 * type/faction strings, whether sideboard copies count toward the 3-copy cap.
 */
export const DECK_RULES = {
  legendCount: 1,
  /** Chosen Champion lives in its own zone. Core 103.2.a.2 */
  championCount: 1,
  /** Core 103.2: "at least 40" (chosen champion counts as one of them). */
  mainDeckMin: 40,
  /** Tournament Rules: exactly 40. Above this is a warning, not an error. */
  mainDeckTournamentMax: 40,
  /** Core 103.2.b: up to 3 copies of the same named card (incl. chosen champion). */
  maxCopiesPerName: 3,
  /** Core 103.3: 12 Rune cards matching the Legend's domain identity. */
  runeDeckSize: 12,
  /** Primer: three distinct battlefields. Core 103.4: no two with the same name. */
  battlefieldCount: 3,
  /** Core 103.2.d: 3 total Signature cards sharing the Legend's champion tag. */
  maxSignatureCards: 3,
  /** Tournament Rules July 2026 (rule 601.1.c.1). Was 8 before 2026-07-24. */
  sideboardMax: 10,
  /** Legends have two domains. */
  legendDomainCount: 2,
  /** Treat sideboard copies as counting toward the per-name cap (warning only). Unconfirmed. */
  copyCapIncludesSideboard: true,
} as const;
