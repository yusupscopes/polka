"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"
import { MonitorIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { createContext, use, useEffect, useRef, useState } from "react"
import { usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"

import { getDesktopUrl } from "@/actions/desktop"
import { useErrorToast } from "@/components/error-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ResizablePanel } from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"

const DesktopPanelContext = createContext<{
  panelRef: React.RefObject<PanelImperativeHandle | null>
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
} | null>(null)

function useDesktopPanel() {
  const context = use(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider.")
  }
  return context
}

// Shares the panel handle between the header toggle and the panel, which sit
// in different parts of the server-rendered page.
export function DesktopPanelProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const panelRef = usePanelRef()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <DesktopPanelContext value={{ panelRef, collapsed, setCollapsed }}>
      {children}
    </DesktopPanelContext>
  )
}

export function DesktopPanel({
  chatId,
  name,
  ...props
}: React.ComponentProps<typeof ResizablePanel> & {
  chatId: string
  name: string
}) {
  const { panelRef, collapsed, setCollapsed } = useDesktopPanel()
  const [desktop, setDesktop] = useState<
    { url: string } | { error: string } | null
  >(null)
  const [connecting, setConnecting] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const panelSlotRef = useRef<HTMLDivElement>(null)
  const dialogSlotRef = useRef<HTMLDivElement>(null)
  const showError = useErrorToast()

  async function connect() {
    setConnecting(true)
    const result = await getDesktopUrl(chatId)
    if ("upgrade" in result) showError(result)
    setDesktop(result)
    setConnecting(false)
  }

  // There's one viewer for both the panel and the dialog. Moving an iframe in
  // the DOM reloads it and drops the VNC session, so it stays put and follows
  // whichever slot is showing instead.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    let request: number
    let last = ""
    const follow = () => {
      request = requestAnimationFrame(follow)
      const slot = fullscreen ? dialogSlotRef.current : panelSlotRef.current
      const rect = slot?.getBoundingClientRect()
      const shown =
        rect && rect.width > 0 && rect.height > 0 && (fullscreen || !collapsed)
      const next = shown
        ? `${rect.left},${rect.top},${rect.width},${rect.height}`
        : ""
      if (next === last) return
      last = next
      frame.style.visibility = shown ? "visible" : "hidden"
      if (!shown) return
      frame.style.left = `${rect.left}px`
      frame.style.top = `${rect.top}px`
      frame.style.width = `${rect.width}px`
      frame.style.height = `${rect.height}px`
    }
    follow()
    return () => cancelAnimationFrame(request)
  }, [desktop, fullscreen, collapsed])

  const url = desktop && "url" in desktop ? desktop.url : null

  return (
    <ResizablePanel
      panelRef={panelRef}
      collapsible
      defaultSize={0}
      minSize="30%"
      onResize={() => {
        const isCollapsed = panelRef.current?.isCollapsed() ?? true
        setCollapsed(isCollapsed)
        // Don't wake the sandbox until someone opens the panel, then keep the
        // viewer connected while it's collapsed.
        if (!isCollapsed && desktop === null && !connecting) connect()
      }}
      className="flex flex-col"
      {...props}
    >
      <Dialog
        open={fullscreen}
        onOpenChange={(open, { reason }) => {
          // Keys and clicks belong to the desktop while it's full screen, so
          // only the close button closes it.
          if (open || reason === "close-press") setFullscreen(open)
        }}
      >
        <div className="flex h-10 shrink-0 items-center justify-end border-b px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reconnect"
            disabled={connecting}
            onClick={connect}
          >
            <RefreshCwIcon />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 p-4">
          <DialogTrigger
            disabled={!url}
            aria-label={`Open ${name}'s screen`}
            className="w-full max-w-[calc((100svh-8rem)*4/3)] cursor-pointer rounded-xl border bg-muted p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
          >
            <div
              ref={panelSlotRef}
              className="flex aspect-4/3 items-center justify-center rounded-md bg-background text-sm text-muted-foreground"
            >
              {connecting ? (
                <Spinner />
              ) : (
                desktop && "error" in desktop && desktop.error
              )}
            </div>
          </DialogTrigger>
          <p className="text-sm text-muted-foreground">{name}&apos;s screen</p>
        </div>
        <DialogPortal keepMounted>
          <DialogOverlay />
          <DialogPrimitive.Popup
            data-slot="dialog-content"
            initialFocus={frameRef}
            className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-2rem),calc((100svh-6rem)*4/3))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-xl bg-popover p-3 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="flex items-center justify-between gap-2 pl-1">
              <DialogTitle>{name}&apos;s screen</DialogTitle>
              <DialogClose
                render={<Button type="button" variant="ghost" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            <div
              ref={dialogSlotRef}
              className="aspect-4/3 rounded-md bg-background"
            />
          </DialogPrimitive.Popup>
          {/* Inside the dialog's portal, so the dialog treats it as its own
              content rather than hiding it from assistive tech. */}
          {url && (
            <iframe
              ref={frameRef}
              src={url}
              title={`${name}'s screen`}
              allow="clipboard-read; clipboard-write"
              // In the panel it's a preview: clicks fall through to the
              // trigger underneath.
              inert={!fullscreen}
              className={cn(
                "invisible fixed z-50 rounded-md border-0",
                !fullscreen && "pointer-events-none"
              )}
            />
          )}
        </DialogPortal>
      </Dialog>
    </ResizablePanel>
  )
}

export function DesktopPanelToggle() {
  const { panelRef, collapsed } = useDesktopPanel()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Desktop"
      aria-pressed={!collapsed}
      className="ml-auto"
      onClick={() =>
        collapsed ? panelRef.current?.expand() : panelRef.current?.collapse()
      }
    >
      <MonitorIcon />
    </Button>
  )
}
