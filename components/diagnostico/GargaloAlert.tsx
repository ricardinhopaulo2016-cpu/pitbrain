import { AlertTriangle } from 'lucide-react'

export function GargaloAlert({ bottleneck }: { bottleneck: string }) {
  return (
    <div className="bg-pb-red/10 border border-pb-red/40 rounded-xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-pb-red/5 to-transparent pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-pb-red/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-pb-red" />
        </div>
        <div>
          <p className="font-bold text-pb-red text-sm mb-1 uppercase tracking-wide">Gargalo Principal Identificado</p>
          <p className="text-pb-text text-sm leading-relaxed">{bottleneck}</p>
        </div>
      </div>
    </div>
  )
}
