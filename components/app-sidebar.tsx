import { formatDistanceToNowStrict } from "date-fns"

import { ChatMenuButton } from "@/components/chat-menu-button"
import { ChatSearch } from "@/components/chat-search"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { NewChatMenu } from "@/components/new-chat-menu"
import { UserMenu } from "@/components/user-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getBots } from "@/queries/bots"
import { getChats } from "@/queries/chats"

export async function AppSidebar() {
  const [chats, bots] = await Promise.all([getChats(), getBots()])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end">
          <NewChatMenu bots={bots} />
        </div>
        <ChatSearch
          chats={chats.flatMap((chat) => {
            const bot = chat.members[0]?.bot
            if (!bot) return []
            return [
              {
                id: chat.id,
                name: chat.name ?? bot.name,
                avatars: chat.members.map((member) => member.bot.avatar),
              },
            ]
          })}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {chats.map((chat) => {
              // A direct chat is named after its only bot.
              const bot = chat.members[0]?.bot
              if (!bot) return null
              return (
                <SidebarMenuItem key={chat.id}>
                  <ChatMenuButton
                    chatId={chat.id}
                    tooltip={chat.name ?? bot.name}
                  >
                    <GroupChatAvatar
                      seeds={chat.members.map((member) => member.bot.avatar)}
                    />
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
                        {chat.lastMessagePreview ??
                          (chat.kind === "group"
                            ? chat.members.map((m) => m.bot.name).join(", ")
                            : bot.job)}
                      </span>
                    </div>
                  </ChatMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* The user menu renders its own <button>, so the menu button is a div and the trigger fills it. */}
            <SidebarMenuButton
              render={<div />}
              size="lg"
              className="p-0 group-data-[collapsible=icon]:size-12!"
            >
              <UserMenu />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
