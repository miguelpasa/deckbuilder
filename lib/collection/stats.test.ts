import { describe, expect, it } from "vitest";

import { summarize } from "./stats";

describe("summarize", () => {
  it("counts unique cards, copies and foils, ignoring zero rows", () => {
    expect(
      summarize([
        { cardId: "a", variant: "NORMAL", quantity: 2 },
        { cardId: "a", variant: "FOIL", quantity: 1 },
        { cardId: "b", variant: "NORMAL", quantity: 0 },
      ]),
    ).toEqual({ uniqueCards: 1, totalCopies: 3, foils: 1 });
  });
});
