import { SignIn } from '@clerk/nextjs'

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
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center justify-center px-4 py-12">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/register"
        fallbackRedirectUrl={callbackUrl}
      />
    </div>
  )
}