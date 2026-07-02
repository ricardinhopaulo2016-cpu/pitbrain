import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp, Info, Zap } from 'lucide-react'

export type InsightPriority = 'alta' | 'média' | 'baixa'
export type InsightStatus   = 'crítico' | 'atenção' | 'positivo' | 'neutro'

interface InsightCardProps {
  title:     string
  status:    InsightStatus
  diagnosis: string
  evidence?: string
  action?:   string
  priority?: InsightPriority
  risk?:     string
  className?: string
}

const statusCfg: Record<InsightStatus, {
  accentColor: string
  bgTint:      string
  badgeBg:     string
  badgeText:   string
  icon:        React.ReactNode
  label:       string
}> = {
  'crítico':  {
    accentColor: '#EF4444',
    bgTint:      'rgba(239, 68, 68, 0.04)',
    badgeBg:     'rgba(239, 68, 68, 0.12)',
    badgeText:   '#EF4444',
    icon:        <AlertTriangle className="h-4 w-4 text-pb-red" />,
    label:       'Crítico',
  },
  'atenção':  {
    accentColor: '#FACC15',
    bgTint:      'rgba(250, 204, 21, 0.04)',
    badgeBg:     'rgba(250, 204, 21, 0.12)',
    badgeText:   '#FACC15',
    icon:        <AlertTriangle className="h-4 w-4 text-pb-yellow" />,
    label:       'Atenção',
  },
  'positivo': {
    accentColor: '#22C55E',
    bgTint:      'rgba(34, 197, 94, 0.04)',
    badgeBg:     'rgba(34, 197, 94, 0.12)',
    badgeText:   '#22C55E',
    icon:        <TrendingUp className="h-4 w-4 text-pb-green" />,
    label:       'Positivo',
  },
  'neutro':   {
    accentColor: '#38BDF8',
    bgTint:      'rgba(56, 189, 248, 0.04)',
    badgeBg:     'rgba(56, 189, 248, 0.12)',
    badgeText:   '#38BDF8',
    icon:        <Info className="h-4 w-4 text-pb-blue" />,
    label:       'Neutro',
  },
}

const priorityColor: Record<InsightPriority, string> = {
  alta:  '#EF4444',
  média: '#FACC15',
  baixa: '#94A3B8',
}

export function InsightCard({
  title, status, diagnosis, evidence, action, priority, risk, className,
}: InsightCardProps) {
  const s = statusCfg[status]

  return (
    <div
      className={cn('rounded-xl p-4 space-y-3', className)}
      style={{
        background: `linear-gradient(160deg, ${s.bgTint}, #10101D 60%)`,
        border: `1px solid rgba(42, 42, 64, 0.8)`,
        borderLeft: `3px solid ${s.accentColor}`,
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {s.icon}
          <h3 className="font-bold text-pb-text text-sm leading-tight">{title}</h3>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 uppercase tracking-wide"
          style={{ background: s.badgeBg, color: s.badgeText }}
        >
          {s.label}
        </span>
      </div>

      {/* ── Diagnosis ───────────────────────────────────────── */}
      <p className="text-sm text-pb-muted leading-relaxed">{diagnosis}</p>

      {/* ── Evidence ────────────────────────────────────────── */}
      {evidence && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{
            background: 'rgba(7, 7, 18, 0.7)',
            border: '1px solid rgba(42, 42, 64, 0.6)',
            fontFamily: 'var(--font-geist-mono, monospace)',
          }}
        >
          <span className="text-[10px] text-pb-border/60 uppercase tracking-wide mr-2">{'//'}  evidência</span>
          <p className="text-xs text-pb-muted mt-1">{evidence}</p>
        </div>
      )}

      {/* ── Action ──────────────────────────────────────────── */}
      {action && (
        <div
          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
          style={{
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.18)',
          }}
        >
          <Zap className="h-3.5 w-3.5 text-pb-purple shrink-0 mt-0.5" />
          <p className="text-xs text-pb-text leading-relaxed">{action}</p>
        </div>
      )}

      {/* ── Meta row ────────────────────────────────────────── */}
      {(priority || risk) && (
        <div className="flex items-center gap-3 pt-0.5">
          {priority && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-pb-border/60 uppercase tracking-wide">Prioridade</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: priorityColor[priority] }}
              >
                {priority}
              </span>
            </div>
          )}
          {risk && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-pb-border/60 uppercase tracking-wide">Risco</span>
              <span className="text-[10px] font-semibold text-pb-muted">{risk}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
