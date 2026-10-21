"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  bots,
  insertBotSchema,
  type Bot,
  type InsertBot,
} from "@/lib/db/schema"

type CreateBotResult = { bot: Bot } | { error: string }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the form and try again." }

  const { instructions, ...rest } = parsed.data
  const [bot] = await db
    .insert(bots)
    .values({ ...rest, instructions: instructions || null, userId })
    .returning()

  revalidatePath("/")
  return { bot }
}
