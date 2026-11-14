"use client"

import { UserButton } from "@clerk/nextjs"
import { GaugeIcon } from "lucide-react"

// The account menu in the sidebar footer. A client component, since the
// server can't reach into `UserButton` for its custom menu items.
export function UserMenu() {
  return (
    <UserButton
      showName
      appearance={{
        elements: {
          rootBox: "size-full",
          userButtonTrigger:
            "size-full rounded-md p-2 focus:shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          userButtonBox: "w-full min-w-0 flex-row-reverse justify-end gap-4",
          userButtonAvatarBox: "size-8 rounded-lg",
          userButtonOuterIdentifier:
            "truncate ps-0 text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Usage"
          labelIcon={<GaugeIcon className="size-4" />}
          href="/usage"
        />
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  )
}
