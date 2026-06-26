'use client'

import { PageShell } from '@/components/layout/PageShell'
import { useSessionStore } from '@/store/sessionStore'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sparkles, Upload, TrendingUp, TrendingDown, MousePointerClick, DollarSign } from 'lucide-react'

type CreativeTag = 'vendedor' | 'hook-bom' | 'click-barato' | 'cansado'

interface MockCreative {
  id: string
  name: string
  spend: number
  sales: number
  cpa: number
  roas: number
  ctr: number
  cpc: number
  tag: CreativeTag
  diagnosis: string
}

const tagConfig: Record<CreativeTag, { label: string; color: string; bg: string; border: string }> = {
  'vendedor':    { label: 'Criativo Vendedor',          color: 'text-pb-green',  bg: 'bg-pb-green/10',  border: 'border-pb-green/30'  },
  'hook-bom':   { label: 'Hook Bom, Venda Ruim',       color: 'text-pb-yellow', bg: 'bg-pb-yellow/10', border: 'border-pb-yellow/30' },
  'click-barato':{ label: 'Clique Barato, IC Ruim',    color: 'text-pb-blue',   bg: 'bg-pb-blue/10',   border: 'border-pb-blue/30'   },
  'cansado':    { label: 'Criativo Cansado',            color: 'text-pb-red',    bg: 'bg-pb-red/10',    border: 'border-pb-red/30'    },
}

const MOCK_CREATIVES: MockCreative[] = [
  {
    id: '1',
    name: 'Video-Produto-15s-v3',
    spend: 1200,
    sales: 48,
    cpa: 25,
    roas: 4.8,
    ctr: 0.032,
    cpc: 0.85,
    tag: 'vendedor',
    diagnosis: 'Criativo de alto desempenho. CTR e ROAS acima da meta. Candidato a escala.',
  },
  {
    id: '2',
    name: 'Imagem-Oferta-Black',
    spend: 800,
    sales: 12,
    cpa: 66.7,
    roas: 1.8,
    ctr: 0.028,
    cpc: 0.72,
    tag: 'hook-bom',
    diagnosis: 'CTR alto indica bom hook mas venda fraca. Problema no fundo do funil.',
  },
  {
    id: '3',
    name: 'Carrossel-Beneficios',
    spend: 600,
    sales: 8,
    cpa: 75,
    roas: 1.2,
    ctr: 0.009,
    cpc: 0.38,
    tag: 'click-barato',
    diagnosis: 'CPC muito baixo mas CTR ruim e poucos checkouts. Tráfego não qualificado.',
  },
  {
    id: '4',
    name: 'Video-Depoimento-v1',
    spend: 950,
    sales: 6,
    cpa: 158.3,
    roas: 0.7,
    ctr: 0.006,
    cpc: 2.1,
    tag: 'cansado',
    diagnosis: 'CTR em queda, CPC subindo. Criativo esgotado. Pausar ou renovar.',
  },
]

function CreativeCard({ creative }: { creative: MockCreative }) {
  const tag = tagConfig[creative.tag]

  return (
    <div className={cn('bg-pb-card border rounded-xl overflow-hidden', tag.border)}>
      {/* Tag header */}
      <div className={cn('px-4 py-2 border-b', tag.bg, tag.border)}>
        <span className={cn('text-xs font-semibold', tag.color)}>{tag.label}</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="font-semibold text-pb-text text-sm truncate">{creative.name}</p>
          <p className="text-xs text-pb-muted mt-1 leading-relaxed">{creative.diagnosis}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">Gasto</p>
            </div>
            <p className="text-sm font-semibold text-pb-text">R$ {creative.spend.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">Vendas</p>
            </div>
            <p className="text-sm font-semibold text-pb-text">{creative.sales}</p>
          </div>
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">CPA</p>
            </div>
            <p className={cn('text-sm font-semibold', creative.cpa <= 50 ? 'text-pb-green' : creative.cpa <= 100 ? 'text-pb-yellow' : 'text-pb-red')}>
              R$ {creative.cpa.toFixed(0)}
            </p>
          </div>
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">ROAS</p>
            </div>
            <p className={cn('text-sm font-semibold', creative.roas >= 3 ? 'text-pb-green' : creative.roas >= 1 ? 'text-pb-yellow' : 'text-pb-red')}>
              {creative.roas.toFixed(1)}x
            </p>
          </div>
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <MousePointerClick className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">CTR</p>
            </div>
            <p className={cn('text-sm font-semibold', creative.ctr >= 0.02 ? 'text-pb-green' : creative.ctr >= 0.01 ? 'text-pb-yellow' : 'text-pb-red')}>
              {(creative.ctr * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-pb-card-alt rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-pb-muted" />
              <p className="text-[10px] text-pb-muted uppercase tracking-wide">CPC</p>
            </div>
            <p className="text-sm font-semibold text-pb-text">R$ {creative.cpc.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CriativosPage() {
  const { sessionId } = useSessionStore()
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

  return (
    <PageShell className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Criativos</h1>
          <p className="text-pb-muted text-sm mt-0.5">Classificação automática dos seus criativos por desempenho</p>
        </div>
        <div className="flex items-center gap-2 bg-pb-yellow/10 border border-pb-yellow/30 px-3 py-2 rounded-lg">
          <Sparkles className="h-3.5 w-3.5 text-pb-yellow" />
          <p className="text-xs text-pb-yellow font-medium">Dados de exemplo — conecte anúncios para dados reais</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(tagConfig).map(([, cfg]) => (
          <span key={cfg.label} className={cn('inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium', cfg.bg, cfg.border, cfg.color)}>
            {cfg.label}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {MOCK_CREATIVES.map(c => <CreativeCard key={c.id} creative={c} />)}
      </div>
    </PageShell>
  )
}
