// Define tables here, then run `npm run db:push`.
// https://orm.drizzle.team/docs/sql-schema-declaration
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID of the owner
    userId: text("user_id").notNull(),
    name: text().notNull(),
    // Seed for the bot's generated face
    avatar: text()
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text().notNull(),
    // How it should go about the job
    instructions: text(),
    // Sandbox provider ID, created lazily
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bots_user_id_idx").on(t.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

// Fields a user fills in when creating a bot. The server sets userId.
export const insertBotSchema = createInsertSchema(bots, {
  name: (s) => s.trim().min(1, "Give your bot a name.").max(50),
  avatar: z.string().min(1),
  job: (s) => s.trim().min(1, "Say what your bot is for.").max(80),
  instructions: z.string().trim().max(2000),
}).pick({ name: true, avatar: true, job: true, instructions: true })

export type InsertBot = z.infer<typeof insertBotSchema>
