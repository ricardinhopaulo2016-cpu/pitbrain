'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { CampaignTable } from '@/components/dashboard/CampaignTable'
import { useMetrics } from '@/hooks/useMetrics'
import { useSessionStore } from '@/store/sessionStore'
import { Upload, Megaphone } from 'lucide-react'

export default function CampanhasPage() {
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
          <p className="text-pb-muted text-sm">Faça o upload dos dados para ver as campanhas.</p>
        </div>
        <button onClick={() => router.push('/upload')} className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all">
          Ir para upload
        </button>
      </PageShell>
    )
  }

  if (loading || !metrics) {
    return (
      <PageShell className="space-y-4">
        <div className="h-8 bg-pb-card border border-pb-border rounded-lg animate-pulse w-48" />
        <div className="h-96 bg-pb-card border border-pb-border rounded-xl animate-pulse" />
      </PageShell>
    )
  }

  if (metrics.byCampaign.length === 0) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <Megaphone className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center">
          <p className="text-pb-text font-medium mb-1">Sem dados de campanha</p>
          <p className="text-pb-muted text-sm">Importe o CSV do Meta Ads para ver campanhas detalhadas.</p>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Campanhas</h1>
        <p className="text-pb-muted text-sm mt-0.5">{metrics.byCampaign.length} campanhas — ordenáveis por qualquer coluna</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-pb-card border border-pb-border rounded-xl p-4">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">Total de campanhas</p>
          <p className="text-2xl font-bold text-pb-text">{metrics.byCampaign.length}</p>
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-4">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">ROAS médio</p>
          <p className="text-2xl font-bold text-pb-text">{metrics.overall.roas.toFixed(2)}x</p>
        </div>
        <div className="bg-pb-card border border-pb-border rounded-xl p-4">
          <p className="text-xs text-pb-muted uppercase tracking-wide mb-1">Campanhas c/ ROAS 3x+</p>
          <p className="text-2xl font-bold text-pb-green">
            {metrics.byCampaign.filter(c => c.roas >= 3).length}
          </p>
        </div>
      </div>

      <CampaignTable campaigns={metrics.byCampaign} />
    </PageShell>
  )
}
