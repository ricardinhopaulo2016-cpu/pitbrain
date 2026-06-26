'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CampaignMetrics } from '@/types/metrics'
import { formatCurrency, formatPercent, formatNumber, cn } from '@/lib/utils'
import { ArrowUpDown } from 'lucide-react'
import { StatusBadge, CampaignStatus } from '@/components/ui/status-badge'

interface CampaignTableProps {
  campaigns: CampaignMetrics[]
}

type SortKey = keyof CampaignMetrics
type SortDir = 'asc' | 'desc'

function inferStatus(c: CampaignMetrics): CampaignStatus {
  if (c.roas >= 3 && c.ctr >= 0.015) return 'ESCALAR'
  if (c.roas >= 2) return 'MANTER'
  if (c.roas >= 1) return 'OBSERVAR'
  if (c.roas < 1 && c.spend > 0) return 'PAUSAR'
  return 'TESTAR'
}

function roasBadge(roas: number) {
  const color = roas >= 3 ? 'text-pb-green' : roas >= 1 ? 'text-pb-yellow' : 'text-pb-red'
  return <span className={cn('font-semibold text-sm', color)}>{formatNumber(roas)}x</span>
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    return (
      <button
        className="flex items-center gap-1 text-pb-muted hover:text-pb-text transition-colors whitespace-nowrap"
        onClick={() => handleSort(k)}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-pb-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-pb-card-alt border-b border-pb-border hover:bg-pb-card-alt">
            <TableHead className="w-[200px] text-pb-muted text-xs uppercase tracking-wide">Campanha</TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="spend" label="Gasto" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="revenue" label="Receita" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="roas" label="ROAS" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="cpa" label="CPA" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="ctr" label="CTR" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="cpc" label="CPC" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="cpm" label="CPM" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide"><SortButton k="purchases" label="Vendas" /></TableHead>
            <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Status IA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(c => {
            const status = inferStatus(c)
            const rowAccent =
              status === 'PAUSAR'  ? 'bg-pb-red/5 hover:bg-pb-red/10' :
              status === 'ESCALAR' ? 'bg-pb-green/5 hover:bg-pb-green/10' :
              'hover:bg-pb-card-alt'

            return (
              <TableRow key={c.campaignId || c.campaignName} className={cn('border-b border-pb-border transition-colors', rowAccent)}>
                <TableCell className="font-medium text-sm text-pb-text truncate max-w-[200px]" title={c.campaignName}>
                  {c.campaignName}
                </TableCell>
                <TableCell className="text-pb-muted text-sm">{formatCurrency(c.spend)}</TableCell>
                <TableCell className="text-pb-text text-sm">{formatCurrency(c.revenue)}</TableCell>
                <TableCell>{roasBadge(c.roas)}</TableCell>
                <TableCell className="text-pb-muted text-sm">{formatCurrency(c.cpa)}</TableCell>
                <TableCell className="text-pb-muted text-sm">{formatPercent(c.ctr)}</TableCell>
                <TableCell className="text-pb-muted text-sm">{formatCurrency(c.cpc)}</TableCell>
                <TableCell className="text-pb-muted text-sm">{formatCurrency(c.cpm)}</TableCell>
                <TableCell className="text-pb-text text-sm font-medium">{formatNumber(c.purchases, 0)}</TableCell>
                <TableCell><StatusBadge status={status} /></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
