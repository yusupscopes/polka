import { auth } from "@clerk/nextjs/server"
import { format } from "date-fns"
import { BotIcon, MonitorIcon } from "lucide-react"
import Link from "next/link"

import { ResetCountdown } from "@/components/reset-countdown"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { SANDBOX_AUTO_STOP_MINUTES } from "@/lib/billing"
import { getUsageStatus } from "@/lib/usage"

export default async function Page() {
  const { userId } = await auth.protect()
  const usage = await getUsageStatus(userId)

  if (!usage) {
    return (
      <div className="flex min-h-svh p-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No usage to show</EmptyTitle>
            <EmptyDescription>
              Pro comes with a monthly allowance of AI and sandbox time for your
              bots. Upgrade to start using it.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="secondary" render={<Link href="/pricing" />}>
              See plans
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const { period, used } = usage
  const ai = percent(used.aiNanos, period.allowance.aiNanos)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">
          What your bots have used this billing period. It resets in{" "}
          <span className="font-medium text-foreground">
            <ResetCountdown end={period.end} />
          </span>
          , on {format(period.end, "MMMM d 'at' h:mm a")}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This period</CardTitle>
          <CardDescription>
            {format(period.start, "MMM d")} to {format(period.end, "MMM d")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Meter
            icon={<BotIcon />}
            label="AI"
            value={ai}
            detail={`${compact(used.aiTokens)} tokens. Longer chats and screenshots use more.`}
          />
          <Meter
            icon={<MonitorIcon />}
            label="Sandbox time"
            value={percent(
              used.sandboxSeconds,
              period.allowance.sandboxSeconds
            )}
            detail={`${hours(used.sandboxSeconds)} of ${hours(period.allowance.sandboxSeconds)}. A sandbox runs while your bot works or you watch its screen, and for ${SANDBOX_AUTO_STOP_MINUTES} minutes after.`}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Meter({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Progress value={value}>
        <ProgressLabel className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {label}
        </ProgressLabel>
        {/* Progress.Value only formats with a function, which can't cross
            from a server component. */}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {value >= 100 ? "Used up" : `${Math.round(value)}% used`}
        </span>
      </Progress>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function percent(used: number, allowance: number) {
  return Math.min(100, (used / allowance) * 100)
}

function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n)
}

function hours(seconds: number) {
  const h = seconds / 3600
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`
}
