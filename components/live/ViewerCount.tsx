import { Badge } from '@/components/ui/Badge'

export function ViewerCount({ count, live }: { count: number; live?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {live && <Badge tone="live">LIVE</Badge>}
      <span className="text-sm text-neutral-300">{count.toLocaleString()} watching</span>
    </div>
  )
}
