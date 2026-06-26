'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { useMetrics } from '@/hooks/useMetrics'
import { useSessionStore } from '@/store/sessionStore'
import { formatNumber, formatPercent, formatCurrency } from '@/lib/utils'
import { Upload, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FunnelStepData {
  label: string
  value: number
  rate?: number
  cost?: number
  status: 'good' | 'warning' | 'critical' | 'neutral'
  color: string
  bg: string
  border: string
}

function rateStatus(rate: number): 'good' | 'warning' | 'critical' {
  if (rate >= 0.5) return 'good'
  if (rate >= 0.2) return 'warning'
  return 'critical'
}

const statusLabel = {
  good: { text: 'Bom', color: 'text-pb-green', bg: 'bg-pb-green/10 border-pb-green/30' },
  warning: { text: 'Atenção', color: 'text-pb-yellow', bg: 'bg-pb-yellow/10 border-pb-yellow/30' },
  critical: { text: 'Crítico', color: 'text-pb-red', bg: 'bg-pb-red/10 border-pb-red/30' },
  neutral: { text: 'Dados', color: 'text-pb-blue', bg: 'bg-pb-blue/10 border-pb-blue/30' },
}

function FunnelStep({ step, isLast }: { step: FunnelStepData; isLast: boolean }) {
  const sl = statusLabel[step.status]
  return (
    <div className="flex flex-col items-center">
      <div className={cn('w-full max-w-lg bg-pb-card border-2 rounded-xl p-5', step.border)}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">{step.label}</p>
            <p className={cn('text-3xl font-black', step.color)}>{formatNumber(step.value, 0)}</p>
          </div>
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border', sl.bg, sl.color)}>
            {sl.text}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {step.rate !== undefined && (
            <div>
              <p className="text-pb-border text-xs">Taxa de conv.</p>
              <p className={cn('font-semibold', step.color)}>{formatPercent(step.rate)}</p>
            </div>
          )}
          {step.cost !== undefined && step.cost > 0 && (
            <div>
              <p className="text-pb-border text-xs">Custo por etapa</p>
              <p className="text-pb-text font-semibold">{formatCurrency(step.cost)}</p>
            </div>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center my-2">
          <div className="w-0.5 h-4 bg-pb-border" />
          <ArrowDown className="h-4 w-4 text-pb-border" />
          <div className="w-0.5 h-4 bg-pb-border" />
        </div>
      )}
    </div>
  )
}

export default function FunilPage() {
  const { sessionId } = useSessionStore()
  const { metrics, loading } = useMetrics()
  const router = useRouter()

  if (!sessionId) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <Upload className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center">
          <p className="text-pb-text font-medium mb-1">Nenhuma sessão ativa</p>
          <p className="text-pb-muted text-sm">Faça o upload dos dados para começar.</p>
        </div>
        <button onClick={() => router.push('/upload')} className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all">
          Ir para upload
        </button>
      </PageShell>
    )
  }

  if (loading || !metrics) {
    return (
      <PageShell className="space-y-6">
        <div className="h-8 bg-pb-card border border-pb-border rounded-lg animate-pulse w-48" />
        <div className="flex flex-col items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full max-w-lg h-24 bg-pb-card border border-pb-border rounded-xl animate-pulse" />
          ))}
        </div>
      </PageShell>
    )
  }

  const m = metrics.overall
  const cpa = m.cpa
  const cpc = m.cpc

  const steps: FunnelStepData[] = [
    {
      label: 'Impressões',
      value: m.impressions,
      status: 'neutral',
      color: 'text-pb-blue',
      bg: 'bg-pb-blue/5',
      border: 'border-pb-blue/30',
    },
    {
      label: 'Cliques',
      value: m.clicks,
      rate: m.ctr,
      cost: cpc,
      status: m.ctr >= 0.02 ? 'good' : m.ctr >= 0.01 ? 'warning' : 'critical',
      color: 'text-pb-purple',
      bg: 'bg-pb-purple/5',
      border: 'border-pb-purple/30',
    },
    {
      label: 'Page Views',
      value: m.pageViews,
      rate: m.clicks > 0 ? m.pageViews / m.clicks : 0,
      status: m.clicks > 0 && m.pageViews / m.clicks >= 0.8 ? 'good' : m.clicks > 0 && m.pageViews / m.clicks >= 0.5 ? 'warning' : 'critical',
      color: 'text-pb-blue',
      bg: 'bg-pb-blue/5',
      border: 'border-pb-blue/20',
    },
    {
      label: 'Initiate Checkout',
      value: m.initiateCheckouts,
      rate: m.pageViewToCheckoutRate,
      status: rateStatus(m.pageViewToCheckoutRate),
      color: 'text-pb-yellow',
      bg: 'bg-pb-yellow/5',
      border: 'border-pb-yellow/30',
    },
    {
      label: 'Compras',
      value: m.purchases,
      rate: m.checkoutToPurchaseRate,
      cost: cpa,
      status: rateStatus(m.checkoutToPurchaseRate),
      color: 'text-pb-green',
      bg: 'bg-pb-green/5',
      border: 'border-pb-green/30',
    },
  ]

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Funil de Conversão</h1>
        <p className="text-pb-muted text-sm mt-0.5">Visão vertical do funil com taxas por etapa</p>
      </div>

      <div className="flex flex-col items-center py-4">
        {steps.map((step, i) => (
          <FunnelStep key={step.label} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 text-center">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">ROAS</p>
          <p className={cn('text-xl font-bold', m.roas >= 3 ? 'text-pb-green' : m.roas >= 1 ? 'text-pb-yellow' : 'text-pb-red')}>
            {m.roas.toFixed(2)}x
          </p>
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 text-center">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">CPA</p>
          <p className="text-xl font-bold text-pb-text">{formatCurrency(m.cpa)}</p>
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 text-center">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">CTR</p>
          <p className={cn('text-xl font-bold', m.ctr >= 0.02 ? 'text-pb-green' : m.ctr >= 0.01 ? 'text-pb-yellow' : 'text-pb-red')}>
            {formatPercent(m.ctr)}
          </p>
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 text-center">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">IC→Venda</p>
          <p className={cn('text-xl font-bold', m.checkoutToPurchaseRate >= 0.5 ? 'text-pb-green' : m.checkoutToPurchaseRate >= 0.2 ? 'text-pb-yellow' : 'text-pb-red')}>
            {formatPercent(m.checkoutToPurchaseRate)}
          </p>
        </div>
      </div>
    </PageShell>
  )
}
