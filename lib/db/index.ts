import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __deckbuilderPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString, max: 10 });
  attachDatabasePool(pool);
  return pool;
}

export const pool: Pool = (globalForDb.__deckbuilderPool ??= createPool());

export const db = drizzle(pool, { schema });

export type Db = typeof db;
