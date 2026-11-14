"use client"

import { useEffect, useState } from "react"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "3d 4h 12m" until the period ends, ticking every minute.
export function ResetCountdown({ end }: { end: Date }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(timer)
  }, [])

  const left = Math.max(0, end.getTime() - now)
  const days = Math.floor(left / DAY)
  const hours = Math.floor((left % DAY) / HOUR)
  const minutes = Math.floor((left % HOUR) / MINUTE)
  const text = [
    days > 0 && `${days}d`,
    (days > 0 || hours > 0) && `${hours}h`,
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    // The server renders a minute or so earlier than the browser hydrates.
    <time
      dateTime={end.toISOString()}
      suppressHydrationWarning
      className="tabular-nums"
    >
      {text}
    </time>
  )
}
