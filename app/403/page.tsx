import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <h1 className="text-3xl font-bold">403</h1>
      <p className="text-neutral-400">You don&apos;t have permission to view this page.</p>
      <Link href="/" className="text-brand-500 hover:underline">Go home</Link>
    </div>
  )
}
