"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"

import {
  SANDBOXES,
  upgradeError,
  usageError,
  type UpgradeError,
  type UsageError,
} from "@/lib/billing"
import { daytona } from "@/lib/daytona"
import type { Bot } from "@/lib/db/schema"
import { chargeSandbox, getUsageStatus, sandboxLimitMessage } from "@/lib/usage"
import { getChat } from "@/queries/chats"

// Daytona serves noVNC for the sandbox desktop on this port.
const NOVNC_PORT = 6080

// Long enough for a session, but the link stays short-lived if it leaks. The
// viewer only needs it to load and to reconnect.
const URL_TTL_SECONDS = 60 * 60

type DesktopError = { error: string } | UpgradeError | UsageError

// The bot whose desktop the chat shows, once the sandbox is charged for the
// time the viewer keeps it running.
async function prepareDesktop(
  chatId: string
): Promise<{ bot: Bot } | DesktopError> {
  const { userId, has } = await auth.protect()
  if (!has({ feature: SANDBOXES })) {
    return upgradeError("Upgrade to Pro to see your bot's screen.")
  }

  const chat = await getChat(chatId)
  const bot = chat?.members[0]?.bot
  if (!chat || !bot) return { error: "That chat no longer exists." }
  // Each bot in a group has its own desktop, so there's no one to show.
  if (chat.kind === "group") return { error: "Group chats have no desktop." }

  const usage = await getUsageStatus(userId)
  if (!usage) return upgradeError("Upgrade to Pro to see your bot's screen.")
  if (!usage.sandboxLeft) {
    Sentry.logger.warn("Desktop refused: sandbox allowance used up", {
      userId,
      botId: bot.id,
      chatId,
    })
    return usageError(sandboxLimitMessage(usage.period))
  }

  await chargeSandbox({ userId, botId: bot.id, chatId })
  return { bot }
}

type GetDesktopUrlResult = { url: string } | DesktopError

// A signed noVNC link to the desktop of the chat's bot, starting the sandbox
// and its desktop if they've stopped.
export async function getDesktopUrl(
  chatId: string
): Promise<GetDesktopUrlResult> {
  const result = await prepareDesktop(chatId)
  if (!("bot" in result)) return result
  const { bot } = result

  try {
    const startedAt = Date.now()
    const sandbox = await daytona.get(bot.sandboxId)
    const sandboxState = sandbox.state ?? "unknown"
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

    Sentry.logger.info("Desktop opened", {
      botId: bot.id,
      chatId,
      sandboxId: bot.sandboxId,
      sandboxState,
      desktopStatus: status,
      durationMs: Date.now() - startedAt,
    })
    return { url: viewer.toString() }
  } catch (err) {
    Sentry.logger.error("Failed to open the desktop", {
      botId: bot.id,
      chatId,
      sandboxId: bot.sandboxId,
      error: String(err),
    })
    return { error: "Couldn't reach the desktop. Try again." }
  }
}

type KeepDesktopResult = { ok: true } | DesktopError

// Called every minute while the viewer is connected. Its traffic can keep the
// sandbox from auto-stopping, so that time is charged too. Out of time, the
// viewer disconnects.
export async function keepDesktop(chatId: string): Promise<KeepDesktopResult> {
  const result = await prepareDesktop(chatId)
  if (!("bot" in result)) return result
  return { ok: true }
}
