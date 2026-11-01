import { requireUserForApi } from "@/lib/auth/session";
import { exportCollectionJson } from "@/lib/collection/service";

export async function GET() {
  const { user, response } = await requireUserForApi();
  if (response) return response;
  const body = await exportCollectionJson(user.id);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="riftbound-collection.json"',
      "Cache-Control": "no-store",
    },
  });
}
