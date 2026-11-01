import { describe, expect, it } from "vitest";
import { isCardCode, normalizeCode } from "./codes";
import { parseShareJson, resolveCodes, toCollectionJson, toDeckJson, toDeckText } from "./schema";

describe("codes", () => {
  it("validates and normalizes", () => {
    expect(isCardCode("OGN-042")).toBe(true);
    expect(isCardCode("ogn-7")).toBe(true);
    expect(isCardCode("Some Card")).toBe(false);
    expect(normalizeCode("ogn-7")).toBe("OGN-007");
    expect(normalizeCode("OGN-042")).toBe("OGN-042");
  });
});

describe("collection json", () => {
  it("round-trips", () => {
    const text = toCollectionJson(
      [
        { code: "OGN-042", variant: "FOIL", qty: 2 },
        { code: "OGN-001", variant: "NORMAL", qty: 1 },
        { code: "OGN-003", variant: "NORMAL", qty: 0 },
      ],
      { owner: "me", exportedAt: new Date("2026-01-01T00:00:00Z") },
    );
    const r = parseShareJson(text);
    expect(r.ok && r.kind).toBe("collection");
    if (r.ok && r.kind === "collection") {
      expect(r.data.cards.map((c) => c.code)).toEqual(["OGN-001", "OGN-042"]);
      expect(r.data.owner).toBe("me");
      expect(r.data.exportedAt).toBe("2026-01-01T00:00:00.000Z");
    }
  });
  it("normalizes codes on parse", () => {
    const r = parseShareJson(
      JSON.stringify({ format: "riftbound-collection", version: 1, cards: [{ code: "ogn-7", variant: "NORMAL", qty: 1 }] }),
    );
    expect(r.ok && r.kind === "collection" && r.data.cards[0].code).toBe("OGN-007");
  });
  it("gives friendly errors", () => {
    const r = parseShareJson(
      JSON.stringify({ format: "riftbound-collection", version: 1, cards: [{ code: "bad", variant: "SHINY", qty: 0 }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((m) => m.startsWith("cards[0].code"))).toBe(true);
      expect(r.errors.some((m) => m.startsWith("cards[0].variant"))).toBe(true);
      expect(r.errors.some((m) => m.startsWith("cards[0].qty"))).toBe(true);
    }
  });
});

describe("deck json", () => {
  const deck = {
    name: "Kai'Sa Aggro", source: "META" as const, eventName: "Regionals", placement: "1st", legend: "OGN-100",
    cards: [
      { code: "OGN-100", qty: 1, zone: "LEGEND" as const, name: "Kai'Sa Legend" },
      { code: "OGN-042", qty: 3, zone: "MAIN" as const, name: "Card Name" },
    ],
  };
  it("round-trips and strips card names", () => {
    const text = toDeckJson(deck);
    expect(text).not.toContain("Card Name");
    const r = parseShareJson(text);
    expect(r.ok && r.kind).toBe("deck");
    if (r.ok && r.kind === "deck") {
      expect(r.data.name).toBe("Kai'Sa Aggro");
      expect(r.data.cards[1]).toEqual({ code: "OGN-042", qty: 3, zone: "MAIN" });
      expect(r.data.legend).toBe("OGN-100");
    }
  });
  it("rejects bad zone / missing name", () => {
    const r = parseShareJson(
      JSON.stringify({ format: "riftbound-deck", version: 1, cards: [{ code: "OGN-042", qty: 1, zone: "HAND" }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toMatch(/name/);
      expect(r.errors.join("\n")).toMatch(/cards\[0\]\.zone/);
    }
  });
  it("toDeckText groups by zone", () => {
    const t = toDeckText(deck);
    expect(t).toContain("Legend:\n1 OGN-100 Kai'Sa Legend");
    expect(t).toContain("Main Deck:\n3 OGN-042 Card Name");
    expect(t).not.toContain("Sideboard");
  });
});

describe("parseShareJson errors", () => {
  it("handles bad json, non-objects, unknown format, wrong version", () => {
    expect(parseShareJson("{nope").ok).toBe(false);
    expect(parseShareJson("[]").ok).toBe(false);
    expect(parseShareJson("{}").ok).toBe(false);
    expect(parseShareJson(JSON.stringify({ format: "riftbound-collection", version: 2, cards: [] })).ok).toBe(false);
  });
});

describe("resolveCodes", () => {
  it("never silently drops unknown codes", () => {
    const map = new Map([["OGN-001", "id1"], ["OGN-002", "id2"]]);
    const items = [
      { code: "OGN-001", qty: 1 },
      { code: "ogn-2", qty: 2 },
      { code: "ZZZ-999", qty: 1 },
      { code: "ZZZ-999", qty: 2 },
    ];
    const r = resolveCodes(items, map);
    expect(r.resolved.map((x) => x.cardId)).toEqual(["id1", "id2"]);
    expect(r.unknownCodes).toEqual(["ZZZ-999"]);
  });
  it("accepts a plain record and ignores prototype keys", () => {
    expect(resolveCodes([{ code: "OGN-001" }], { "OGN-001": "x" }).resolved[0].cardId).toBe("x");
    expect(resolveCodes([{ code: "constructor" }], {}).unknownCodes).toEqual(["constructor"]);
  });
});
