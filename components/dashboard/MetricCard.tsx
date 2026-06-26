import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

type MetricStatus = 'good' | 'warning' | 'critical' | 'neutral' | 'blue'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  highlight?: MetricStatus
}

const accentConfig: Record<MetricStatus, { border: string; value: string; icon: string }> = {
  good:     { border: 'border-pb-green/40',  value: 'text-pb-green',  icon: 'text-pb-green'  },
  warning:  { border: 'border-pb-yellow/40', value: 'text-pb-yellow', icon: 'text-pb-yellow' },
  critical: { border: 'border-pb-red/40',    value: 'text-pb-red',    icon: 'text-pb-red'    },
  blue:     { border: 'border-pb-blue/40',   value: 'text-pb-blue',   icon: 'text-pb-blue'   },
  neutral:  { border: 'border-pb-border',    value: 'text-pb-text',   icon: 'text-pb-muted'  },
}

export function MetricCard({ title, value, subtitle, icon: Icon, highlight = 'neutral' }: MetricCardProps) {
  const cfg = accentConfig[highlight]

  return (
    <div className={cn(
      'bg-pb-card border border-pb-border rounded-xl p-4 border-t-2 transition-all hover:border-t-[3px]',
      cfg.border
    )}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-pb-muted uppercase tracking-wide">{title}</p>
        {Icon && <Icon className={cn('h-4 w-4', cfg.icon)} />}
      </div>
      <p className={cn('text-2xl font-bold tracking-tight', cfg.value)}>{value}</p>
      {subtitle && <p className="text-xs text-pb-muted mt-1.5 leading-tight">{subtitle}</p>}
    </div>
  )
}
