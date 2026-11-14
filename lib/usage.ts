import "server-only"

import { createClerkClient } from "@clerk/backend"
// Not @sentry/nextjs: the Trigger.dev worker imports this file too. Both
// SDKs share one client, so logs reach whichever one is initialized.
import { logger } from "@sentry/node"
import type { LanguageModelUsage } from "ai"
import { formatDistanceToNowStrict } from "date-fns"
import { and, eq, gte, sql } from "drizzle-orm"

import {
  BOTS,
  MODEL_PRICE,
  MONTHLY_ALLOWANCE,
  SANDBOX_AUTO_STOP_MINUTES,
  SANDBOX_PRICE_NANOS_PER_SECOND,
  SANDBOXES,
} from "@/lib/billing"
import { db } from "@/lib/db"
import { bots, usageEvents } from "@/lib/db/schema"

// The Trigger.dev worker checks usage too and runs outside Next.js, so this
// uses the plain backend client rather than `@clerk/nextjs/server`.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export type UsagePeriod = {
  start: Date
  end: Date
  allowance: typeof MONTHLY_ALLOWANCE
}

export type Usage = {
  aiTokens: number
  aiNanos: number
  sandboxSeconds: number
}

export type UsageStatus = {
  period: UsagePeriod
  used: Usage
  aiLeft: boolean
  sandboxLeft: boolean
}

const PLANS_TTL_MS = 5 * 60 * 1000
let plans: { ids: Promise<Set<string>>; fetchedAt: number } | undefined

// Plans that include both features. A subscription's own copy of its plan
// comes without features, so they're read from the plan list, which rarely
// changes.
function getPlansWithFeatures() {
  if (!plans || Date.now() - plans.fetchedAt > PLANS_TTL_MS) {
    const ids = clerk.billing.getPlanList().then(({ data }) => {
      const has = (plan: (typeof data)[number], slug: string) =>
        plan.features.some((feature) => feature.slug === slug)
      return new Set(
        data
          .filter((plan) => has(plan, BOTS) && has(plan, SANDBOXES))
          .map((plan) => plan.id)
      )
    })
    // Don't keep a failed fetch around.
    ids.catch(() => (plans = undefined))
    plans = { ids, fetchedAt: Date.now() }
  }
  return plans.ids
}

// The current period of the user's paid subscription, or null without one.
// Usage resets when Clerk renews the subscription and starts a new period.
export async function getUsagePeriod(
  userId: string
): Promise<UsagePeriod | null> {
  const [subscription, planIds] = await Promise.all([
    clerk.billing.getUserBillingSubscription(userId).catch((err: unknown) => {
      // A user who never picked a plan has no subscription at all.
      if ((err as { status?: number }).status === 404) return null
      throw err
    }),
    getPlansWithFeatures(),
  ])
  const item = subscription?.subscriptionItems.find(
    (item) =>
      item.status === "active" &&
      item.periodEnd !== null &&
      item.planId !== null &&
      planIds.has(item.planId)
  )
  if (!item?.periodEnd) return null

  const months = item.planPeriod === "annual" ? 12 : 1
  return {
    start: new Date(item.periodStart),
    end: new Date(item.periodEnd),
    allowance: {
      aiNanos: MONTHLY_ALLOWANCE.aiNanos * months,
      sandboxSeconds: MONTHLY_ALLOWANCE.sandboxSeconds * months,
    },
  }
}

// What the user ran up since the period started.
export async function getUsage(userId: string, since: Date): Promise<Usage> {
  const rows = await db
    .select({
      meter: usageEvents.meter,
      quantity: sql<string>`coalesce(sum(${usageEvents.quantity}), 0)`,
      costNanos: sql<string>`coalesce(sum(${usageEvents.costNanos}), 0)`,
    })
    .from(usageEvents)
    .where(
      and(eq(usageEvents.userId, userId), gte(usageEvents.createdAt, since))
    )
    .groupBy(usageEvents.meter)

  const ai = rows.find((row) => row.meter === "ai")
  const sandbox = rows.find((row) => row.meter === "sandbox")
  return {
    aiTokens: Number(ai?.quantity ?? 0),
    aiNanos: Number(ai?.costNanos ?? 0),
    sandboxSeconds: Number(sandbox?.quantity ?? 0),
  }
}

