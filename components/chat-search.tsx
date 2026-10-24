"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

type ChatSearchItem = { id: string; name: string; avatar: string }

function ChatSearch({ chats }: { chats: ChatSearchItem[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {/* Looks like the Input, but keeps the outline button's hover. */}
      <Button
        variant="outline"
        className="h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <KbdGroup className="ml-auto">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Find a chat by name."
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                // Names can repeat, so match on the id plus the name.
                <CommandItem
                  key={chat.id}
                  value={chat.id}
                  keywords={[chat.name]}
                  onSelect={() => {
                    setOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  <ChatAvatar seed={chat.avatar} className="size-6" />
                  {chat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export { ChatSearch }
