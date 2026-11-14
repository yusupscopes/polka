import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

export default async function Page() {
  await auth.protect()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pick your plan
        </h1>
        <p className="text-muted-foreground">
          Pro unlocks bots and their sandboxes: create bots, chat with them, and
          watch them work on their own cloud computer.
        </p>
      </div>
      <PricingTable newSubscriptionRedirectUrl="/" />
    </div>
  )
}
