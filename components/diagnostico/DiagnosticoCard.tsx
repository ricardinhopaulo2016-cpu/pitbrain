import { cn } from '@/lib/utils'
import { DiagnosisStatus } from '@/types/diagnosis'
import { Zap } from 'lucide-react'

const statusConfig: Record<DiagnosisStatus, {
  label: string; badge: string; badgeText: string; borderColor: string
}> = {
  bom:     { label: 'Bom',     badge: 'bg-pb-green/10 border border-pb-green/30',   badgeText: 'text-pb-green',  borderColor: '#22C55E' },
  atencao: { label: 'Atenção', badge: 'bg-pb-yellow/10 border border-pb-yellow/30', badgeText: 'text-pb-yellow', borderColor: '#FBBF24' },
  critico: { label: 'Crítico', badge: 'bg-pb-red/10 border border-pb-red/30',       badgeText: 'text-pb-red',    borderColor: '#EF4444' },
}

interface DiagnosticoCardProps {
  title:     string
  diagnosis: string
  status?:   DiagnosisStatus
  evidence?: string[]
  actions?:  string[]
  children?: React.ReactNode
}

export function DiagnosticoCard({
  title, diagnosis, status, evidence, actions, children,
}: DiagnosticoCardProps) {
  const sc = status ? statusConfig[status] : null

  return (
    <div
      className="bg-pb-card border border-pb-border rounded-xl p-5"
      style={sc ? { borderLeft: `3px solid ${sc.borderColor}` } : {}}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-pb-text text-base">{title}</h3>
        {sc && (
          <span className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold',
            sc.badge, sc.badgeText
          )}>
            {sc.label}
          </span>
        )}
      </div>

      <p className="text-sm text-pb-muted leading-relaxed">{diagnosis}</p>

      {evidence && evidence.length > 0 && (
        <div
          className="mt-3 rounded-lg overflow-hidden"
          style={{ background: '#0D0D1F', border: '1px solid #1E1E35' }}
        >
          {evidence.map((e, i) => (
            <div
              key={i}
              className="px-3 py-2 text-xs font-mono text-pb-muted border-b border-pb-border/40 last:border-b-0"
            >
              {e}
            </div>
          ))}
        </div>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-pb-muted">
              <Zap className="h-3 w-3 text-pb-purple shrink-0 mt-0.5" />
              <span className="leading-relaxed">{a}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
