import { toCollectionJson } from "@/lib/share/schema";
import { getSharedCollection } from "@/lib/social/service";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const shared = await getSharedCollection(token);
  // Same response for unknown tokens and PRIVATE collections: don't leak existence.
  if (!shared) return Response.json({ error: "Not found" }, { status: 404 });

  // Codes, variants and quantities only (no card text or art).
  const body = toCollectionJson(
    shared.entries.map((e) => ({ code: e.code, variant: e.variant, qty: e.qty })),
    { owner: shared.profile.displayName, exportedAt: new Date() },
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="riftbound-collection.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
