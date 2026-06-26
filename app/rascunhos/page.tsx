'use client'

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { useSessionStore } from '@/store/sessionStore'
import { FileText, Upload, Info, Target, Users, Image as ImageIcon, Type, DollarSign, Edit3, Download, CheckCircle2 } from 'lucide-react'

interface CampaignDraft {
  name: string
  objective: string
  audience: string
  format: string
  budget: string
  copy: string
  hypothesis: string
  risk: 'baixo' | 'médio' | 'alto'
}

function buildDrafts(goodCampaigns: string[], actions: string[]): CampaignDraft[] {
  const drafts: CampaignDraft[] = []

  if (goodCampaigns.length > 0) {
    drafts.push({
      name: `Escala — ${goodCampaigns[0]}`,
      objective: 'Conversão (compras)',
      audience: 'Lookalike 1% baseado em compradores dos últimos 30 dias',
      format: 'Mesmo criativo da campanha de referência',
      budget: 'Aumentar orçamento em 20% em relação à campanha original',
      copy: 'Manter headline e oferta que já converte. Testar variação de CTA.',
      hypothesis: `Expandir audiência similar à campanha "${goodCampaigns[0]}" que apresentou bom ROAS.`,
      risk: 'baixo',
    })
  }

  if (actions.length > 0) {
    drafts.push({
      name: 'Teste de Criativo — Vídeo vs. Imagem',
      objective: 'Conversão (compras)',
      audience: 'Público quente (visitantes dos últimos 7 dias)',
      format: 'Vídeo curto (15s) vs. imagem estática com oferta direta',
      budget: 'R$ 50/dia por variação — mínimo 3 dias para dados significativos',
      copy: 'Testar headline focado em benefício vs. headline focado em urgência.',
      hypothesis: 'Identificar qual formato converte melhor no fundo de funil.',
      risk: 'médio',
    })
  }

  drafts.push({
    name: 'Recuperação de Carrinho Abandonado',
    objective: 'Conversão (compras)',
    audience: 'Iniciaram checkout mas não compraram nos últimos 3 dias',
    format: 'Imagem + oferta de frete grátis ou desconto de 10%',
    budget: 'R$ 30/dia — orçamento baixo, segmento pequeno e qualificado',
    copy: '"Você esqueceu algo? Seu [produto] ainda está disponível."',
    hypothesis: 'Recuperar parcela de quem chegou ao checkout mas não converteu.',
    risk: 'baixo',
  })

  return drafts
}

const draftIcons = [Target, Users, ImageIcon, Type, DollarSign, FileText]

const riskConfig = {
  baixo: 'bg-pb-green/10 border-pb-green/30 text-pb-green',
  médio: 'bg-pb-yellow/10 border-pb-yellow/30 text-pb-yellow',
  alto:  'bg-pb-red/10 border-pb-red/30 text-pb-red',
}

export default function RascunhosPage() {
  const { sessionId, diagnosis } = useSessionStore()
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

  const drafts = buildDrafts(
    diagnosis?.goodCampaigns ?? [],
    diagnosis?.recommendedActions ?? []
  )

  const draftFields: { key: keyof CampaignDraft; label: string; iconIndex: number }[] = [
    { key: 'objective', label: 'Objetivo', iconIndex: 0 },
    { key: 'audience', label: 'Público', iconIndex: 1 },
    { key: 'format', label: 'Formato', iconIndex: 2 },
    { key: 'copy', label: 'Copy / Headline', iconIndex: 3 },
    { key: 'budget', label: 'Orçamento sugerido', iconIndex: 4 },
    { key: 'hypothesis', label: 'Hipótese do teste', iconIndex: 5 },
  ]

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Rascunhos de Campanha</h1>
        <p className="text-pb-muted text-sm mt-1">
          Sugestões geradas com base no diagnóstico. Revise antes de implementar manualmente.
        </p>
      </div>

      {/* Aviso */}
      <div className="bg-pb-yellow/10 border border-pb-yellow/30 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
        <p className="text-sm text-pb-muted">
          Estes são <strong className="text-pb-text">rascunhos para revisão</strong>. Nenhuma campanha é criada ou publicada automaticamente.
          Toda implementação deve ser feita manualmente no Gerenciador de Anúncios da Meta.
        </p>
      </div>

      {/* No diagnosis state */}
      {!diagnosis && (
        <div className="bg-pb-card border border-dashed border-pb-border rounded-xl p-8 text-center">
          <FileText className="h-10 w-10 text-pb-muted mx-auto mb-3" />
          <p className="text-pb-muted text-sm mb-3">
            Gere o diagnóstico IA primeiro para obter rascunhos personalizados.
          </p>
          <button
            onClick={() => router.push('/diagnostico')}
            className="text-pb-purple hover:text-pb-purple/80 text-sm font-medium"
          >
            Ir para diagnóstico →
          </button>
        </div>
      )}

      {/* Draft cards */}
      <div className="space-y-4">
        {drafts.map((draft, di) => (
          <div key={di} className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pb-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pb-purple/10 border border-pb-purple/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-pb-purple" />
                </div>
                <div>
                  <p className="font-semibold text-pb-text text-sm">{draft.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-pb-card-alt border border-pb-border text-pb-muted">
                      Rascunho #{di + 1}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${riskConfig[draft.risk]}`}>
                      Risco: {draft.risk}
                    </span>
                  </div>
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pb-card-alt border border-pb-border text-pb-muted hover:text-pb-text text-xs transition-colors">
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pb-card-alt border border-pb-border text-pb-muted hover:text-pb-text text-xs transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pb-green/10 border border-pb-green/30 text-pb-green hover:bg-pb-green/20 text-xs transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprovar
                </button>
              </div>
            </div>

            {/* Card body */}
            <div className="p-5">
              <div className="grid md:grid-cols-2 gap-4">
                {draftFields.map(field => {
                  const Icon = draftIcons[field.iconIndex]
                  return (
                    <div key={field.key} className="flex gap-3">
                      <div className="w-7 h-7 rounded-md bg-pb-card-alt border border-pb-border flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-pb-muted" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-pb-muted uppercase tracking-wide">{field.label}</p>
                        <p className="text-sm text-pb-text leading-relaxed mt-0.5">{draft[field.key]}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
