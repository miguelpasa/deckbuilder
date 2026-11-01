import { describe, expect, it } from "vitest";
import { cardKind, fitsDomainIdentity, parseDomains } from "./classify";
import { card, buildValidDeck } from "./fixtures";
import { validateDeck } from "./rules";

const codes = (r: ReturnType<typeof validateDeck>) => r.issues.map((i) => i.code);

describe("classify", () => {
  it("classifies types leniently", () => {
    expect(cardKind({ type: "LEGEND", tags: [] })).toBe("LEGEND");
    expect(cardKind({ type: "Champion Unit", tags: [] })).toBe("CHAMPION_UNIT");
    expect(cardKind({ type: "unit", tags: ["Champion"] })).toBe("CHAMPION_UNIT");
    expect(cardKind({ type: "Unit", tags: [] })).toBe("UNIT");
    expect(cardKind({ type: "Spell", tags: [] })).toBe("SPELL");
    expect(cardKind({ type: "Gear", tags: [] })).toBe("GEAR");
    expect(cardKind({ type: "Rune", tags: [] })).toBe("RUNE");
    expect(cardKind({ type: "Battlefield", tags: [] })).toBe("BATTLEFIELD");
    expect(cardKind({ type: "???", tags: [] })).toBe("OTHER");
  });
  it("parses domains", () => {
    expect(parseDomains("Fury/Mind")).toEqual(["Fury", "Mind"]);
    expect(parseDomains("fury, mind")).toEqual(["Fury", "Mind"]);
    expect(parseDomains(null)).toEqual([]);
    expect(parseDomains("Colorless")).toEqual([]);
  });
  it("domain identity: multi-domain needs all, none is always ok", () => {
    expect(fitsDomainIdentity({ faction: "Fury/Mind" }, ["Fury", "Mind"])).toBe(true);
    expect(fitsDomainIdentity({ faction: "Fury/Calm" }, ["Fury", "Mind"])).toBe(false);
    expect(fitsDomainIdentity({ faction: null }, ["Fury", "Mind"])).toBe(true);
  });
});

