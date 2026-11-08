"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  type Chat,
  type InsertGroupChat,
} from "@/lib/db/schema"
import { getChat } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// The chat id comes from the browser, so check the signed-in user owns it.
async function assertChatOwner(chatId: string) {
  const owned = await getChat(chatId)
  if (!owned) throw new Error("Chat not found.")
}

export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertChatOwner(params.chatId)
  return start(params)
}

export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadTranscript(params: { chatId: string }) {
  await assertChatOwner(params.chatId)
  return load({ chatId: params.chatId })
}

type CreateGroupChatResult = { chat: Chat } | { error: string }

export async function createGroupChat(
  input: InsertGroupChat
): Promise<CreateGroupChatResult> {
  const { userId } = await clerkAuth.protect()

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the form and try again." }

  const { name, botIds } = parsed.data

  // The ids come from the browser, so only add bots the user owns.
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
  if (owned.length !== new Set(botIds).size) {
    return { error: "Some of those bots no longer exist." }
  }

  const chat = await db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name })
      .returning()
    await tx
      .insert(chatMembers)
      .values(owned.map((bot) => ({ chatId: chat.id, botId: bot.id })))
    return chat
  })

  revalidatePath("/")
  return { chat }
}

type UpdateGroupChatResult = { chat: Chat } | { error: string }

export async function updateGroupChat(
  chatId: string,
  input: InsertGroupChat
): Promise<UpdateGroupChatResult> {
  const { userId } = await clerkAuth.protect()

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the form and try again." }

  const { name, botIds } = parsed.data

  // The ids come from the browser, so only add bots the user owns.
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
  if (owned.length !== new Set(botIds).size) {
    return { error: "Some of those bots no longer exist." }
  }

  const chat = await db.transaction(async (tx) => {
    const [chat] = await tx
      .update(chats)
      .set({ name })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "group")
        )
      )
      .returning()
    if (!chat) return undefined

    // Bots that stay keep their join time, so the member order holds.
    await tx.delete(chatMembers).where(
      and(
        eq(chatMembers.chatId, chatId),
        notInArray(
          chatMembers.botId,
          owned.map((bot) => bot.id)
        )
      )
    )
    await tx
      .insert(chatMembers)
      .values(owned.map((bot) => ({ chatId, botId: bot.id })))
      .onConflictDoNothing()
    return chat
  })
  if (!chat) return { error: "That group chat no longer exists." }

  // The name and faces show in the sidebar and on the chat page.
  revalidatePath("/", "layout")
  return { chat }
}

type DeleteGroupChatResult = { chat: Chat } | { error: string }

export async function deleteGroupChat(
  chatId: string
): Promise<DeleteGroupChatResult> {
  const { userId } = await clerkAuth.protect()

  // Direct chats go only with their bot, so only group chats are deleted here.
  const [chat] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning()
  if (!chat) return { error: "That group chat no longer exists." }

  revalidatePath("/", "layout")
  return { chat }
}
