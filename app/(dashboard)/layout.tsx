import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // SidebarProvider writes this cookie on every toggle.
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    // The icon rail fits a 48px menu button, the height of an expanded chat row.
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width-icon": "4rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
