'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { DiagnosticoCard } from '@/components/diagnostico/DiagnosticoCard'
import { GargaloAlert } from '@/components/diagnostico/GargaloAlert'
import { AcoesRecomendadas } from '@/components/diagnostico/AcoesRecomendadas'
import { useDiagnosis } from '@/hooks/useDiagnosis'
import { useMetrics } from '@/hooks/useMetrics'
import { useSessionStore } from '@/store/sessionStore'
import { useActiveImport } from '@/hooks/useActiveImport'
import { buildManualPrompt } from '@/lib/prompts/manual-prompt'
import { extractJSON } from '@/lib/ai/utils'
import {
  Brain, Upload, Loader2, AlertTriangle,
  Clipboard, ChevronDown, Cpu, ArrowRight, CheckCircle2,
} from 'lucide-react'

const isMock = process.env.NEXT_PUBLIC_AI_PROVIDER === 'mock'

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
  const { setDiagnosis } = useSessionStore()
  const activeImport = useActiveImport()
  const { metrics } = useMetrics()
  const { analyze, diagnosis, loading, error } = useDiagnosis()
  const router = useRouter()

  const [manualOpen, setManualOpen]   = useState(false)
  const [promptText, setPromptText]   = useState('')
  const [pastedText, setPastedText]   = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSaved, setManualSaved] = useState(false)

  function generatePrompt() {
    if (!metrics) return
    setPromptText(buildManualPrompt(metrics))
    setManualSaved(false)
    setManualError(null)
    setPastedText('')
  }

  function processResponse() {
    if (!pastedText.trim()) {
      setManualError('Cole a resposta da IA antes de processar.')
      return
    }
    try {
      const parsed = extractJSON(pastedText.trim())
      setDiagnosis(parsed)
      setManualSaved(true)
      setManualError(null)
    } catch {
      setManualError('Não foi possível extrair JSON válido. Certifique-se de colar apenas a resposta JSON da IA.')
    }
  }

  async function copyToClipboard() {
    if (!promptText) return
    await navigator.clipboard.writeText(promptText).catch(() => undefined)
  }

  if (!activeImport) {
    return (
      <PageShell className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-pb-card-alt border border-pb-border flex items-center justify-center">
          <Upload className="h-7 w-7 text-pb-muted" />
        </div>
        <div className="text-center">
          <p className="text-pb-text font-medium mb-1">Diagnóstico só habilitado com import ativo</p>
          <p className="text-pb-muted text-sm">Selecione um import na página Imports Salvos para começar.</p>
        </div>
        <button
          onClick={() => router.push('/imports')}
          className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
        >
          Imports Salvos
        </button>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Diagnóstico IA</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-pb-muted text-sm">Análise por estágio de funil</p>
            {isMock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pb-blue/10 border border-pb-blue/30 text-pb-blue text-[10px] font-bold uppercase tracking-wide">
                <Cpu className="h-2.5 w-2.5" />
                Diagnóstico Local
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {diagnosis && (
            <button
              onClick={() => metrics && analyze(metrics)}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-pb-border hover:border-pb-purple/40 text-pb-muted hover:text-pb-text font-medium px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              {isMock ? <Cpu className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
              Reanalisar
            </button>
          )}
          {!diagnosis && (
            <button
              onClick={() => metrics && analyze(metrics)}
              disabled={loading || !metrics}
              className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-pb-purple/20"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isMock ? <Cpu className="h-4 w-4" /> : <Brain className="h-4 w-4" />
              }
              {loading
                ? 'Analisando...'
                : isMock ? 'Diagnosticar (Regras Locais)' : 'Gerar diagnóstico'
              }
            </button>
          )}
        </div>
      </div>

      {/* ── Error (only for real API providers) ────────────────── */}
      {error && !isMock && (
        <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0" />
          <p className="text-pb-red text-sm">{error}</p>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────── */}
      {loading && <DiagnosticoSkeleton />}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!loading && !diagnosis && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-pb-card border border-pb-border flex items-center justify-center">
            {isMock
              ? <Cpu className="h-9 w-9 text-pb-muted" />
              : <Brain className="h-9 w-9 text-pb-muted" />
            }
          </div>
          <div>
            <p className="text-pb-text font-medium mb-2">
              {isMock ? 'Diagnóstico por Regras Locais' : 'Diagnóstico não gerado'}
            </p>
            <p className="text-pb-muted text-sm max-w-sm leading-relaxed">
              {isMock
                ? 'Clique em "Diagnosticar (Regras Locais)" para analisar as métricas com thresholds pré-definidos, sem precisar de API externa.'
                : 'Clique em "Gerar diagnóstico" para que a IA analise as métricas e produza o plano de ação por estágio de funil.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────── */}
      {diagnosis && !loading && (
        <div className="space-y-4">
          <DiagnosticoCard
            title="Resumo Executivo"
            diagnosis={diagnosis.executiveSummary}
          />

          {diagnosis.nextDecision && (
            <div className="bg-pb-blue/[0.06] border border-pb-blue/20 rounded-xl p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-pb-blue/15 border border-pb-blue/25 flex items-center justify-center shrink-0">
                <ArrowRight className="h-5 w-5 text-pb-blue" />
              </div>
              <div>
                <p className="font-bold text-pb-blue text-xs mb-1.5 uppercase tracking-wide">Próxima Decisão</p>
                <p className="text-pb-text text-sm leading-relaxed">{diagnosis.nextDecision}</p>
              </div>
            </div>
          )}

          <GargaloAlert bottleneck={diagnosis.mainBottleneck} />

          <div className="grid md:grid-cols-3 gap-4">
            <DiagnosticoCard
              title="Topo de Funil"
              diagnosis={diagnosis.topFunnel.diagnosis}
              status={diagnosis.topFunnel.status}
              evidence={diagnosis.topFunnel.evidence}
              actions={diagnosis.topFunnel.actions}
            />
            <DiagnosticoCard
              title="Meio de Funil"
              diagnosis={diagnosis.middleFunnel.diagnosis}
              status={diagnosis.middleFunnel.status}
              evidence={diagnosis.middleFunnel.evidence}
              actions={diagnosis.middleFunnel.actions}
            />
            <DiagnosticoCard
              title="Fundo de Funil"
              diagnosis={diagnosis.bottomFunnel.diagnosis}
              status={diagnosis.bottomFunnel.status}
              evidence={diagnosis.bottomFunnel.evidence}
              actions={diagnosis.bottomFunnel.actions}
            />
          </div>

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

      {/* ── Modo Manual de IA ─────────────────────────────────────── */}
      <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
        <button
          onClick={() => setManualOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-pb-card-alt transition-colors"
        >
          <div className="flex items-center gap-3">
            <Brain className="h-4 w-4 text-pb-muted" />
            <span className="font-semibold text-pb-text text-sm">Modo Manual de IA</span>
            <span className="text-[10px] text-pb-muted px-2 py-0.5 rounded-md bg-pb-card-alt border border-pb-border">
              Claude / GPT / Gemini
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-pb-muted transition-transform ${manualOpen ? 'rotate-180' : ''}`} />
        </button>

        {manualOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-pb-border">
            <p className="text-pb-muted text-xs leading-relaxed pt-4">
              Gere um prompt completo com os dados da sessão atual. Cole-o em qualquer IA (Claude, ChatGPT, Gemini), obtenha a resposta JSON e cole aqui para processar o diagnóstico.
            </p>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-pb-border font-semibold">Passo 1 — Gerar prompt</p>
              <button
                onClick={generatePrompt}
                disabled={!metrics}
                className="inline-flex items-center gap-2 border border-pb-border hover:border-pb-purple/40 text-pb-muted hover:text-pb-text disabled:opacity-40 font-medium px-4 py-2 rounded-xl text-sm transition-all"
              >
                <Brain className="h-4 w-4" />
                {promptText ? 'Regerar prompt' : 'Gerar prompt com dados atuais'}
              </button>
            </div>

            {promptText && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wide text-pb-border font-semibold">Prompt gerado</p>
                    <button
                      onClick={copyToClipboard}
                      className="inline-flex items-center gap-1.5 text-xs text-pb-purple hover:text-pb-purple/80 transition-colors"
                    >
                      <Clipboard className="h-3 w-3" />
                      Copiar
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={promptText}
                    rows={6}
                    className="w-full bg-pb-card-alt border border-pb-border rounded-xl px-4 py-3 text-xs text-pb-muted font-mono resize-none focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-pb-border font-semibold">Passo 2 — Cole a resposta JSON da IA</p>
                  <textarea
                    value={pastedText}
                    onChange={e => {
                      setPastedText(e.target.value)
                      setManualError(null)
                      setManualSaved(false)
                    }}
                    placeholder={`{"executiveSummary": "...", "topFunnel": {...}, ...}`}
                    rows={8}
                    className="w-full bg-pb-card-alt border border-pb-border rounded-xl px-4 py-3 text-xs text-pb-muted font-mono resize-none focus:outline-none focus:border-pb-purple/40 placeholder:text-pb-border/40 transition-colors"
                  />
                </div>

                {manualError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-pb-red/10 border border-pb-red/30">
                    <AlertTriangle className="h-3.5 w-3.5 text-pb-red shrink-0 mt-0.5" />
                    <p className="text-xs text-pb-red">{manualError}</p>
                  </div>
                )}

                {manualSaved && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-pb-green/10 border border-pb-green/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-pb-green" />
                    <p className="text-xs text-pb-green">Diagnóstico processado e salvo com sucesso.</p>
                  </div>
                )}

                <button
                  onClick={processResponse}
                  disabled={!pastedText.trim()}
                  className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  <Brain className="h-4 w-4" />
                  Processar resposta
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}
