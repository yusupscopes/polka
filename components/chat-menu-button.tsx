"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { SidebarMenuButton } from "@/components/ui/sidebar"

export function ChatMenuButton({
  chatId,
  tooltip,
  children,
}: {
  chatId: string
  tooltip: string
  children: React.ReactNode
}) {
  const params = useParams<{ chatId?: string }>()
  const isActive = params.chatId === chatId

  return (
    // Collapsed, the button keeps its expanded height and padding, so the avatar stays full size.
    <SidebarMenuButton
      size="lg"
      tooltip={tooltip}
      isActive={isActive}
      className="group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:p-2!"
      render={
        <Link
          href={`/chats/${chatId}`}
          aria-current={isActive ? "page" : undefined}
        />
      }
    >
      {children}
    </SidebarMenuButton>
  )
}
