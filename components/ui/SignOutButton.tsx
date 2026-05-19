'use client'

import { SignOutButton as ClerkSignOutButton } from '@clerk/nextjs'
import { Button } from './Button'

export function AuthSignOutButton() {
  return (
    <ClerkSignOutButton redirectUrl="/">
      <Button size="sm" variant="ghost" type="button">Sign out</Button>
    </ClerkSignOutButton>
  )
}
