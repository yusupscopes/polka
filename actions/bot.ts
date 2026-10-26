"use server"

import { auth } from "@clerk/nextjs/server"
import type { Sandbox } from "@daytona/sdk"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

import { daytona } from "@/lib/daytona"
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
  const botId = nanoid()

  // Every bot gets its own sandbox. Create it first so the bot row can point
  // at it.
  let sandbox: Sandbox
  try {
    sandbox = await daytona.create({ labels: { userId, botId } })
  } catch (err) {
    console.error("Failed to create sandbox", err)
    return { error: "Couldn't set up your bot. Try again." }
  }

  // Every bot starts with a direct chat, so create all three rows or none.
  try {
    const { bot, chat } = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...rest,
          id: botId,
          instructions: instructions || null,
          userId,
          sandboxId: sandbox.id,
        })
        .returning()
      const [chat] = await tx.insert(chats).values({ userId }).returning()
      await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })
      return { bot, chat }
    })

    revalidatePath("/")
    return { bot, chat }
  } catch (err) {
    // Don't leave a sandbox behind with no bot to own it.
    await deleteSandbox(sandbox.id)
    throw err
  }
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

  await deleteSandbox(bot.sandboxId)

  revalidatePath("/", "layout")
  return { bot }
}

// The bot row is already gone by the time this runs, so a failure only leaves
// an orphaned sandbox. Log it rather than failing the action.
async function deleteSandbox(sandboxId: string) {
  try {
    await daytona.delete(await daytona.get(sandboxId))
  } catch (err) {
    console.error(`Failed to delete sandbox ${sandboxId}`, err)
  }
}
