import { Zap, FlaskConical, ShieldAlert } from 'lucide-react'

interface AcoesRecomendadasProps {
  actions: string[]
  tests: string[]
  risks: string[]
}

function NumberedList({ items, color, dotColor }: { items: string[]; color: string; dotColor: string }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${dotColor}`}>
            {i + 1}
          </span>
          <span className={`leading-relaxed ${color}`}>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function AcoesRecomendadas({ actions, tests, risks }: AcoesRecomendadasProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-pb-card border border-pb-border border-t-2 border-t-pb-blue rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-pb-blue" />
          <h3 className="font-semibold text-pb-text text-sm">Ações Recomendadas</h3>
        </div>
        <NumberedList
          items={actions}
          color="text-pb-muted"
          dotColor="bg-pb-blue/20 text-pb-blue"
        />
      </div>

      <div className="bg-pb-card border border-pb-border border-t-2 border-t-pb-purple rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="h-4 w-4 text-pb-purple" />
          <h3 className="font-semibold text-pb-text text-sm">Testes para Amanhã</h3>
        </div>
        <NumberedList
          items={tests}
          color="text-pb-muted"
          dotColor="bg-pb-purple/20 text-pb-purple"
        />
      </div>

      <div className="bg-pb-card border border-pb-border border-t-2 border-t-pb-yellow rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-4 w-4 text-pb-yellow" />
          <h3 className="font-semibold text-pb-text text-sm">Riscos Identificados</h3>
        </div>
        <NumberedList
          items={risks}
          color="text-pb-muted"
          dotColor="bg-pb-yellow/20 text-pb-yellow"
        />
      </div>
    </div>
  )
}
