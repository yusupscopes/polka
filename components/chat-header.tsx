import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { Button } from "@/components/ui/button"
import type { Bot } from "@/lib/db/schema"

export function ChatHeader({ name, bot }: { name: string; bot: Bot }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="-ml-2 max-w-sm min-w-0">
        <BotDialog bot={bot}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-full gap-2 px-2 text-sm"
          >
            <ChatAvatar seed={bot.avatar} className="size-5" />
            <span className="truncate">{name}</span>
          </Button>
        </BotDialog>
      </h1>
      <DesktopPanelToggle />
    </header>
  )
}
