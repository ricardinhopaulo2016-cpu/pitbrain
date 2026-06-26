import { cn } from '@/lib/utils'

export type CampaignStatus = 'ESCALAR' | 'MANTER' | 'OBSERVAR' | 'PAUSAR' | 'TESTAR'

const statusConfig: Record<CampaignStatus, { bg: string; text: string; dot: string }> = {
  ESCALAR: { bg: 'bg-pb-green/10 border border-pb-green/30', text: 'text-pb-green', dot: 'bg-pb-green' },
  MANTER:  { bg: 'bg-pb-blue/10 border border-pb-blue/30',   text: 'text-pb-blue',  dot: 'bg-pb-blue'  },
  OBSERVAR:{ bg: 'bg-pb-yellow/10 border border-pb-yellow/30', text: 'text-pb-yellow', dot: 'bg-pb-yellow' },
  PAUSAR:  { bg: 'bg-pb-red/10 border border-pb-red/30',     text: 'text-pb-red',   dot: 'bg-pb-red'   },
  TESTAR:  { bg: 'bg-pb-purple/10 border border-pb-purple/30', text: 'text-pb-purple', dot: 'bg-pb-purple' },
}

interface StatusBadgeProps {
  status: CampaignStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide', cfg.bg, cfg.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {status}
    </span>
  )
}
