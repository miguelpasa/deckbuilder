import type { NextRequest } from "next/server";

import { requireUserForApi } from "@/lib/auth/session";
import { findCards } from "@/lib/cards/search";

export async function GET(req: NextRequest) {
  const { response } = await requireUserForApi();
  if (response) return response;
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const found = await findCards(q, 8);
  return Response.json({
    results: found.map((c) => ({
      id: c.id,
      code: c.publicCode,
      name: c.name,
      type: c.type,
      faction: c.faction,
      setId: c.setId,
      isPlaceholder: c.isPlaceholder,
      printings: c.printings.map((p) => ({ id: p.id, variant: p.variant })),
    })),
  });
}
