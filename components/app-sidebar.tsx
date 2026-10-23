import { UserButton } from "@clerk/nextjs"

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

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup />
        <SidebarGroup />
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
