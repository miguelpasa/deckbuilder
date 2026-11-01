import { timingSafeEqual } from "node:crypto";
import { syncCatalog } from "@/lib/riot/sync";

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await syncCatalog();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const e = err as { name?: string; status?: number; message?: string };
    return Response.json(
      { ok: false, error: e.name ?? "Error", status: e.status ?? null, message: e.message ?? "Sync failed" },
      { status: e.name === "RiotAccessError" ? 502 : 500 },
    );
  }
}
