'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { useActiveImport } from '@/hooks/useActiveImport'
import { UtmRankingTable } from '@/components/dashboard/UtmRankingTable'
import type { UtmifyBreakdownRow } from '@/types/utmify'
import { Megaphone, Upload } from 'lucide-react'

export default function CampanhasPage() {
  const activeImport = useActiveImport()
  const router = useRouter()

  if (!activeImport) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <Megaphone className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-pb-text font-medium mb-1">Nenhum import ativo</p>
          <p className="text-pb-muted text-sm">Selecione um import na página Imports Salvos.</p>
        </div>
        <button onClick={() => router.push('/imports')} className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all">
          <Upload className="h-4 w-4" />
          Imports Salvos
        </button>
      </PageShell>
    )
  }

  if (activeImport.breakdownLevel !== 'campaign') {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <Megaphone className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-pb-text font-medium mb-1">Dados de campanha indisponíveis</p>
          <p className="text-pb-muted text-sm leading-relaxed">
            Para visualizar campanhas, carregue um import UTMify com{' '}
            <span className="text-pb-text font-medium">UTM_CAMPAIGN</span> (Quebra por UTM — nível Campanha).
          </p>
          <p className="text-xs text-pb-muted mt-2">
            Import atual: <span className="text-pb-text">{activeImport.name}</span>
            {activeImport.breakdownLevel
              ? ` (nível: ${activeImport.breakdownLevel})`
              : ' (agregado diário — sem dimensão UTM)'}
          </p>
        </div>
        <button
          onClick={() => router.push('/imports')}
          className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-text px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          Trocar import
        </button>
      </PageShell>
    )
  }

  const rows = activeImport.rows as UtmifyBreakdownRow[]

  return (
    <PageShell className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Campanhas</h1>
          <p className="text-pb-muted text-sm mt-0.5">
            Ranking de campanhas por desempenho · {rows.length} campanhas
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-pb-purple/10 border border-pb-purple/25 px-3 py-1.5 rounded-lg shrink-0">
          <Megaphone className="h-3.5 w-3.5 text-pb-purple" />
          <span className="text-xs text-pb-purple font-medium">{activeImport.name}</span>
        </div>
      </div>
      <UtmRankingTable rows={rows} dimensionLabel="Campanha" />
    </PageShell>
  )
}
