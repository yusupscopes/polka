"use server"

import { auth } from "@clerk/nextjs/server"

import { SANDBOXES, upgradeError, type UpgradeError } from "@/lib/billing"
import { daytona } from "@/lib/daytona"
import { getChat } from "@/queries/chats"

// Daytona serves noVNC for the sandbox desktop on this port.
const NOVNC_PORT = 6080

// Long enough for a session, but the link stays short-lived if it leaks. The
// viewer only needs it to load and to reconnect.
const URL_TTL_SECONDS = 60 * 60

type GetDesktopUrlResult = { url: string } | { error: string } | UpgradeError

// A signed noVNC link to the desktop of the chat's bot, starting the sandbox
// and its desktop if they've stopped.
export async function getDesktopUrl(
  chatId: string
): Promise<GetDesktopUrlResult> {
  const { has } = await auth.protect()
  if (!has({ feature: SANDBOXES })) {
    return upgradeError("Upgrade to Pro to see your bot's screen.")
  }

  const chat = await getChat(chatId)
  const bot = chat?.members[0]?.bot
  if (!chat || !bot) return { error: "That chat no longer exists." }
  // Each bot in a group has its own desktop, so there's no one to show.
  if (chat.kind === "group") return { error: "Group chats have no desktop." }

  try {
    const sandbox = await daytona.get(bot.sandboxId)
    if (sandbox.state !== "started") await sandbox.start()
    const { status } = await sandbox.computerUse.getStatus()
    if (status !== "active") await sandbox.computerUse.start()

    const { url } = await sandbox.getSignedPreviewUrl(
      NOVNC_PORT,
      URL_TTL_SECONDS
    )
    const viewer = new URL("/vnc.html", url)
    viewer.search = new URLSearchParams({
      autoconnect: "true",
      reconnect: "true",
      resize: "scale",
    }).toString()
    return { url: viewer.toString() }
  } catch (err) {
    console.error(`Failed to open the desktop of sandbox ${bot.sandboxId}`, err)
    return { error: "Couldn't reach the desktop. Try again." }
  }
}
