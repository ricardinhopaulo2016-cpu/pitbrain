'use client'

import { useState } from 'react'
import { UtmifyBreakdownRow } from '@/types/utmify'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Props {
  rows: UtmifyBreakdownRow[]
  dimensionLabel: string
}

type Preset = 'Essencial' | 'Criativo' | 'Mídia' | 'Funil' | 'Todas'

interface ColDef {
  key: keyof UtmifyBreakdownRow
  label: string
  format: (v: number | null) => string
  presets: Preset[]
}

function fC(v: number | null): string {
  if (v === null || isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fN(v: number | null, d = 0): string {
  if (v === null || isNaN(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v)
}

function fP(v: number | null, d = 2): string {
  if (v === null || isNaN(v)) return '—'
  return `${v.toFixed(d)}%`
}

function fX(v: number | null, d = 2): string {
  if (v === null || isNaN(v)) return '—'
  return `${v.toFixed(d)}x`
}

const COLS: ColDef[] = [
  { key: 'spend',       label: 'Gastos',         format: fC, presets: ['Essencial','Criativo','Funil','Todas'] },
  { key: 'revenue',     label: 'Faturamento',     format: fC, presets: ['Essencial','Todas'] },
  { key: 'profit',      label: 'Lucro',           format: fC, presets: ['Essencial','Todas'] },
  { key: 'roas',        label: 'ROAS',            format: fX, presets: ['Essencial','Criativo','Todas'] },
  { key: 'purchases',   label: 'Vendas',          format: v => fN(v, 0), presets: ['Essencial','Funil','Todas'] },
  { key: 'cpa',         label: 'CPA',             format: fC, presets: ['Funil','Todas'] },
  { key: 'ctr',         label: 'CTR',             format: v => fP(v, 3), presets: ['Criativo','Mídia','Todas'] },
  { key: 'cpc',         label: 'CPC',             format: fC, presets: ['Criativo','Mídia','Todas'] },
  { key: 'cpm',         label: 'CPM',             format: fC, presets: ['Criativo','Mídia','Todas'] },
  { key: 'impressions', label: 'Impressões',      format: v => fN(v, 0), presets: ['Mídia','Todas'] },
  { key: 'clicks',      label: 'Cliques',         format: v => fN(v, 0), presets: ['Mídia','Todas'] },
  { key: 'ic',          label: 'IC',              format: v => fN(v, 0), presets: ['Funil','Todas'] },
  { key: 'cpi',         label: 'CPI',             format: fC, presets: ['Funil','Todas'] },
  { key: 'addToCart',   label: 'Add To Cart',     format: v => fN(v, 0), presets: ['Funil','Todas'] },
  { key: 'hook',        label: 'Hook',            format: v => fP(v, 1), presets: ['Criativo','Todas'] },
  { key: 'margin',      label: 'Margem',          format: v => fP(v, 1), presets: ['Todas'] },
  { key: 'roi',         label: 'ROI',             format: v => fP(v, 1), presets: ['Todas'] },
  { key: 'pageViews',   label: 'Page Views',      format: v => fN(v, 0), presets: ['Todas'] },
]

const PRESETS: Preset[] = ['Essencial', 'Criativo', 'Mídia', 'Funil', 'Todas']

function roasColor(roas: number | null): string {
  if (roas === null) return 'text-pb-muted'
  if (roas >= 3) return 'text-pb-green'
  if (roas >= 1) return 'text-pb-yellow'
  return 'text-pb-red'
}

export function UtmRankingTable({ rows, dimensionLabel }: Props) {
  const [preset, setPreset] = useState<Preset>('Essencial')
  const [sortKey, setSortKey] = useState<keyof UtmifyBreakdownRow>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const visibleCols = COLS.filter(c => c.presets.includes(preset))

  function toggleSort(key: keyof UtmifyBreakdownRow) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = rows.filter(r =>
    !search || r.dimensionName.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    const va = (a[sortKey] as number | null) ?? -Infinity
    const vb = (b[sortKey] as number | null) ?? -Infinity
    return sortDir === 'desc' ? vb - va : va - vb
  })

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset tabs */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid #2A2A40' }}
        >
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: preset === p ? '#8B5CF6' : '#0D0D1A',
                color: preset === p ? '#fff' : '#6B7280',
                borderRight: p !== 'Todas' ? '1px solid #2A2A40' : undefined,
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={`Buscar ${dimensionLabel.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-lg outline-none"
          style={{
            background: '#0D0D1A',
            border: '1px solid #2A2A40',
            color: '#E2E8F0',
          }}
        />

        <span className="text-xs text-pb-muted ml-auto">
          {sorted.length} {sorted.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto rounded-xl"
        style={{ border: '1px solid #2A2A40' }}
      >
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr style={{ background: '#0D0D1A', borderBottom: '1px solid #2A2A40' }}>
              {/* Dimension column */}
              <th className="text-left py-2.5 pl-4 pr-3 text-pb-muted font-medium uppercase tracking-wide whitespace-nowrap">
                {dimensionLabel}
              </th>

              {/* Metric columns */}
              {visibleCols.map(col => (
                <th
                  key={col.key as string}
                  className="text-right py-2.5 px-3 text-pb-muted font-medium uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-pb-text transition-colors select-none"
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === 'desc'
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronUp className="h-3 w-3" />
                      : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.dimensionName + i}
                className="border-b border-pb-border/30 hover:bg-pb-card-alt/20 transition-colors"
                style={i % 2 !== 0 ? { background: 'rgba(255,255,255,0.015)' } : undefined}
              >
                {/* Dimension name */}
                <td
                  className="py-2.5 pl-4 pr-3 text-pb-text font-medium max-w-[200px] truncate"
                  title={row.dimensionName}
                >
                  {row.dimensionName}
                </td>

                {/* Metric cells */}
                {visibleCols.map(col => {
                  const val = row[col.key] as number | null
                  const formatted = col.format(val)
                  const isRoas = col.key === 'roas'
                  return (
                    <td
                      key={col.key as string}
                      className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        isRoas ? roasColor(val) : val === null || isNaN(val as number) ? 'text-pb-muted/40' : 'text-pb-text'
                      }`}
                    >
                      {formatted}
                    </td>
                  )
                })}
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={visibleCols.length + 1}
                  className="py-8 text-center text-pb-muted text-xs"
                >
                  {search ? `Nenhum resultado para "${search}"` : 'Sem dados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
