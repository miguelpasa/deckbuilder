import { describe, expect, it } from "vitest";
import { parseBulk, parseBulkLine } from "./bulk-parse";

const ok = (line: string) => {
  const r = parseBulkLine(line);
  if (!r.ok) throw new Error(r.error);
  return r.item;
};

describe("parseBulkLine", () => {
  it("qty + code + foil", () => {
    expect(ok("3 OGN-042 foil")).toMatchObject({ qty: 3, codeOrName: "OGN-042", variant: "FOIL", isCode: true });
  });
  it("code x2", () => {
    expect(ok("OGN-042 x2")).toMatchObject({ qty: 2, codeOrName: "OGN-042", variant: "NORMAL" });
  });
  it("2x name", () => {
    expect(ok("2x Some Card Name")).toMatchObject({ qty: 2, codeOrName: "Some Card Name", isCode: false });
  });
  it("bare name defaults to qty 1", () => {
    expect(ok("Some Card Name")).toMatchObject({ qty: 1, codeOrName: "Some Card Name" });
  });
  it("pads code and reads alt", () => {
    expect(ok("1 OGN-7 alt")).toMatchObject({ qty: 1, codeOrName: "OGN-007", variant: "ALT_ART" });
  });
  it("variant spellings", () => {
    for (const t of ["alt-art", "altart", "ALT"]) expect(ok(`OGN-001 ${t}`).variant).toBe("ALT_ART");
    expect(ok("OGN-001 normal").variant).toBe("NORMAL");
    expect(ok("OGN-001 (foil)").variant).toBe("FOIL");
  });
  it("variant and trailing qty in either order", () => {
    expect(ok("OGN-001 x3 foil")).toMatchObject({ qty: 3, variant: "FOIL" });
    expect(ok("OGN-001 foil x3")).toMatchObject({ qty: 3, variant: "FOIL" });
  });
  it("name with variant", () => {
    expect(ok("2 Some Card foil")).toMatchObject({ qty: 2, codeOrName: "Some Card", variant: "FOIL" });
  });
  it("errors", () => {
    expect(parseBulkLine("0 OGN-001").ok).toBe(false);
    expect(parseBulkLine("3").ok).toBe(false);
    expect(parseBulkLine("3 foil").ok).toBe(false);
    expect(parseBulkLine("2 OGN-001 x3").ok).toBe(false);
    expect(parseBulkLine("OGN-001 foil alt").ok).toBe(false);
    expect(parseBulkLine("1000 OGN-001").ok).toBe(false);
    expect(parseBulkLine("OGN-001 x0").ok).toBe(false);
  });
});

describe("parseBulk", () => {
  it("handles line numbers, blanks, comments, CRLF, and per-line errors", () => {
    const r = parseBulk("3 OGN-042 foil\r\n\r\n# note\n0 OGN-001\nSome Card\n");
    expect(r.items.map((i) => [i.lineNo, i.qty])).toEqual([[1, 3], [5, 1]]);
    expect(r.items[0].raw).toBe("3 OGN-042 foil");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ lineNo: 4, raw: "0 OGN-001" });
  });
});
