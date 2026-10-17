// Define tables here, then run `npm run db:push`.
// https://orm.drizzle.team/docs/sql-schema-declaration
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const todos = pgTable(
  "todos",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // Clerk user ID of the owner
    userId: text("user_id").notNull(),
    title: text().notNull(),
    completed: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("todos_user_id_idx").on(t.userId)]
)

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert
