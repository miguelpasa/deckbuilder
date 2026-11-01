import { getCurrentUser } from "@/lib/auth/session";
import { exportDeckJson } from "@/lib/decks/service";

/** Downloads a deck as riftbound-deck JSON (public card codes and counts only). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const out = await exportDeckJson(id, user?.id ?? null);
  if (!out) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(out.json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${out.filename}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
