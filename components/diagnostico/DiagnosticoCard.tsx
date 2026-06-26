import { cn } from '@/lib/utils'
import { FunnelScore } from '@/types/diagnosis'

const scoreConfig: Record<FunnelScore, { label: string; border: string; badge: string; badgeText: string }> = {
  bom:      { label: 'Bom',     border: 'border-l-pb-green',  badge: 'bg-pb-green/10 border border-pb-green/30',  badgeText: 'text-pb-green'  },
  'atenção':{ label: 'Atenção', border: 'border-l-pb-yellow', badge: 'bg-pb-yellow/10 border border-pb-yellow/30', badgeText: 'text-pb-yellow' },
  'crítico':{ label: 'Crítico', border: 'border-l-pb-red',    badge: 'bg-pb-red/10 border border-pb-red/30',      badgeText: 'text-pb-red'    },
}

interface DiagnosticoCardProps {
  title: string
  diagnosis: string
  score?: FunnelScore
  keyMetrics?: string[]
  children?: React.ReactNode
}

export function DiagnosticoCard({ title, diagnosis, score, keyMetrics, children }: DiagnosticoCardProps) {
  const sc = score ? scoreConfig[score] : null

  return (
    <div className={cn(
      'bg-pb-card border border-pb-border rounded-xl p-5 border-l-4',
      sc ? sc.border : 'border-l-pb-border'
    )}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-pb-text text-base">{title}</h3>
        {sc && (
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold', sc.badge, sc.badgeText)}>
            {sc.label}
          </span>
        )}
      </div>
      <p className="text-sm text-pb-muted leading-relaxed">{diagnosis}</p>
      {keyMetrics && keyMetrics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {keyMetrics.map(m => (
            <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-md bg-pb-card-alt text-xs text-pb-muted border border-pb-border">
              {m}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
