import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

// Where each item sits in the square, by how many items there are.
const layouts: Record<number, string[]> = {
  1: ["inset-0 size-full"],
  // Side by side, overlapping in the middle.
  2: [
    "top-1/2 left-0 size-[62.5%] -translate-y-1/2",
    "top-1/2 right-0 size-[62.5%] -translate-y-1/2",
  ],
  // A triangle: one on top, two below.
  3: [
    "top-0 left-1/2 size-[55%] -translate-x-1/2",
    "bottom-0 left-0 size-[55%]",
    "right-0 bottom-0 size-[55%]",
  ],
  // A 2x2 grid.
  4: [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
}

// Up to three bot faces, plus a count of the rest, in the space of one
// ChatAvatar. Size it with the same classes, e.g. `size-5`.
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  const shown = seeds.slice(0, 3)
  const rest = seeds.length - shown.length
  const slots = layouts[shown.length + (rest > 0 ? 1 : 0)] ?? []

  return (
    <div
      className={cn("@container relative size-8 shrink-0", className)}
      aria-hidden
    >
      {shown.map((seed, i) => (
        <ChatAvatar key={i} seed={seed} className={cn("absolute", slots[i])} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[22cqw] leading-none font-medium text-muted-foreground tabular-nums",
            slots[3]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
