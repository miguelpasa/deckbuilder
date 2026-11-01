import { describe, expect, it } from "vitest";
import { getCatalogCard, searchCatalog } from "./catalog";

describe("searchCatalog", () => {
  it("finds by public code", () => {
    expect(searchCatalog("dev-1")[0]?.publicCode).toBe("DEV-001");
  });
  it("finds by id", () => {
    expect(searchCatalog("dev-002")[0]?.id).toBe("dev-002");
  });
  it("ranks exact name over partial and matches case-insensitively", () => {
    const hits = searchCatalog("placeholder legend a");
    expect(hits[0]?.name).toBe("Placeholder Legend A");
  });
  it("matches all words in any order", () => {
    expect(searchCatalog("legend placeholder").length).toBeGreaterThan(0);
  });
  it("returns nothing for empty or unknown queries", () => {
    expect(searchCatalog("  ")).toEqual([]);
    expect(searchCatalog("zzzzzz")).toEqual([]);
  });
  it("looks up by id", () => {
    expect(getCatalogCard("dev-001")?.name).toBe("Placeholder Legend A");
  });
});
