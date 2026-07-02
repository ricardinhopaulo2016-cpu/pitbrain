import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export type MetricStatus = 'good' | 'warning' | 'critical' | 'neutral' | 'blue'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  highlight?: MetricStatus
}

const cfg: Record<MetricStatus, {
  topColor:  string
  valueCls:  string
  glowCls:   string
  iconCls:   string
  dotBg:     string
  bgTint:    string
}> = {
  good:    { topColor: '#22C55E', valueCls: 'text-pb-green',  glowCls: 'text-glow-green',  iconCls: 'text-pb-green',  dotBg: 'bg-pb-green',  bgTint: 'rgba(34, 197, 94, 0.03)'   },
  warning: { topColor: '#FACC15', valueCls: 'text-pb-yellow', glowCls: 'text-glow-yellow', iconCls: 'text-pb-yellow', dotBg: 'bg-pb-yellow', bgTint: 'rgba(250, 204, 21, 0.03)'  },
  critical:{ topColor: '#EF4444', valueCls: 'text-pb-red',    glowCls: 'text-glow-red',    iconCls: 'text-pb-red',    dotBg: 'bg-pb-red',    bgTint: 'rgba(239, 68, 68, 0.04)'   },
  blue:    { topColor: '#38BDF8', valueCls: 'text-pb-blue',   glowCls: 'text-glow-blue',   iconCls: 'text-pb-blue',   dotBg: 'bg-pb-blue',   bgTint: 'rgba(56, 189, 248, 0.03)'  },
  neutral: { topColor: '#2A2A40', valueCls: 'text-pb-text',   glowCls: 'text-glow-white',  iconCls: 'text-pb-muted',  dotBg: 'bg-pb-border', bgTint: 'transparent'               },
}

export function MetricCard({ title, value, subtitle, icon: Icon, highlight = 'neutral' }: MetricCardProps) {
  const c = cfg[highlight]

  return (
    <div
      className={cn('rounded-xl p-4 cursor-default select-none', `card-glow-${highlight}`)}
      style={{
        background: `linear-gradient(160deg, ${c.bgTint}, #10101D 50%)`,
        border: `1px solid #2A2A40`,
        borderTop: `2px solid ${c.topColor}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dotBg)} />
          <p className="text-[10px] font-semibold text-pb-muted uppercase tracking-[0.13em]">
            {title}
          </p>
        </div>
        {Icon && (
          <Icon className={cn('h-3.5 w-3.5 shrink-0 opacity-50', c.iconCls)} />
        )}
      </div>

      {/* Value */}
      <p className={cn('text-[28px] font-black tracking-tight leading-none mb-2', c.valueCls, c.glowCls)}>
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[11px] text-pb-muted/60 leading-tight">{subtitle}</p>
      )}
    </div>
  )
}
