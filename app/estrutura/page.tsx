'use client'

import { PageShell } from '@/components/layout/PageShell'
import { Layers, ArrowRight } from 'lucide-react'

export default function EstruturaPage() {
  return (
    <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-pb-card border border-pb-border flex items-center justify-center">
        <Layers className="h-9 w-9 text-pb-muted" />
      </div>

      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-pb-text">Estrutura de Campanhas</h1>
        <p className="text-pb-muted text-sm leading-relaxed">
          A análise de estrutura Meta Ads ficará disponível no módulo{' '}
          <span className="text-pb-text font-medium">Pit Planilhas</span>.
        </p>
        <p className="text-pb-muted text-sm leading-relaxed">
          No momento, o Pitbrain está focado em inteligência de performance via relatórios{' '}
          <span className="text-pb-text font-medium">UTMify</span>.
        </p>
      </div>

      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl"
        style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}
      >
        <ArrowRight className="h-4 w-4 text-pb-purple shrink-0" />
        <p className="text-sm text-pb-muted">
          Em breve: upload de estrutura + validação de nomenclatura de campanha.
        </p>
      </div>
    </PageShell>
  )
}
