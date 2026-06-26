'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { DiagnosticoCard } from '@/components/diagnostico/DiagnosticoCard'
import { GargaloAlert } from '@/components/diagnostico/GargaloAlert'
import { CampaignList } from '@/components/diagnostico/CampaignList'
import { AcoesRecomendadas } from '@/components/diagnostico/AcoesRecomendadas'
import { useDiagnosis } from '@/hooks/useDiagnosis'
import { useMetrics } from '@/hooks/useMetrics'
import { useSessionStore } from '@/store/sessionStore'
import { Brain, Upload, Loader2, AlertTriangle } from 'lucide-react'

function DiagnosticoSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-pb-card border border-pb-border rounded-xl animate-pulse h-32" />
      ))}
    </div>
  )
}

export default function DiagnosticoPage() {
  const { sessionId } = useSessionStore()
  const { metrics } = useMetrics()
  const { analyze, diagnosis, loading, error } = useDiagnosis()
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

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Diagnóstico IA</h1>
          <p className="text-pb-muted text-sm mt-0.5">Análise gerada por IA com base nas métricas calculadas</p>
        </div>
        <div className="flex items-center gap-3">
          {diagnosis && (
            <button
              onClick={() => metrics && analyze(metrics)}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-pb-border hover:border-pb-purple/40 text-pb-muted hover:text-pb-text font-medium px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              <Brain className="h-4 w-4" />
              Reanalisar
            </button>
          )}
          {!diagnosis && (
            <button
              onClick={() => metrics && analyze(metrics)}
              disabled={loading || !metrics}
              className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-pb-purple/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {loading ? 'Analisando...' : 'Gerar diagnóstico'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0" />
          <p className="text-pb-red text-sm">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <DiagnosticoSkeleton />}

      {/* Empty state */}
      {!loading && !diagnosis && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-pb-card border border-pb-border flex items-center justify-center">
            <Brain className="h-9 w-9 text-pb-muted" />
          </div>
          <div>
            <p className="text-pb-text font-medium mb-2">Diagnóstico não gerado</p>
            <p className="text-pb-muted text-sm max-w-sm leading-relaxed">
              Clique em &quot;Gerar diagnóstico&quot; para que a IA analise as métricas e produza
              o plano de ação por estágio de funil.
            </p>
          </div>
        </div>
      )}

      {/* Diagnosis results */}
      {diagnosis && !loading && (
        <div className="space-y-4">
          {/* Resumo Executivo */}
          <DiagnosticoCard
            title="Resumo Executivo"
            diagnosis={diagnosis.executiveSummary}
          />

          {/* Gargalo Principal */}
          <GargaloAlert bottleneck={diagnosis.mainBottleneck} />

          {/* Funil: Topo / Meio / Fundo */}
          <div className="grid md:grid-cols-3 gap-4">
            <DiagnosticoCard
              title="Topo de Funil"
              diagnosis={diagnosis.topFunnel.diagnosis}
              score={diagnosis.topFunnel.score}
              keyMetrics={diagnosis.topFunnel.keyMetrics}
            />
            <DiagnosticoCard
              title="Meio de Funil"
              diagnosis={diagnosis.midFunnel.diagnosis}
              score={diagnosis.midFunnel.score}
              keyMetrics={diagnosis.midFunnel.keyMetrics}
            />
            <DiagnosticoCard
              title="Fundo de Funil"
              diagnosis={diagnosis.bottomFunnel.diagnosis}
              score={diagnosis.bottomFunnel.score}
              keyMetrics={diagnosis.bottomFunnel.keyMetrics}
            />
          </div>

          {/* Classificação de Campanhas */}
          <div className="bg-pb-card border border-pb-border rounded-xl p-5">
            <h2 className="font-semibold text-pb-text text-sm mb-4">Classificação de Campanhas</h2>
            <CampaignList good={diagnosis.goodCampaigns} bad={diagnosis.badCampaigns} />
          </div>

          {/* Ações, Testes, Riscos */}
          <AcoesRecomendadas
            actions={diagnosis.recommendedActions}
            tests={diagnosis.testsForTomorrow}
            risks={diagnosis.risks}
          />

          <button
            onClick={() => router.push('/rascunhos')}
            className="inline-flex items-center gap-2 bg-pb-card-alt hover:bg-pb-card border border-pb-border hover:border-pb-purple/40 text-pb-text font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            Ver rascunhos de campanha →
          </button>
        </div>
      )}
    </PageShell>
  )
}
