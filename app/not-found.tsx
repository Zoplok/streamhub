import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-neutral-400">This page doesn&apos;t exist.</p>
      <Link href="/" className="text-brand-500 hover:underline">Go home</Link>
    </div>
  )
}
