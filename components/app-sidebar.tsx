import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"
import Link from "next/link"

import { ChatAvatar } from "@/components/chat-avatar"
import { ChatSearch } from "@/components/chat-search"
import { NewChatMenu } from "@/components/new-chat-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getChats } from "@/queries/bots"

export async function AppSidebar() {
  const chats = await getChats()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex justify-end">
          <NewChatMenu />
        </div>
        <ChatSearch
          chats={chats.flatMap((chat) => {
            const bot = chat.members[0]?.bot
            if (!bot) return []
            return [
              { id: chat.id, name: chat.name ?? bot.name, avatar: bot.avatar },
            ]
          })}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {chats.map((chat) => {
              // Group chats aren't handled yet, so show the first bot.
              const bot = chat.members[0]?.bot
              if (!bot) return null
              return (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    size="lg"
                    render={<Link href={`/chats/${chat.id}`} />}
                  >
                    <ChatAvatar seed={bot.avatar} />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-medium">
                          {chat.name ?? bot.name}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(chat.lastMessageAt)}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.lastMessagePreview ?? bot.job}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* UserButton renders its own <button>, so the menu button is a div and the trigger fills it. */}
            <SidebarMenuButton render={<div />} size="lg" className="p-0">
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "size-full",
                    userButtonTrigger:
                      "size-full rounded-md p-2 focus:shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    userButtonBox:
                      "w-full min-w-0 flex-row-reverse justify-end gap-4",
                    userButtonAvatarBox: "size-8 rounded-lg",
                    userButtonOuterIdentifier:
                      "truncate ps-0 text-sm font-medium text-sidebar-foreground",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
