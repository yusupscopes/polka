import { Avatar, Style } from "@dicebear/core"
import clay from "@dicebear/styles/clay.json"
import { cn } from "cn"
import Image from "next/image"

const clayStyle = new Style(clay)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const src = new Avatar(clayStyle, {
    seed,
    animationVariant: animated ? "medium" : "none",
  }).toDataUri()

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
