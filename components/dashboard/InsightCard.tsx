import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp, Info, Zap } from 'lucide-react'

export type InsightPriority = 'alta' | 'média' | 'baixa'
export type InsightStatus = 'crítico' | 'atenção' | 'positivo' | 'neutro'

interface InsightCardProps {
  title: string
  status: InsightStatus
  diagnosis: string
  evidence?: string
  action?: string
  priority?: InsightPriority
  risk?: string
  className?: string
}

const statusConfig: Record<InsightStatus, { border: string; icon: React.ReactNode; label: string; labelColor: string }> = {
  'crítico':  { border: 'border-l-pb-red',    icon: <AlertTriangle className="h-4 w-4 text-pb-red" />,    label: 'Crítico',   labelColor: 'text-pb-red'    },
  'atenção':  { border: 'border-l-pb-yellow',  icon: <AlertTriangle className="h-4 w-4 text-pb-yellow" />, label: 'Atenção',   labelColor: 'text-pb-yellow' },
  'positivo': { border: 'border-l-pb-green',   icon: <TrendingUp className="h-4 w-4 text-pb-green" />,    label: 'Positivo',  labelColor: 'text-pb-green'  },
  'neutro':   { border: 'border-l-pb-blue',    icon: <Info className="h-4 w-4 text-pb-blue" />,           label: 'Neutro',    labelColor: 'text-pb-blue'   },
}

const priorityColor: Record<InsightPriority, string> = {
  alta:  'text-pb-red',
  média: 'text-pb-yellow',
  baixa: 'text-pb-muted',
}

export function InsightCard({ title, status, diagnosis, evidence, action, priority, risk, className }: InsightCardProps) {
  const cfg = statusConfig[status]

  return (
    <div className={cn(
      'bg-pb-card border border-pb-border rounded-xl p-4 border-l-4 space-y-3',
      cfg.border,
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {cfg.icon}
          <h3 className="font-semibold text-pb-text text-sm">{title}</h3>
        </div>
        <span className={cn('text-xs font-semibold shrink-0', cfg.labelColor)}>{cfg.label}</span>
      </div>

      <p className="text-sm text-pb-muted leading-relaxed">{diagnosis}</p>

      {evidence && (
        <div className="bg-pb-card-alt rounded-lg px-3 py-2">
          <p className="text-xs text-pb-border mb-0.5 uppercase tracking-wide">Evidência</p>
          <p className="text-xs text-pb-muted">{evidence}</p>
        </div>
      )}

      {action && (
        <div className="flex items-start gap-2">
          <Zap className="h-3.5 w-3.5 text-pb-purple shrink-0 mt-0.5" />
          <p className="text-xs text-pb-text">{action}</p>
        </div>
      )}

      <div className="flex items-center gap-4 pt-1">
        {priority && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-pb-border">Prioridade:</span>
            <span className={cn('text-xs font-semibold capitalize', priorityColor[priority])}>{priority}</span>
          </div>
        )}
        {risk && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-pb-border">Risco:</span>
            <span className="text-xs text-pb-muted">{risk}</span>
          </div>
        )}
      </div>
    </div>
  )
}
