import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots } from "@/lib/db/schema"

// The signed-in user's bots, oldest first.
export async function getBots() {
  const { userId } = await auth.protect()

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
  })
}