describe("validateDeck", () => {
  it("accepts a valid deck", () => {
    const { deck, cards } = buildValidDeck();
    const r = validateDeck(deck, cards);
    expect(r.issues).toEqual([]);
    expect(r.valid).toBe(true);
  });
  it("accepts a Map of cards", () => {
    const { deck, cards } = buildValidDeck();
    expect(validateDeck(deck, new Map(Object.entries(cards))).valid).toBe(true);
  });
  it("flags missing legend", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries = deck.entries.filter((e) => e.zone !== "LEGEND");
    expect(codes(validateDeck(deck, cards))).toContain("LEGEND_COUNT");
  });
  it("flags two legends", () => {
    const { deck, cards } = buildValidDeck();
    cards.l2 = card({ id: "l2", name: "Other", type: "Legend", faction: "Fury/Mind", tags: ["X"] });
    deck.entries.push({ cardId: "l2", zone: "LEGEND", quantity: 1 });
    expect(codes(validateDeck(deck, cards))).toContain("LEGEND_COUNT");
  });
  it("flags missing chosen champion and shrinks main count", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries = deck.entries.filter((e) => e.zone !== "CHAMPION");
    const c = codes(validateDeck(deck, cards));
    expect(c).toContain("CHAMPION_COUNT");
    expect(c).toContain("MAIN_TOO_SMALL");
  });
  it("flags champion with wrong tag", () => {
    const { deck, cards } = buildValidDeck();
    cards.champ.tags = ["Jinx", "Champion"];
    expect(codes(validateDeck(deck, cards))).toContain("CHAMPION_TAG_MISMATCH");
  });
  it("flags non-champion in champion zone", () => {
    const { deck, cards } = buildValidDeck();
    cards.champ.type = "Spell";
    expect(codes(validateDeck(deck, cards))).toContain("CHAMPION_NOT_CHAMPION");
  });
  it("flags signature card as chosen champion", () => {
    const { deck, cards } = buildValidDeck();
    cards.champ.tags = ["Kai'Sa", "Champion", "Signature"];
    expect(codes(validateDeck(deck, cards))).toContain("CHAMPION_IS_SIGNATURE");
  });
  it("flags too-small main deck", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries.find((e) => e.cardId === "m0")!.quantity = 1;
    expect(codes(validateDeck(deck, cards))).toContain("MAIN_TOO_SMALL");
  });
  it("warns (not errors) on oversize main deck", () => {
    const { deck, cards } = buildValidDeck();
    cards.extra = card({ id: "extra", name: "Extra", faction: "Fury" });
    deck.entries.push({ cardId: "extra", zone: "MAIN", quantity: 1 });
    const r = validateDeck(deck, cards);
    expect(r.valid).toBe(true);
    expect(r.issues[0]).toMatchObject({ code: "MAIN_ABOVE_TOURNAMENT", severity: "warning" });
  });
  it("flags more than 3 copies by name across printings", () => {
    const { deck, cards } = buildValidDeck();
    cards.dup = card({ id: "dup", name: "main 0", faction: "Fury" });
    deck.entries.push({ cardId: "dup", zone: "MAIN", quantity: 1 });
    const r = validateDeck(deck, cards);
    expect(codes(r)).toContain("TOO_MANY_COPIES");
    expect(r.issues.find((i) => i.code === "TOO_MANY_COPIES")!.cardIds).toEqual(expect.arrayContaining(["m0", "dup"]));
  });
  it("warns when sideboard pushes a name over the cap", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries.push({ cardId: "m0", zone: "SIDEBOARD", quantity: 1 });
    const r = validateDeck(deck, cards);
    expect(r.valid).toBe(true);
    expect(codes(r)).toContain("TOO_MANY_COPIES_WITH_SIDEBOARD");
  });
  it("flags more than 3 signature cards and wrong-champion signatures", () => {
    const { deck, cards } = buildValidDeck();
    for (const id of ["m0", "m1"]) cards[id].tags = ["Kai'Sa", "Signature"];
    expect(codes(validateDeck(deck, cards))).toContain("TOO_MANY_SIGNATURE");
    cards.m0.tags = ["Jinx", "Signature"];
    cards.m1.tags = [];
    expect(codes(validateDeck(deck, cards))).toContain("SIGNATURE_WRONG_CHAMPION");
  });
  it("allows exactly 3 signature copies", () => {
    const { deck, cards } = buildValidDeck();
    cards.m0.tags = ["Kai'Sa", "Signature"];
    expect(validateDeck(deck, cards).valid).toBe(true);
  });
  it("flags rune count", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries.find((e) => e.cardId === "rf")!.quantity = 5;
    expect(codes(validateDeck(deck, cards))).toContain("RUNE_COUNT");
  });
  it("flags battlefield count and duplicates", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries.pop();
    expect(codes(validateDeck(deck, cards))).toContain("BATTLEFIELD_COUNT");
    deck.entries.push({ cardId: "b0", zone: "BATTLEFIELD", quantity: 1 });
    expect(codes(validateDeck(deck, cards))).toContain("DUPLICATE_BATTLEFIELD");
  });
  it("flags oversize sideboard", () => {
    const { deck, cards } = buildValidDeck();
    cards.s = card({ id: "s", name: "Side", faction: "Fury" });
    deck.entries.push({ cardId: "s", zone: "SIDEBOARD", quantity: 11 });
    expect(codes(validateDeck(deck, cards))).toContain("SIDEBOARD_TOO_LARGE");
  });
  it("flags off-domain cards in main and rune zones", () => {
    const { deck, cards } = buildValidDeck();
    cards.m0.faction = "Calm";
    cards.rm.faction = "Chaos";
    const r = validateDeck(deck, cards);
    expect(r.issues.find((i) => i.code === "DOMAIN_IDENTITY")!.cardIds).toEqual(expect.arrayContaining(["m0", "rm"]));
    expect(r.valid).toBe(false);
  });
  it("flags unknown cards and invalid quantities", () => {
    const { deck, cards } = buildValidDeck();
    deck.entries.push({ cardId: "ghost", zone: "MAIN", quantity: 1 }, { cardId: "m0", zone: "MAIN", quantity: 0 });
    const c = codes(validateDeck(deck, cards));
    expect(c).toContain("UNKNOWN_CARD");
    expect(c).toContain("INVALID_QUANTITY");
  });
  it("flags zone/type mismatches", () => {
    const { deck, cards } = buildValidDeck();
    cards.m0.type = "Rune";
    expect(codes(validateDeck(deck, cards))).toContain("ZONE_TYPE_MISMATCH");
  });
  it("warns when legend domains are unrecognised", () => {
    const { deck, cards } = buildValidDeck();
    cards.legend.faction = "Fury";
    expect(codes(validateDeck(deck, cards))).toContain("LEGEND_DOMAINS");
  });
});
