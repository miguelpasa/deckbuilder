// Dev helper: npx tsx --env-file=.env scripts/set-visibility.ts <email> <PRIVATE|LINK|PUBLIC>
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

async function main() {
  const [email, vis] = process.argv.slice(2) as [string, "PRIVATE" | "LINK" | "PUBLIC"];
  const r = await db.execute(sql`select id from neon_auth."user" where email = ${email} limit 1`);
  const id = (r.rows[0] as { id: string } | undefined)?.id;
  if (!id) throw new Error("user not found");
  const [p] = await db
    .update(profiles)
    .set({ collectionVisibility: vis })
    .where(eq(profiles.userId, id))
    .returning();
  console.log(p ? `${vis} token=${p.shareToken}` : "no profile row");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

export {};
