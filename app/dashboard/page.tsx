'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricsGrid } from '@/components/dashboard/MetricsGrid'
import { CampaignTable } from '@/components/dashboard/CampaignTable'
import { FunnelChart } from '@/components/dashboard/FunnelChart'
import { RoasTimelineChart } from '@/components/dashboard/RoasTimelineChart'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { ValidationSection } from '@/components/dashboard/ValidationSection'
import { DailyPerformanceTable } from '@/components/dashboard/DailyPerformanceTable'
import { UtmRankingTable } from '@/components/dashboard/UtmRankingTable'
import { useMetrics } from '@/hooks/useMetrics'
import { useActiveImport } from '@/hooks/useActiveImport'
import { UtmifyDailyRow, UtmifyBreakdownRow } from '@/types/utmify'
import {
  Brain, Upload, AlertTriangle, TrendingUp, Zap, Calendar, Database,
  LucideIcon, BarChart2, ArrowLeftRight,
} from 'lucide-react'
import { useLastImport } from '@/hooks/useLastImport'

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className ?? ''}`}
      style={{ background: '#10101D', border: '1px solid #2A2A40' }}
    />
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 11 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24" />
        ))}
      </div>
      <SkeletonCard className="h-72" />
      <div className="grid lg:grid-cols-2 gap-4">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  )
}

function DashboardLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
        style={{ background: '#10101D', border: '1px solid #2A2A40' }}
      >
        <BarChart2 className="h-7 w-7 text-pb-muted" />
      </div>
      <p className="text-pb-muted text-sm">Carregando import ativo...</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">
      {children}
    </p>
  )
}

function AlertRow({ icon: Icon, iconColor, bg, border, text }: {
  icon: LucideIcon; iconColor: string; bg: string; border: string; text: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: bg, border: `1px solid ${border}` }}>
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <p className="text-sm text-pb-text">{text}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { metrics, loading, error, debugError } = useMetrics()
  const activeImport = useActiveImport()
  const lastImport   = useLastImport()
  const router = useRouter()
  const isDev = process.env.NODE_ENV === 'development'

  /* ── Pre-hydration — neutral state, identical on server and client ── */
  if (!mounted) {
    return (
      <PageShell className="space-y-4">
        <DashboardLoadingState />
      </PageShell>
    )
  }

  /* ── Empty state — no active import ── */
  if (!activeImport) {
    return (
      <PageShell className="space-y-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
            <BarChart2 className="h-7 w-7 text-pb-muted" />
          </div>
          <div>
            <p className="text-pb-text font-semibold mb-1">Nenhum import UTMify selecionado</p>
            <p className="text-pb-muted text-sm max-w-xs">Selecione um import na página Imports Salvos para ver o Dashboard.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/imports')}
              className="inline-flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 0 0 1px rgba(124,58,237,0.4)' }}
            >
              <Database className="h-4 w-4" />
              Imports Salvos
            </button>
            <button
              onClick={() => router.push('/utmify-sync')}
              className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-text font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: '#10101D' }}
            >
              <Upload className="h-4 w-4" />
              Conectar UTMify MCP
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell className="space-y-4">
        <DashboardSkeleton />
      </PageShell>
    )
  }

  /* ── Error state ── */
  if (error || !metrics) {
    return (
      <PageShell className="space-y-4">
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-pb-red shrink-0" />
            <p className="text-pb-red font-semibold text-sm">
              {error ?? 'Não foi possível carregar os dados importados.'}
            </p>
          </div>
          <p className="text-xs text-pb-muted pl-8">Verifique se o arquivo foi importado corretamente e tente novamente.</p>
          {isDev && debugError && (
            <pre className="text-xs text-pb-muted rounded-lg p-3 overflow-x-auto pl-8" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
              {debugError}
            </pre>
          )}
          <div className="pl-8">
            <button
              onClick={() => router.push('/imports')}
              className="inline-flex items-center gap-2 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}
            >
              <Database className="h-4 w-4" />
              Imports Salvos
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  const isBreakdown = activeImport.sourceType === 'utmify_utm_breakdown'
    || (activeImport.sourceType === 'utmify_mcp' && !!activeImport.breakdownLevel)

  const sourceLabel =
    activeImport.sourceType === 'utmify_daily_aggregate'  ? 'UTMify · Agregado Diário' :
    activeImport.sourceType === 'utmify_utm_breakdown'    ? `UTMify · ${activeImport.dimensionLabel ?? 'UTM Breakdown'}` :
    activeImport.sourceType === 'utmify_mcp'              ? 'Fonte: UTMify MCP' :
    'UTMify'

  const periodLabel = activeImport.periodLabel
    ?? (metrics.dateRange.from && metrics.dateRange.to ? `${metrics.dateRange.from} → ${metrics.dateRange.to}` : null)

  const chips = [
    ...(periodLabel  ? [{ label: periodLabel, icon: Calendar }] : []),
    ...(sourceLabel  ? [{ label: sourceLabel, icon: Database }] : []),
  ]

  return (
    <PageShell className="space-y-4">
      <div className="space-y-8">
      {/* ── Page header ────────────────────────────────────── */}
      <PageHeader
        title="Dashboard"
        chips={chips}
        action={{
          label: 'Analisar com IA',
          icon: Brain,
          onClick: () => router.push('/diagnostico'),
        }}
      />

      {/* ── Active import banner ────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-3.5 w-3.5 text-pb-purple shrink-0" />
          <span className="text-xs text-pb-muted">
            <span className="text-pb-text font-semibold">{activeImport.name}</span>
            <span className="mx-1.5 text-pb-border">·</span>
            <span>{sourceLabel}</span>
            <span className="mx-1.5 text-pb-border">·</span>
            <span>{activeImport.rowCount} linhas</span>
            {activeImport.ignoredFooterRowsCount > 0 && (
              <><span className="mx-1.5 text-pb-border">·</span>
              <span className="text-pb-muted/60">{activeImport.ignoredFooterRowsCount} total ignorado</span></>
            )}
          </span>
        </div>
        <button
          onClick={() => router.push('/imports')}
          className="inline-flex items-center gap-1.5 text-[11px] text-pb-purple hover:text-pb-purple/80 transition-colors shrink-0 font-medium"
        >
          <ArrowLeftRight className="h-3 w-3" />
          Trocar import
        </button>
      </div>

      {/* ── KPI grid ───────────────────────────────────────── */}
      <section>
        <SectionLabel>Métricas do período</SectionLabel>
        <MetricsGrid metrics={metrics.overall} />
      </section>

      {/* ── Resumo operacional ─────────────────────────────── */}
      <section>
        <div className="rounded-xl p-5" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-pb-blue" />
            <p className="text-xs font-semibold text-pb-text uppercase tracking-[0.1em]">Resumo operacional</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-[10px] text-pb-muted uppercase tracking-[0.12em] font-medium">Campanhas ativas</p>
              <p className="text-2xl font-black text-pb-text">{metrics.byCampaign.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-pb-muted uppercase tracking-[0.12em] font-medium">Melhor ROAS</p>
              <p className="text-2xl font-black text-pb-green">
                {metrics.byCampaign.length > 0
                  ? `${Math.max(...metrics.byCampaign.map(c => c.roas)).toFixed(2)}x`
                  : '—'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-pb-muted uppercase tracking-[0.12em] font-medium">IC → Venda</p>
              <p className="text-2xl font-black text-pb-text">
                {(metrics.overall.checkoutToPurchaseRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alertas ────────────────────────────────────────── */}
      {(metrics.overall.roas < 1 || metrics.overall.ctr < 0.01 || metrics.overall.checkoutToPurchaseRate < 0.2 || metrics.overall.roas >= 3) && (
        <section>
          <SectionLabel>Alertas rápidos</SectionLabel>
          <div className="grid md:grid-cols-2 gap-2.5">
            {metrics.overall.roas < 1 && (
              <AlertRow icon={AlertTriangle} iconColor="text-pb-red" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.2)" text="ROAS abaixo do break-even — revisão urgente necessária" />
            )}
            {metrics.overall.ctr < 0.01 && (
              <AlertRow icon={AlertTriangle} iconColor="text-pb-yellow" bg="rgba(250,204,21,0.06)" border="rgba(250,204,21,0.2)" text="CTR baixo — criativos podem estar saturados" />
            )}
            {metrics.overall.checkoutToPurchaseRate < 0.2 && (
              <AlertRow icon={AlertTriangle} iconColor="text-pb-yellow" bg="rgba(250,204,21,0.06)" border="rgba(250,204,21,0.2)" text="Taxa IC→Venda abaixo de 20% — verificar checkout" />
            )}
            {metrics.overall.roas >= 3 && (
              <AlertRow icon={Zap} iconColor="text-pb-green" bg="rgba(34,197,94,0.06)" border="rgba(34,197,94,0.2)" text="ROAS acima de 3x — considere escalar o budget" />
            )}
          </div>
        </section>
      )}

      {/* ── Charts ─────────────────────────────────────────── */}
      <section>
        <SectionLabel>Visualizações</SectionLabel>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
            <p className="text-xs font-semibold text-pb-text mb-4 uppercase tracking-[0.1em]">Funil de conversão</p>
            <FunnelChart metrics={metrics.overall} />
          </div>
          <div className="rounded-xl p-5" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
            <p className="text-xs font-semibold text-pb-text mb-4 uppercase tracking-[0.1em]">ROAS por campanha (top 5)</p>
            {metrics.byCampaign.length > 0
              ? <RoasTimelineChart campaigns={metrics.byCampaign} />
              : <div className="flex items-center justify-center h-[260px] text-pb-muted text-sm">Sem dados de campanha.</div>
            }
          </div>
        </div>
      </section>

      {/* ── Insights ───────────────────────────────────────── */}
      <section>
        <SectionLabel>Insights preliminares</SectionLabel>
        <div className="grid md:grid-cols-2 gap-3">
          <InsightCard
            title="ROAS Geral"
            status={metrics.overall.roas >= 3 ? 'positivo' : metrics.overall.roas >= 1 ? 'atenção' : 'crítico'}
            diagnosis={
              metrics.overall.roas >= 3
                ? 'Campanha retornando acima do meta. Considere aumentar o orçamento.'
                : metrics.overall.roas >= 1
                  ? 'ROAS positivo mas abaixo do meta de 3x. Otimize os criativos.'
                  : 'ROAS abaixo do break-even. Revisão urgente necessária.'
            }
            evidence={`ROAS atual: ${metrics.overall.roas.toFixed(2)}x`}
            action={
              metrics.overall.roas >= 3
                ? 'Escalar budget gradualmente — monitorar CPM e saturação de público.'
                : 'Gere o diagnóstico IA completo para identificar o gargalo principal.'
            }
            priority={metrics.overall.roas < 1 ? 'alta' : 'média'}
          />
          <InsightCard
            title="Funil de conversão"
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
      </section>

      {/* ── Campaign table ─────────────────────────────────── */}
      {metrics.byCampaign.length > 0 && (
        <section>
          <SectionLabel>Campanhas — {metrics.byCampaign.length} no total</SectionLabel>
          <CampaignTable campaigns={metrics.byCampaign} />
        </section>
      )}

      {/* ── UTM Ranking table ──────────────────────────────── */}
      {isBreakdown && (
        <section>
          <SectionLabel>Ranking — {activeImport.dimensionLabel ?? 'UTM'}</SectionLabel>
          <UtmRankingTable
            rows={activeImport.rows as UtmifyBreakdownRow[]}
            dimensionLabel={activeImport.dimensionLabel ?? 'Dimensão'}
          />
        </section>
      )}

      {/* ── Validation ─────────────────────────────────────── */}
      <ValidationSection
        overall={metrics.overall}
        summary={lastImport?.summary ?? null}
        sourceType={lastImport?.sourceType ?? null}
      />

      {/* ── Daily table ────────────────────────────────────── */}
      {activeImport.sourceType === 'utmify_daily_aggregate' && lastImport && (
        <DailyPerformanceTable rows={lastImport.rows as UtmifyDailyRow[]} />
      )}
      </div>
    </PageShell>
  )
}
