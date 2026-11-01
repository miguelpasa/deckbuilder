import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RiotAccessError, RiotRateLimitError, fetchRiotContentRaw, parseRetryAfter } from "./client";
import { derivePublicCode, parseRiotContent } from "./schema";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/placeholder-content.json"), "utf8"),
);

describe("schema", () => {
  it("parses the placeholder fixture", () => {
    const content = parseRiotContent(fixture);
    expect(content.sets).toHaveLength(1);
    const set = content.sets[0];
    expect(set.id).toBe("DEV");
    expect(set.cards.length).toBeGreaterThanOrEqual(40);
    expect(set.cards.filter((c) => c.type === "Legend")).toHaveLength(2);
    expect(set.cards.filter((c) => c.type === "Battlefield").length).toBeGreaterThanOrEqual(4);
    expect(set.cards.filter((c) => c.type !== "Legend" && c.type !== "Rune" && c.type !== "Battlefield" && c.type !== "Champion Unit").length).toBeGreaterThanOrEqual(30);
    expect(set.cards[0].thumbnailUrl).toBeNull();
  });

  it("tolerates a messy payload", () => {
    const content = parseRiotContent({
      version: 3,
      extra: "ignored",
      sets: [
        {
          id: "ogn",
          name: "Messy",
          cards: [
            {
              id: 123,
              name: "Weird Card",
              collectorNumber: "42",
              set: { id: "ogn" },
              stats: { energy: "3", might: null, cost: "x" },
              art: { thumbnailUrl: "http://t", full: "http://f", illustrator: "Someone" },
              tags: ["a", 5, null],
              faction: "",
              unknownField: true,
            },
            { id: "c2", name: "Bare" },
          ],
        },
      ],
    });
    expect(content.version).toBe("3");
    const [a, b] = content.sets[0].cards;
    expect(a.id).toBe("123");
    expect(a.collectorNumber).toBe(42);
    expect(a.energy).toBe(3);
    expect(a.might).toBeNull();
    expect(a.cost).toBeNull();
    expect(a.thumbnailUrl).toBe("http://t");
    expect(a.fullUrl).toBe("http://f");
    expect(a.artist).toBe("Someone");
    expect(a.tags).toEqual(["a"]);
    expect(a.faction).toBeNull();
    expect(a.raw.unknownField).toBe(true);
    expect(b.collectorNumber).toBeNull();
    expect(b.tags).toEqual([]);
  });

  it("rejects payloads without sets or card names", () => {
    expect(() => parseRiotContent({})).toThrow();
    expect(() => parseRiotContent({ sets: [{ id: "X", name: "S", cards: [{ id: "1" }] }] })).toThrow();
  });
});

describe("derivePublicCode", () => {
  it("pads and uppercases", () => {
    expect(derivePublicCode("ogn", 42)).toBe("OGN-042");
    expect(derivePublicCode("DEV", 1)).toBe("DEV-001");
    expect(derivePublicCode("OGN", 1234)).toBe("OGN-1234");
  });
  it("returns null without a collector number", () => {
    expect(derivePublicCode("OGN", null)).toBeNull();
  });
});

describe("client", () => {
  const opts = { apiKey: "k", region: "americas", baseDelayMs: 1 };

  it("parses Retry-After", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it("retries on 429 honouring Retry-After, then succeeds", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ sets: [] }));
    const sleep = vi.fn(async () => {});
    const body = await fetchRiotContentRaw({ ...opts, fetchImpl, sleep });
    expect(body).toEqual({ sets: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 3000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2); // exponential: 1 * 2^1
    const init = fetchImpl.mock.calls[0][1];
    expect((init?.headers as Record<string, string>)["X-Riot-Token"]).toBe("k");
  });

  it("gives up with RiotRateLimitError after max retries", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response("", { status: 429 }));
    await expect(
      fetchRiotContentRaw({ ...opts, maxRetries: 2, fetchImpl, sleep: async () => {} }),
    ).rejects.toBeInstanceOf(RiotRateLimitError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("maps 403 to RiotAccessError without retrying", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 403 }));
    await expect(fetchRiotContentRaw({ ...opts, fetchImpl })).rejects.toBeInstanceOf(RiotAccessError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
