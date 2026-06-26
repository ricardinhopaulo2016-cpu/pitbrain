import { TrendingUp, TrendingDown } from 'lucide-react'

interface CampaignListProps {
  good: string[]
  bad: string[]
}

export function CampaignList({ good, bad }: CampaignListProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-pb-green" />
          <h3 className="font-semibold text-pb-text text-sm">Bom desempenho</h3>
        </div>
        {good.length === 0 ? (
          <p className="text-sm text-pb-muted">Nenhuma campanha destacada.</p>
        ) : (
          good.map(name => (
            <span key={name} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-pb-green/10 border border-pb-green/30 text-pb-green text-xs font-medium block w-fit">
              {name}
            </span>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-4 w-4 text-pb-red" />
          <h3 className="font-semibold text-pb-text text-sm">Mau desempenho</h3>
        </div>
        {bad.length === 0 ? (
          <p className="text-sm text-pb-muted">Nenhuma campanha crítica.</p>
        ) : (
          bad.map(name => (
            <span key={name} className="inline-flex items-center px-3 py-1.5 rounded-lg bg-pb-red/10 border border-pb-red/30 text-pb-red text-xs font-medium block w-fit">
              {name}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
