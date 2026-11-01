import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // env may already be provided by the shell / CI
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
