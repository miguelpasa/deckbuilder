import { describe, expect, it } from "vitest";
import { classifyQuery, normalisePublicCode } from "./query";

describe("classifyQuery", () => {
  it("detects public codes and normalises them", () => {
    expect(classifyQuery("OGN-042")).toEqual({ kind: "publicCode", value: "OGN-042" });
    expect(classifyQuery(" ogn-42 ")).toEqual({ kind: "publicCode", value: "OGN-042" });
    expect(classifyQuery("dev-001").kind).toBe("publicCode");
  });
  it("treats everything else as id/name", () => {
    expect(classifyQuery("Placeholder Champion A").kind).toBe("id");
    expect(classifyQuery("ogn-042-298").kind).toBe("id");
    expect(classifyQuery("fury").kind).toBe("id");
  });
  it("pads numbers", () => {
    expect(normalisePublicCode("a-7")).toBe("A-007");
  });
});
