import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getChat } from "@/queries/chats"

export default async function Page({ params }: PageProps<"/chats/[chatId]">) {
  const { chatId } = await params
  const chat = await getChat(chatId)

  // Group chats aren't handled yet, so show the first bot.
  const bot = chat?.members[0]?.bot
  if (!chat || !bot) notFound()

  return (
    <DesktopPanelProvider>
      {/* The group sets an inline height: 100%, which beats a height class on
          it, so the viewport height goes on a wrapper instead. */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel minSize="30%" className="flex flex-col">
            <ChatHeader name={chat.name ?? bot.name} bot={bot} />
            <Chat id={chat.id} />
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel chatId={chat.id} name={bot.name} />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
