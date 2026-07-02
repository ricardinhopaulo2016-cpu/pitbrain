'use client'

import { PageShell } from '@/components/layout/PageShell'
import { useActiveImport } from '@/hooks/useActiveImport'
import { useSessionStore } from '@/store/sessionStore'
import { useRouter } from 'next/navigation'
import { FileText, Brain, Upload } from 'lucide-react'

export default function RascunhosPage() {
  const activeImport = useActiveImport()
  const { diagnosis } = useSessionStore()
  const router = useRouter()

  if (!activeImport) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <FileText className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-pb-text font-medium mb-1">Nenhum import ativo</p>
          <p className="text-pb-muted text-sm">Selecione um import na página Imports Salvos.</p>
        </div>
        <button
          onClick={() => router.push('/imports')}
          className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          <Upload className="h-4 w-4" />
          Imports Salvos
        </button>
      </PageShell>
    )
  }

  if (!diagnosis) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <FileText className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-pb-text font-medium mb-1">Nenhum rascunho gerado</p>
          <p className="text-pb-muted text-sm leading-relaxed">
            Gere um diagnóstico com um import ativo para obter rascunhos de campanha personalizados.
          </p>
        </div>
        <button
          onClick={() => router.push('/diagnostico')}
          className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          <Brain className="h-4 w-4" />
          Ir para Diagnóstico
        </button>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Rascunhos de Campanha</h1>
        <p className="text-pb-muted text-sm mt-0.5">
          Sugestões geradas com base no diagnóstico. Revise antes de implementar.
        </p>
      </div>

      <div className="bg-pb-card border border-pb-border rounded-xl p-8 text-center">
        <FileText className="h-10 w-10 text-pb-muted mx-auto mb-3" />
        <p className="text-pb-muted text-sm">
          A geração detalhada de rascunhos está em desenvolvimento. Os dados do diagnóstico já foram processados.
        </p>
      </div>
    </PageShell>
  )
}
