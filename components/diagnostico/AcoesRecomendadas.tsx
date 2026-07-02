import { Zap, FlaskConical, ShieldAlert } from 'lucide-react'
import { RecommendedAction, TestForTomorrow } from '@/types/diagnosis'

const priorityConfig = {
  alta:  { cls: 'bg-pb-red/10 border-pb-red/30 text-pb-red',     label: 'Alta'  },
  media: { cls: 'bg-pb-yellow/10 border-pb-yellow/30 text-pb-yellow', label: 'Média' },
  baixa: { cls: 'bg-pb-green/10 border-pb-green/30 text-pb-green',   label: 'Baixa' },
}

const riskConfig = {
  baixo: { cls: 'text-pb-green',  label: 'Baixo' },
  medio: { cls: 'text-pb-yellow', label: 'Médio' },
  alto:  { cls: 'text-pb-red',    label: 'Alto'  },
}

interface AcoesRecomendadasProps {
  actions: RecommendedAction[]
  tests:   TestForTomorrow[]
  risks:   string[]
}

export function AcoesRecomendadas({ actions, tests, risks }: AcoesRecomendadasProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Ações */}
      <div className="bg-pb-card border border-pb-border rounded-xl p-5"
        style={{ borderTop: '2px solid var(--color-pb-blue)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-pb-blue" />
          <h3 className="font-semibold text-pb-text text-sm">Ações Recomendadas</h3>
        </div>
        <div className="space-y-3">
          {actions.map((a, i) => {
            const p = priorityConfig[a.priority]
            const r = riskConfig[a.risk]
            return (
              <div key={i} className="border border-pb-border rounded-lg p-3 bg-pb-card-alt">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${p.cls}`}>
                    {p.label}
                  </span>
                  <span className={`text-[10px] font-medium ${r.cls}`}>
                    Risco: {r.label}
                  </span>
                </div>
                <p className="text-xs text-pb-text font-medium leading-relaxed">{a.action}</p>
                <p className="text-[11px] text-pb-muted mt-1 leading-relaxed">{a.reason}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Testes */}
      <div className="bg-pb-card border border-pb-border rounded-xl p-5"
        style={{ borderTop: '2px solid var(--color-pb-purple)' }}>
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="h-4 w-4 text-pb-purple" />
          <h3 className="font-semibold text-pb-text text-sm">Testes para Amanhã</h3>
        </div>
        <div className="space-y-3">
          {tests.map((t, i) => (
            <div key={i} className="border border-pb-border rounded-lg p-3 bg-pb-card-alt">
              <p className="text-xs text-pb-text font-medium leading-relaxed mb-1.5">{t.test}</p>
              <p className="text-[11px] text-pb-muted leading-relaxed mb-1">
                <span className="text-pb-border font-medium">Hipótese:</span> {t.hypothesis}
              </p>
              <p className="text-[11px] text-pb-purple leading-relaxed">
                <span className="font-medium">Sucesso:</span> {t.successMetric}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Riscos */}
      <div className="bg-pb-card border border-pb-border rounded-xl p-5"
        style={{ borderTop: '2px solid var(--color-pb-yellow)' }}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-4 w-4 text-pb-yellow" />
          <h3 className="font-semibold text-pb-text text-sm">Riscos Identificados</h3>
        </div>
        <ol className="space-y-3">
          {risks.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-pb-yellow/20 text-pb-yellow">
                {i + 1}
              </span>
              <span className="leading-relaxed text-pb-muted text-xs">{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
