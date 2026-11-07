import { BotDialog } from "@/components/bot-dialog"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { Bot, Chat } from "@/lib/db/schema"

export function ChatHeader({
  name,
  kind,
  bots,
}: {
  name: string
  kind: Chat["kind"]
  bots: Bot[]
}) {
  // A direct chat's one bot can be edited from the header, and its desktop
  // shown. Group chats have neither.
  const bot = kind === "direct" ? bots[0] : undefined
  const title = (
    <>
      <GroupChatAvatar
        seeds={bots.map((bot) => bot.avatar)}
        className="size-5"
      />
      <span className="truncate">{name}</span>
    </>
  )

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="-ml-2 max-w-sm min-w-0">
        {bot ? (
          <BotDialog bot={bot}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-w-full gap-2 px-2 text-sm"
            >
              {title}
            </Button>
          </BotDialog>
        ) : (
          <div className="flex max-w-full items-center gap-2 px-2 text-sm font-medium">
            {title}
          </div>
        )}
      </h1>
      {bot && <DesktopPanelToggle />}
    </header>
  )
}
