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

  const bots = chat?.members.map((member) => member.bot) ?? []
  if (!chat || bots.length === 0) notFound()

  // A direct chat is named after its only bot.
  const name = chat.name ?? bots[0].name
  const header = <ChatHeader name={name} kind={chat.kind} bots={bots} />

  // Group chats have no desktop, since each bot has its own.
  if (chat.kind === "group") {
    return (
      <div className="flex h-svh flex-col">
        {header}
        <Chat id={chat.id} bots={bots} />
      </div>
    )
  }

  return (
    <DesktopPanelProvider>
      {/* The group sets an inline height: 100%, which beats a height class on
          it, so the viewport height goes on a wrapper instead. */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel minSize="30%" className="flex flex-col">
            {header}
            <Chat id={chat.id} bots={bots} />
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel chatId={chat.id} name={bots[0].name} />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
