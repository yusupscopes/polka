import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs"

import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b px-6">
      <Show when="signed-out">
        <SignInButton>
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  )
}
