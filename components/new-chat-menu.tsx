"use client"

import * as React from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Bot } from "@/lib/db/schema"

function NewChatMenu({ bots }: { bots: Bot[] }) {
  // The dialogs live outside the menu, which unmounts its items when it closes.
  const [botOpen, setBotOpen] = React.useState(false)
  const [groupOpen, setGroupOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="New"
              className="group-data-[collapsible=icon]:size-12"
            />
          }
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem onClick={() => setBotOpen(true)}>
            <PlusIcon />
            Create new bot
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setGroupOpen(true)}>
            <UsersIcon />
            Create group chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog open={botOpen} onOpenChange={setBotOpen} />
      <GroupChatDialog
        bots={bots}
        open={groupOpen}
        onOpenChange={setGroupOpen}
      />
    </>
  )
}

export { NewChatMenu }
