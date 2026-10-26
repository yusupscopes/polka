"use server"

import { auth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"

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
