'use client'

import { UtmifyDailyRow } from '@/types/utmify'
import { safeNumber } from '@/lib/calculators/local-metrics'
import { CalendarDays } from 'lucide-react'

interface Props {
  rows: UtmifyDailyRow[]
}

function fC(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fN(v: number | null): string {
  if (v === null) return '—'
  const n = Math.round(v)
  if (n === 0) return '—'
  return new Intl.NumberFormat('pt-BR').format(n)
}

function fP(v: number | null, d = 2): string {
  if (v === null) return '—'
  return `${v.toFixed(d)}%`
}

function fX(v: number | null, d = 2): string {
  if (v === null) return '—'
  return `${v.toFixed(d)}x`
}

function rowRoas(row: UtmifyDailyRow): number | null {
  const s = safeNumber(row.spend)
  const r = safeNumber(row.revenue)
  return s > 0 ? r / s : null
}

function rowCpa(row: UtmifyDailyRow): number | null {
  const s = safeNumber(row.spend)
  const p = safeNumber(row.purchases)
  return p > 0 ? s / p : null
}

function rowCpi(row: UtmifyDailyRow): number | null {
  const s = safeNumber(row.spend)
  const ic = safeNumber(row.initiateCheckout)
  return ic > 0 ? s / ic : null
}

function rowCpc(row: UtmifyDailyRow): number | null {
  const s = safeNumber(row.spend)
  const c = safeNumber(row.clicks)
  return c > 0 ? s / c : null
}

function rowCtr(row: UtmifyDailyRow): number | null {
  const c = safeNumber(row.clicks)
  const i = safeNumber(row.impressions)
  return i > 0 ? (c / i) * 100 : null
}

function rowCpm(row: UtmifyDailyRow): number | null {
  const s = safeNumber(row.spend)
  const i = safeNumber(row.impressions)
  return i > 0 ? (s / i) * 1000 : null
}

const COLS = [
  { key: 'date',        label: 'Data' },
  { key: 'spend',       label: 'Gasto' },
  { key: 'revenue',     label: 'Faturamento' },
  { key: 'profit',      label: 'Lucro' },
  { key: 'purchases',   label: 'Vendas' },
  { key: 'roas',        label: 'ROAS' },
  { key: 'cpa',         label: 'CPA' },
  { key: 'ic',          label: 'IC' },
  { key: 'cpi',         label: 'CPI' },
  { key: 'cpc',         label: 'CPC' },
  { key: 'ctr',         label: 'CTR' },
  { key: 'cpm',         label: 'CPM' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'clicks',      label: 'Cliques' },
  { key: 'pageViews',   label: 'Page Views' },
]

export function DailyPerformanceTable({ rows }: Props) {
  if (rows.length === 0) return null

  const hasProfit = rows.some(r => r.profit !== null)

  const tot = {
    spend:            rows.reduce((s, r) => s + safeNumber(r.spend),           0),
    revenue:          rows.reduce((s, r) => s + safeNumber(r.revenue),         0),
    profit:           hasProfit ? rows.reduce((s, r) => s + safeNumber(r.profit), 0) : null,
    purchases:        rows.reduce((s, r) => s + safeNumber(r.purchases),       0),
    initiateCheckout: rows.reduce((s, r) => s + safeNumber(r.initiateCheckout),0),
    clicks:           rows.reduce((s, r) => s + safeNumber(r.clicks),          0),
    impressions:      rows.reduce((s, r) => s + safeNumber(r.impressions),     0),
    pageViews:        rows.reduce((s, r) => s + safeNumber(r.pageViews),       0),
  }

  const totRoas = tot.spend > 0       ? tot.revenue / tot.spend               : null
  const totCpa  = tot.purchases > 0   ? tot.spend / tot.purchases             : null
  const totCpi  = tot.initiateCheckout > 0 ? tot.spend / tot.initiateCheckout : null
  const totCpc  = tot.clicks > 0      ? tot.spend / tot.clicks                : null
  const totCtr  = tot.impressions > 0 ? (tot.clicks / tot.impressions) * 100  : null
  const totCpm  = tot.impressions > 0 ? (tot.spend / tot.impressions) * 1000  : null

  const thCls = 'py-3 px-3 text-left text-xs font-medium text-pb-muted uppercase tracking-wide whitespace-nowrap'
  const tdCls = 'py-2.5 px-3 text-pb-text tabular-nums whitespace-nowrap text-xs'
  const totCls = 'py-3 px-3 text-pb-text tabular-nums whitespace-nowrap text-xs font-semibold'

  return (
    <section className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-pb-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-pb-blue" />
          <h2 className="font-semibold text-pb-text text-sm">Performance por Dia</h2>
        </div>
        <span className="text-xs text-pb-muted">{rows.length} dia{rows.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: '1200px' }}>
          <thead>
            <tr className="border-b border-pb-border bg-pb-card-alt/40">
              {COLS.map(c => (
                <th key={c.key} className={thCls}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.date ?? i}
                className={`border-b border-pb-border/30 hover:bg-pb-card-alt/25 transition-colors ${
                  i % 2 !== 0 ? 'bg-pb-card-alt/10' : ''
                }`}
              >
                <td className={`${tdCls} font-medium text-pb-text/90`}>{row.date ?? '—'}</td>
                <td className={tdCls}>{fC(row.spend)}</td>
                <td className={tdCls}>{fC(row.revenue)}</td>
                <td className={`${tdCls} ${
                  row.profit !== null
                    ? safeNumber(row.profit) >= 0 ? 'text-pb-green' : 'text-pb-red'
                    : 'text-pb-muted'
                }`}>
                  {fC(row.profit)}
                </td>
                <td className={tdCls}>{fN(row.purchases)}</td>
                <td className={`${tdCls} font-mono`}>{fX(rowRoas(row))}</td>
                <td className={tdCls}>{fC(rowCpa(row))}</td>
                <td className={tdCls}>{fN(row.initiateCheckout)}</td>
                <td className={tdCls}>{fC(rowCpi(row))}</td>
                <td className={tdCls}>{fC(rowCpc(row))}</td>
                <td className={`${tdCls} font-mono`}>{fP(rowCtr(row), 4)}</td>
                <td className={tdCls}>{fC(rowCpm(row))}</td>
                <td className={tdCls}>{fN(row.impressions)}</td>
                <td className={tdCls}>{fN(row.clicks)}</td>
                <td className={tdCls}>{fN(row.pageViews)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-pb-border bg-pb-card-alt/50">
              <td className={`${totCls} text-pb-muted uppercase tracking-wide text-xs`}>Total</td>
              <td className={totCls}>{fC(tot.spend)}</td>
              <td className={totCls}>{fC(tot.revenue)}</td>
              <td className={`${totCls} ${
                tot.profit !== null
                  ? tot.profit >= 0 ? 'text-pb-green' : 'text-pb-red'
                  : 'text-pb-muted'
              }`}>
                {fC(tot.profit)}
              </td>
              <td className={totCls}>{fN(tot.purchases)}</td>
              <td className={`${totCls} font-mono`}>{fX(totRoas)}</td>
              <td className={totCls}>{fC(totCpa)}</td>
              <td className={totCls}>{fN(tot.initiateCheckout)}</td>
              <td className={totCls}>{fC(totCpi)}</td>
              <td className={totCls}>{fC(totCpc)}</td>
              <td className={`${totCls} font-mono`}>{fP(totCtr, 4)}</td>
              <td className={totCls}>{fC(totCpm)}</td>
              <td className={totCls}>{fN(tot.impressions)}</td>
              <td className={totCls}>{fN(tot.clicks)}</td>
              <td className={totCls}>{fN(tot.pageViews)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