// The period and what's left of it, or null without a paid subscription.
export async function getUsageStatus(
  userId: string
): Promise<UsageStatus | null> {
  const period = await getUsagePeriod(userId)
  if (!period) return null
  const used = await getUsage(userId, period.start)
  return {
    period,
    used,
    aiLeft: used.aiNanos < period.allowance.aiNanos,
    sandboxLeft: used.sandboxSeconds < period.allowance.sandboxSeconds,
  }
}

export function aiLimitMessage(period: UsagePeriod) {
  return `You've used this period's AI allowance. It resets in ${formatDistanceToNowStrict(period.end)}.`
}

export function sandboxLimitMessage(period: UsagePeriod) {
  return `You've used this period's sandbox time. It resets in ${formatDistanceToNowStrict(period.end)}.`
}

// What a model call cost, in billionths of a dollar. OpenAI doesn't charge
// extra for cache writes, so those count as plain input.
export function aiCostNanos(usage: LanguageModelUsage) {
  const input = usage.inputTokens ?? 0
  const cached = usage.inputTokenDetails.cacheReadTokens ?? 0
  const output = usage.outputTokens ?? 0
  return (
    (input - cached) * MODEL_PRICE.inputNanos +
    cached * MODEL_PRICE.cachedInputNanos +
    output * MODEL_PRICE.outputNanos
  )
}

export async function recordAiUsage({
  userId,
  botId,
  chatId,
  usage,
}: {
  userId: string
  botId: string
  chatId: string
  usage: LanguageModelUsage
}) {
  const quantity = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  if (quantity === 0) return
  await db.insert(usageEvents).values({
    userId,
    meter: "ai",
    quantity,
    costNanos: aiCostNanos(usage),
    botId,
    chatId,
  })
}

const AUTO_STOP_MS = SANDBOX_AUTO_STOP_MINUTES * 60 * 1000
// Activity resets Daytona's auto-stop timer, so each use pushes the charge
// out to a new auto-stop time. Pushes shorter than this are skipped, so a
// burst of tool calls doesn't write a row each. It undercharges a run by at
// most this much.
const MIN_EXTENSION_MS = 60 * 1000

// Charges a bot's sandbox for running until it would next auto-stop. Call it
// whenever the sandbox is used, since Daytona bills by the second from start
// to stop and every use keeps it running longer. Charging ahead means usage
// can pass the allowance by at most one auto-stop interval.
export async function chargeSandbox({
  userId,
  botId,
  chatId,
}: {
  userId: string
  botId: string
  chatId?: string
}) {
  await db.transaction(async (tx) => {
    // Locked, so parallel tool calls don't both charge the same stretch.
    const [bot] = await tx
      .select({ billedUntil: bots.sandboxBilledUntil })
      .from(bots)
      .where(eq(bots.id, botId))
      .for("update")
    if (!bot) return

    const now = Date.now()
    const billedUntil = bot.billedUntil?.getTime() ?? 0
    if (billedUntil - now > AUTO_STOP_MS - MIN_EXTENSION_MS) return

    // Still running: charge the extra time. Stopped since: a new run.
    const until = now + AUTO_STOP_MS
    const seconds = Math.round((until - Math.max(billedUntil, now)) / 1000)
    await tx
      .update(bots)
      .set({ sandboxBilledUntil: new Date(until) })
      .where(eq(bots.id, botId))
    await tx.insert(usageEvents).values({
      userId,
      meter: "sandbox",
      quantity: seconds,
      costNanos: seconds * SANDBOX_PRICE_NANOS_PER_SECOND,
      botId,
      chatId,
    })
    logger.info("Sandbox charged", {
      userId,
      botId,
      ...(chatId && { chatId }),
      seconds,
      // A charge with nothing billed ahead means the sandbox was stopped.
      newRun: billedUntil <= now,
    })
  })
}
