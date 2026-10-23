"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  type Bot,
  type Chat,
  type InsertBot,
} from "@/lib/db/schema"

type CreateBotResult = { bot: Bot; chat: Chat } | { error: string }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the form and try again." }

  const { instructions, ...rest } = parsed.data
  // Every bot starts with a direct chat, so create all three rows or none.
  const { bot, chat } = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({ ...rest, instructions: instructions || null, userId })
      .returning()
    const [chat] = await tx.insert(chats).values({ userId }).returning()
    await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })
    return { bot, chat }
  })

  revalidatePath("/")
  return { bot, chat }
}
