"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
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

type UpdateBotResult = { bot: Bot } | { error: string }

export async function updateBot(
  botId: string,
  input: InsertBot
): Promise<UpdateBotResult> {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the form and try again." }

  const { instructions, ...rest } = parsed.data
  const [bot] = await db
    .update(bots)
    .set({ ...rest, instructions: instructions || null })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()
  if (!bot) return { error: "That bot no longer exists." }

  // The name and face show in the sidebar and on every chat page.
  revalidatePath("/", "layout")
  return { bot }
}

type DeleteBotResult = { bot: Bot } | { error: string }

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { userId } = await auth.protect()

  // A direct chat is pointless without its bot, so it goes too. Group chats
  // just lose the member.
  const bot = await db.transaction(async (tx) => {
    const memberships = await tx
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(and(eq(chatMembers.botId, botId), eq(chats.kind, "direct")))
    const [bot] = await tx
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning()
    if (bot && memberships.length > 0) {
      await tx.delete(chats).where(
        and(
          inArray(
            chats.id,
            memberships.map((m) => m.chatId)
          ),
          eq(chats.userId, userId)
        )
      )
    }
    return bot
  })
  if (!bot) return { error: "That bot no longer exists." }

  revalidatePath("/", "layout")
  return { bot }
}
