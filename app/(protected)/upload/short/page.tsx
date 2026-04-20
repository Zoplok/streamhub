import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShortUploader } from '@/components/shorts/ShortUploader'
import { Film } from 'lucide-react'

export default async function UploadShortPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/upload/short')
  if (!['admin', 'creator'].includes(session.user.role)) redirect('/403')

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          icon={Film}
          eyebrow="Creator Studio"
          title="Upload a Short"
          subtitle="Short vertical videos up to 60 seconds. Max 100MB."
          accent="brand"
        />
        <ShortUploader />
      </div>
    </div>
  )
}
