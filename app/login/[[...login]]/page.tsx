import { SignIn } from '@clerk/nextjs'
import { clerkAuthAppearance } from '@/components/auth/clerkAuthAppearance'

function pickQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '/'
  return value ?? '/'
}

export default function LoginPage({
  searchParams
}: {
  searchParams?: { callbackUrl?: string | string[] }
}) {
  const callbackUrl = pickQueryValue(searchParams?.callbackUrl)

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-neutral-400">
        Clerk is not configured yet. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.
      </div>
    )
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-5xl items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,rgba(83,252,24,0.24),transparent_55%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="w-full max-w-md">
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/register"
          fallbackRedirectUrl={callbackUrl}
          appearance={clerkAuthAppearance}
        />
      </div>
    </div>
  )
}
