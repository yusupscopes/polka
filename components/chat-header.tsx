import { BotDialog } from "@/components/bot-dialog"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { Bot, Chat } from "@/lib/db/schema"

export function ChatHeader({
  chat,
  name,
  bots,
  allBots,
}: {
  chat: Chat
  name: string
  // The chat's members.
  bots: Bot[]
  // All the user's bots, to pick group members from.
  allBots: Bot[]
}) {
  // A direct chat's one bot is edited from the header, and its desktop shown.
  // A group chat edits the group instead, and has no desktop.
  const bot = chat.kind === "direct" ? bots[0] : undefined
  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="max-w-full gap-2 px-2 text-sm"
    >
      <GroupChatAvatar
        seeds={bots.map((bot) => bot.avatar)}
        className="size-5"
      />
      <span className="truncate">{name}</span>
    </Button>
  )

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="-ml-2 max-w-sm min-w-0">
        {bot ? (
          <BotDialog bot={bot}>{trigger}</BotDialog>
        ) : (
          <GroupChatDialog
            bots={allBots}
            chat={{ id: chat.id, name, botIds: bots.map((bot) => bot.id) }}
          >
            {trigger}
          </GroupChatDialog>
        )}
      </h1>
      {bot && <DesktopPanelToggle />}
    </header>
  )
}
