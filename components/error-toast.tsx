"use client"

import { useRouter } from "next/navigation"

import { toast } from "@/components/ui/toast"

// Shows an action's error. Errors from a missing plan feature link to the
// pricing page, which isn't in the sidebar.
export function useErrorToast() {
  const router = useRouter()

  return ({ error, upgrade }: { error: string; upgrade?: boolean }) => {
    const id = toast.add({
      title: error,
      type: "error",
      actionProps: upgrade
        ? {
            children: "See plans",
            onClick: () => {
              toast.close(id)
              router.push("/pricing")
            },
          }
        : undefined,
    })
  }
}
