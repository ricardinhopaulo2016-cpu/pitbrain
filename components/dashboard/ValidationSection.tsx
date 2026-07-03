'use client'

import { FunnelMetrics } from '@/types/metrics'
import { ImportSummary } from '@/lib/calculators/local-metrics'
import { ShieldCheck } from 'lucide-react'

interface Props {
  overall: FunnelMetrics
  summary: ImportSummary | null
  sourceType: 'utmify_orders' | 'utmify_daily_aggregate' | 'utmify_utm_breakdown' | 'meta_ads_structure' | 'utmify_mcp' | null
}

function fC(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fN(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(v))
}

function fP(v: number, d = 2): string {
  return `${v.toFixed(d)}%`
}

function fX(v: number, d = 2): string {
  return `${v.toFixed(d)}x`
}

interface CalcRow {
  metric: string
  formula: string
  values: string
  result: string
  ok: boolean
  naReason: string
}

function buildRow(
  metric: string,
  formula: string,
  num: number | null,
  den: number | null,
  numStr: string,
  denStr: string,
  mult: number,
  fmt: (v: number) => string,
  naReason: string,
): CalcRow {
  const multStr = mult !== 1 ? ` × ${mult}` : ''
  const ok =
    num !== null && den !== null &&
    !isNaN(num) && !isNaN(den) &&
    den !== 0
  if (!ok) {
    return {
      metric, formula,
      values: `${numStr} ÷ ${denStr}${multStr}`,
      result: 'N/A',
      ok: false,
      naReason,
    }
  }
  return {
    metric, formula,
    values: `${numStr} ÷ ${denStr}${multStr}`,
    result: fmt((num! / den!) * mult),
    ok: true,
    naReason: '',
  }
}

export function ValidationSection({ overall, summary, sourceType }: Props) {
  const { spend, revenue, purchases, clicks, impressions, pageViews, initiateCheckouts } = overall

  const isDailyAggregate = sourceType === 'utmify_daily_aggregate' || sourceType === 'utmify_utm_breakdown'
  const profit: number | null = isDailyAggregate ? (summary?.profit ?? null) : null

  const totals = [
    { label: 'Gasto',           value: fC(spend) },
    { label: 'Faturamento',     value: fC(revenue) },
    { label: 'Lucro',           value: profit !== null ? fC(profit) : '—' },
    { label: 'Vendas',          value: fN(purchases) },
    { label: 'IC/Add To Cart',  value: fN(initiateCheckouts) },
    { label: 'Cliques',         value: fN(clicks) },
    { label: 'Impressões',      value: fN(impressions) },
    { label: 'Page Views',      value: fN(pageViews) },
  ]

  const roiNaReason =
    profit === null ? 'Coluna Lucro ausente nos dados' : 'Gasto = 0'

  const rows: CalcRow[] = [
    buildRow('ROAS',          'Faturamento ÷ Gasto',            revenue,           spend,              fC(revenue),                    fC(spend),                         1,    fX,                   'Gasto = 0'),
    buildRow('ROI',           'Lucro ÷ Gasto × 100',            profit,            spend,              profit !== null ? fC(profit) : '—', fC(spend),                  100,  fP,                   roiNaReason),
    buildRow('CPA',           'Gasto ÷ Vendas',                 spend,             purchases,          fC(spend),                      `${fN(purchases)} vendas`,         1,    fC,                   'Vendas = 0'),
    buildRow('CPI',           'Gasto ÷ IC/ATC',                 spend,             initiateCheckouts,  fC(spend),                      `${fN(initiateCheckouts)} IC/ATC`, 1,    fC,                   'IC/Add To Cart = 0'),
    buildRow('CPC',           'Gasto ÷ Cliques',                spend,             clicks,             fC(spend),                      `${fN(clicks)} cliques`,           1,    fC,                   'Cliques = 0'),
    buildRow('CTR',           'Cliques ÷ Impressões × 100',     clicks,            impressions,        `${fN(clicks)} cliques`,        `${fN(impressions)} imp`,          100,  (v) => fP(v, 4),      'Impressões = 0'),
    buildRow('CPM',           'Gasto ÷ Impressões × 1000',      spend,             impressions,        fC(spend),                      `${fN(impressions)} imp`,          1000, fC,                   'Impressões = 0'),
    buildRow('PV → IC/ATC',   'IC/ATC ÷ Page Views × 100',      initiateCheckouts, pageViews,          `${fN(initiateCheckouts)} IC/ATC`, `${fN(pageViews)} PV`,          100,  fP,                   'Page Views ausente neste import'),
    buildRow('IC/ATC → Venda','Vendas ÷ IC/ATC × 100',          purchases,         initiateCheckouts,  `${fN(purchases)} vendas`,      `${fN(initiateCheckouts)} IC/ATC`, 100,  fP,                   'IC/Add To Cart = 0'),
    buildRow('Clique → Venda','Vendas ÷ Cliques × 100',         purchases,         clicks,             `${fN(purchases)} vendas`,      `${fN(clicks)} cliques`,           100,  fP,                   'Cliques = 0'),
  ]

  const okCount = rows.filter(r => r.ok).length

  return (
    <section className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-5 border-b border-pb-border">
        <ShieldCheck className="h-4 w-4 text-pb-purple" />
        <h2 className="font-semibold text-pb-text text-sm">Validação dos Cálculos</h2>
        <span className="ml-auto text-xs text-pb-muted">
          {okCount}/{rows.length} métricas calculadas
        </span>
      </div>

      {/* Raw totals */}
      <div className="p-5 border-b border-pb-border">
        <p className="text-xs font-medium text-pb-muted uppercase tracking-wide mb-3">
          Totais Brutos Somados
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {totals.map(t => (
            <div key={t.label} className="bg-pb-card-alt rounded-lg px-3 py-2.5">
              <p className="text-xs text-pb-muted mb-0.5">{t.label}</p>
              <p className="text-sm font-semibold text-pb-text font-mono tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Formula table */}
      <div className="p-5 pb-2">
        <p className="text-xs font-medium text-pb-muted uppercase tracking-wide mb-3">
          Fórmulas Aplicadas
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-y border-pb-border bg-pb-card-alt/40">
              <th className="text-left py-2.5 pl-5 pr-3 text-xs font-medium text-pb-muted uppercase tracking-wide w-36">
                Métrica
              </th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-pb-muted uppercase tracking-wide">
                Fórmula
              </th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-pb-muted uppercase tracking-wide">
                Valores Usados
              </th>
              <th className="text-right py-2.5 pl-3 pr-5 text-xs font-medium text-pb-muted uppercase tracking-wide w-44">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.metric}
                className={`border-b border-pb-border/40 hover:bg-pb-card-alt/20 transition-colors ${
                  i % 2 !== 0 ? 'bg-pb-card-alt/10' : ''
                }`}
              >
                <td className="py-3 pl-5 pr-3 font-semibold text-pb-text text-sm whitespace-nowrap">
                  {row.metric}
                </td>
                <td className="py-3 px-3 text-pb-muted font-mono text-xs whitespace-nowrap">
                  {row.formula}
                </td>
                <td className="py-3 px-3 text-pb-muted/70 font-mono text-xs">
                  {row.values}
                </td>
                <td className="py-3 pl-3 pr-5 text-right">
                  {row.ok ? (
                    <span className="font-semibold text-pb-text font-mono tabular-nums">
                      {row.result}
                    </span>
                  ) : (
                    <span className="text-xs text-pb-muted/50 italic">
                      N/A — {row.naReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-2" />
    </section>
  )
}
