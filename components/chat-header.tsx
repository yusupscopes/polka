import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { Bot } from "@/lib/db/schema"

export function ChatHeader({ name, bot }: { name: string; bot: Bot }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="-ml-2 min-w-0 max-w-sm">
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
      {/* Not wired up yet. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Desktop"
        className="ml-auto"
      >
        <MonitorIcon />
      </Button>
    </header>
  )
}
