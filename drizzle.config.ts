import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

loadEnvConfig(process.cwd())

// Schema pushes need the direct (non-pooled) connection.
const url = process.env.DATABASE_URL_UNPOOLED
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set")

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
