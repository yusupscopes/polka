"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"

// Shows an action's error. Errors from a missing plan feature link to the
// pricing page, and errors from a used-up allowance to the usage page.
export function useErrorToast() {
  const router = useRouter()

  // Stable, so effects can depend on it.
  return useCallback(
    ({
      error,
      upgrade,
      usage,
    }: {
      error: string
      upgrade?: boolean
      usage?: boolean
    }) => {
      const link = upgrade
        ? { label: "See plans", href: "/pricing" }
        : usage
          ? { label: "See usage", href: "/usage" }
          : undefined
      const id = toast.add({
        title: error,
        type: "error",
        actionProps: link
          ? {
              children: link.label,
              onClick: () => {
                toast.close(id)
                router.push(link.href)
              },
            }
          : undefined,
      })
    },
    [router]
  )
}
