import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { getChat } from "@/queries/chats"

export default async function Page({ params }: PageProps<"/chats/[chatId]">) {
  const { chatId } = await params
  const chat = await getChat(chatId)

  // Group chats aren't handled yet, so show the first bot.
  const bot = chat?.members[0]?.bot
  if (!chat || !bot) notFound()

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader name={chat.name ?? bot.name} bot={bot} />
      <Chat id={chat.id} />
    </div>
  )
}
