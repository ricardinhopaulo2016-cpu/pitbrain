'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { MetricsGrid } from '@/components/dashboard/MetricsGrid'
import { CampaignTable } from '@/components/dashboard/CampaignTable'
import { FunnelChart } from '@/components/dashboard/FunnelChart'
import { RoasTimelineChart } from '@/components/dashboard/RoasTimelineChart'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { useMetrics } from '@/hooks/useMetrics'
import { useSessionStore } from '@/store/sessionStore'
import { Brain, Upload, AlertTriangle, TrendingUp, Zap } from 'lucide-react'

function SkeletonCard({ className }: { className?: string }) {
  return <div className={`bg-pb-card border border-pb-border rounded-xl animate-pulse ${className ?? ''}`} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 11 }).map((_, i) => <SkeletonCard key={i} className="h-24" />)}
      </div>
      <SkeletonCard className="h-72" />
      <div className="grid lg:grid-cols-2 gap-4">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { sessionId } = useSessionStore()
  const { metrics, loading, error } = useMetrics()
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
        <button
          onClick={() => router.push('/upload')}
          className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          Ir para upload
        </button>
      </PageShell>
    )
  }

  if (loading) return <PageShell><DashboardSkeleton /></PageShell>

  if (error || !metrics) {
    return (
      <PageShell>
        <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0" />
          <p className="text-pb-red text-sm">{error ?? 'Erro ao carregar métricas.'}</p>
        </div>
      </PageShell>
    )
  }

  const period = metrics.dateRange.from && metrics.dateRange.to
    ? `${metrics.dateRange.from} → ${metrics.dateRange.to}`
    : `Sessão ${sessionId.slice(0, 8)}…`

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Dashboard</h1>
          <p className="text-pb-muted text-sm mt-0.5">{period}</p>
        </div>
        <button
          onClick={() => router.push('/diagnostico')}
          className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-pb-purple/20 text-sm"
        >
          <Brain className="h-4 w-4" />
          Analisar com IA
        </button>
      </div>

      {/* KPI Grid */}
      <MetricsGrid metrics={metrics.overall} />

      {/* Resumo do Dia */}
      <div className="bg-pb-card border border-pb-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-pb-blue" />
          <h2 className="font-semibold text-pb-text text-sm">Resumo do Dia</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-pb-muted text-xs uppercase tracking-wide">Campanhas Ativas</p>
            <p className="text-pb-text font-semibold text-xl">{metrics.byCampaign.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-pb-muted text-xs uppercase tracking-wide">Melhor ROAS</p>
            <p className="text-pb-green font-semibold text-xl">
              {metrics.byCampaign.length > 0
                ? `${Math.max(...metrics.byCampaign.map(c => c.roas)).toFixed(2)}x`
                : '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-pb-muted text-xs uppercase tracking-wide">IC → Venda</p>
            <p className="text-pb-text font-semibold text-xl">
              {(metrics.overall.checkoutToPurchaseRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Alertas Rápidos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-pb-yellow" />
          <h2 className="font-semibold text-pb-text text-sm">Alertas Rápidos</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {metrics.overall.roas < 1 && (
            <div className="bg-pb-red/10 border border-pb-red/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-pb-red shrink-0" />
              <p className="text-sm text-pb-text">ROAS abaixo do break-even — revisão urgente necessária</p>
            </div>
          )}
          {metrics.overall.ctr < 0.01 && (
            <div className="bg-pb-yellow/10 border border-pb-yellow/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0" />
              <p className="text-sm text-pb-text">CTR baixo — criativos podem estar saturados</p>
            </div>
          )}
          {metrics.overall.checkoutToPurchaseRate < 0.2 && (
            <div className="bg-pb-yellow/10 border border-pb-yellow/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0" />
              <p className="text-sm text-pb-text">Taxa IC→Venda abaixo de 20% — verificar checkout</p>
            </div>
          )}
          {metrics.overall.roas >= 3 && (
            <div className="bg-pb-green/10 border border-pb-green/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <Zap className="h-4 w-4 text-pb-green shrink-0" />
              <p className="text-sm text-pb-text">ROAS acima de 3x — considere escalar o budget</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-pb-card border border-pb-border rounded-xl p-5">
          <h2 className="font-semibold text-pb-text text-sm mb-4">Funil de Conversão</h2>
          <FunnelChart metrics={metrics.overall} />
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-5">
          <h2 className="font-semibold text-pb-text text-sm mb-4">ROAS por Campanha (top 5)</h2>
          {metrics.byCampaign.length > 0
            ? <RoasTimelineChart campaigns={metrics.byCampaign} />
            : <div className="flex items-center justify-center h-[260px] text-pb-muted text-sm">Sem dados de campanha.</div>
          }
        </div>
      </div>

      {/* Últimos Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-pb-purple" />
          <h2 className="font-semibold text-pb-text text-sm">Últimos Insights</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <InsightCard
            title="ROAS Geral"
            status={metrics.overall.roas >= 3 ? 'positivo' : metrics.overall.roas >= 1 ? 'atenção' : 'crítico'}
            diagnosis={metrics.overall.roas >= 3
              ? 'Campanha retornando acima do meta. Considere aumentar o orçamento.'
              : metrics.overall.roas >= 1
                ? 'ROAS positivo mas abaixo do meta de 3x. Otimize os criativos.'
                : 'ROAS abaixo do break-even. Revisão urgente necessária.'}
            evidence={`ROAS atual: ${metrics.overall.roas.toFixed(2)}x`}
            action={metrics.overall.roas >= 3 ? 'Escalar budget em 20%' : 'Gerar diagnóstico IA completo'}
            priority={metrics.overall.roas < 1 ? 'alta' : 'média'}
          />
          <InsightCard
            title="Funil de Conversão"
            status={metrics.overall.checkoutToPurchaseRate >= 0.5 ? 'positivo' : metrics.overall.checkoutToPurchaseRate >= 0.2 ? 'atenção' : 'crítico'}
            diagnosis={`Taxa IC→Venda de ${(metrics.overall.checkoutToPurchaseRate * 100).toFixed(1)}%. ${
              metrics.overall.checkoutToPurchaseRate < 0.2
                ? 'Checkout com fricção — verificar fluxo de pagamento.'
                : 'Conversão aceitável no fundo do funil.'
            }`}
            evidence={`${metrics.overall.initiateCheckouts} checkouts → ${metrics.overall.purchases} vendas`}
            priority={metrics.overall.checkoutToPurchaseRate < 0.2 ? 'alta' : 'baixa'}
          />
        </div>
      </div>

      {/* Campaign Table */}
      {metrics.byCampaign.length > 0 && (
        <div>
          <h2 className="font-semibold text-pb-text text-sm mb-3">
            Campanhas — {metrics.byCampaign.length} no total
          </h2>
          <CampaignTable campaigns={metrics.byCampaign} />
        </div>
      )}
    </PageShell>
  )
}
