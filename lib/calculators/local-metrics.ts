import { UtmifyDailyRow, UtmifySession, UtmifyParseResult } from '@/types/utmify'
import { FunnelMetrics, SummaryMetrics } from '@/types/metrics'

// ── Defensive helpers ────────────────────────────────────────────────────────

export function safeNumber(val: number | null | undefined): number {
  if (val === null || val === undefined || isNaN(val as number)) return 0
  return val as number
}

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0 || isNaN(denominator)) return 0
  const result = numerator / denominator
  return isNaN(result) ? 0 : result
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function formatPercent(val: number, decimals = 2): string {
  return `${(val * 100).toFixed(decimals)}%`
}

export function formatNumber(val: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(val)
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportSummary {
  startDate: string | null
  endDate: string | null
  days: number
  spend: number
  revenue: number
  profit: number
  purchases: number
  initiateCheckout: number
  clicks: number
  impressions: number
  pageViews: number
  roas: number | null
  roi: number | null
  cpa: number | null
  cpi: number | null
  cpc: number | null
  ctr: number | null
  cpm: number | null
}

export interface LastImport {
  sourceType: 'utmify_orders' | 'utmify_daily_aggregate'
  fileName: string
  importedAt: string
  rows: UtmifySession[] | UtmifyDailyRow[]
  summary: ImportSummary
}

// ── localStorage I/O ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'pitbrain:lastImport'

export function saveLastImport(data: LastImport): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    console.log('[pitbrain] Saved to localStorage:', {
      sourceType: data.sourceType,
      fileName: data.fileName,
      rows: data.rows.length,
    })
  } catch (err) {
    console.error('[pitbrain] Failed to save to localStorage:', err)
  }
}

export function loadLastImport(): LastImport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastImport
    console.log('[pitbrain] Loaded from localStorage:', {
      sourceType: parsed.sourceType,
      fileName: parsed.fileName,
      rows: parsed.rows?.length ?? 0,
      importedAt: parsed.importedAt,
    })
    return parsed
  } catch (err) {
    console.error('[pitbrain] Failed to load from localStorage:', err)
    return null
  }
}

// ── Summary calculation ──────────────────────────────────────────────────────

export function buildImportSummary(parseResult: UtmifyParseResult): ImportSummary {
  if (parseResult.sourceType === 'utmify_daily_aggregate') {
    const rows = parseResult.rows as UtmifyDailyRow[]
    const spend = rows.reduce((s, r) => s + safeNumber(r.spend), 0)
    const revenue = rows.reduce((s, r) => s + safeNumber(r.revenue), 0)
    const profit = rows.reduce((s, r) => s + safeNumber(r.profit), 0)
    const purchases = rows.reduce((s, r) => s + safeNumber(r.purchases), 0)
    const ic = rows.reduce((s, r) => s + safeNumber(r.initiateCheckout), 0)
    const clicks = rows.reduce((s, r) => s + safeNumber(r.clicks), 0)
    const impressions = rows.reduce((s, r) => s + safeNumber(r.impressions), 0)
    const pageViews = rows.reduce((s, r) => s + safeNumber(r.pageViews), 0)
    const dates = rows.map(r => r.date).filter((d): d is string => !!d).sort()

    return {
      startDate: dates[0] ?? null,
      endDate: dates[dates.length - 1] ?? null,
      days: rows.length,
      spend,
      revenue,
      profit,
      purchases,
      initiateCheckout: ic,
      clicks,
      impressions,
      pageViews,
      roas: spend > 0 ? safeDivide(revenue, spend) : null,
      roi: spend > 0 ? safeDivide(profit, spend) : null,
      cpa: purchases > 0 ? safeDivide(spend, purchases) : null,
      cpi: ic > 0 ? safeDivide(spend, ic) : null,
      cpc: clicks > 0 ? safeDivide(spend, clicks) : null,
      ctr: impressions > 0 ? safeDivide(clicks, impressions) : null,
      cpm: impressions > 0 ? safeDivide(spend, impressions) * 1000 : null,
    }
  }

  // Orders mode
  const rows = parseResult.rows as UtmifySession[]
  const PAID = ['paid', 'pago', 'aprovado', 'approved', 'complete', 'completo']
  let revenue = 0
  let purchases = 0
  let pageViews = 0
  let ic = 0
  const dates: string[] = []

  for (const row of rows) {
    const status = (row.status ?? '').toLowerCase().trim()
    if (PAID.includes(status)) {
      revenue += safeNumber(row.grossRevenue)
      purchases += 1
    }
    pageViews += safeNumber(row.pageViews)
    ic += safeNumber(row.initiateCheckouts)
    if (row.orderDate) dates.push(row.orderDate)
  }

  dates.sort()

  return {
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    days: 0,
    spend: 0,
    revenue,
    profit: 0,
    purchases,
    initiateCheckout: ic,
    clicks: 0,
    impressions: 0,
    pageViews,
    roas: null,
    roi: null,
    cpa: null,
    cpi: null,
    cpc: null,
    ctr: null,
    cpm: null,
  }
}

// ── SummaryMetrics builder ───────────────────────────────────────────────────

function buildFunnelFromDaily(rows: UtmifyDailyRow[]): FunnelMetrics {
  const spend = rows.reduce((s, r) => s + safeNumber(r.spend), 0)
  const revenue = rows.reduce((s, r) => s + safeNumber(r.revenue), 0)
  const purchases = rows.reduce((s, r) => s + safeNumber(r.purchases), 0)
  const clicks = rows.reduce((s, r) => s + safeNumber(r.clicks), 0)
  const impressions = rows.reduce((s, r) => s + safeNumber(r.impressions), 0)
  const pageViews = rows.reduce((s, r) => s + safeNumber(r.pageViews), 0)
  const initiateCheckouts = rows.reduce((s, r) => s + safeNumber(r.initiateCheckout), 0)

  // CTR/CPM/CPC always recalculated from totals — never sum per-day ratios
  const ctr = safeDivide(clicks, impressions)
  const cpm = impressions > 0 ? safeDivide(spend, impressions) * 1000 : 0
  const cpc = safeDivide(spend, clicks)

  if (process.env.NODE_ENV === 'development') {
    console.log('[pitbrain:metrics] Daily aggregate totals', {
      impressoes: impressions,
      cliques: clicks,
      pageViews,
      ic: initiateCheckouts,
      vendas: purchases,
      ctrRecalculado: `${(ctr * 100).toFixed(4)}%`,
      cpmRecalculado: `R$ ${cpm.toFixed(2)}`,
      cpcRecalculado: `R$ ${cpc.toFixed(2)}`,
      spend: `R$ ${spend.toFixed(2)}`,
      revenue: `R$ ${revenue.toFixed(2)}`,
    })
  }

  return {
    spend,
    revenue,
    roas: safeDivide(revenue, spend),
    cpa: safeDivide(spend, purchases),
    ctr,
    cpc,
    cpm,
    impressions,
    clicks,
    reach: 0,
    pageViews,
    initiateCheckouts,
    purchases,
    clickToPurchaseRate: safeDivide(purchases, clicks),
    pageViewToCheckoutRate: safeDivide(initiateCheckouts, pageViews),
    checkoutToPurchaseRate: safeDivide(purchases, initiateCheckouts),
  }
}

function buildFunnelFromOrders(rows: UtmifySession[]): FunnelMetrics {
  const PAID = ['paid', 'pago', 'aprovado', 'approved', 'complete', 'completo']
  let revenue = 0
  let purchases = 0
  let pageViews = 0
  let initiateCheckouts = 0

  for (const row of rows) {
    const status = (row.status ?? '').toLowerCase().trim()
    if (PAID.includes(status)) {
      revenue += safeNumber(row.grossRevenue)
      purchases += 1
    }
    pageViews += safeNumber(row.pageViews)
    initiateCheckouts += safeNumber(row.initiateCheckouts)
  }

  return {
    spend: 0,
    revenue,
    roas: 0,
    cpa: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    impressions: 0,
    clicks: 0,
    reach: 0,
    pageViews,
    initiateCheckouts,
    purchases,
    clickToPurchaseRate: 0,
    pageViewToCheckoutRate: safeDivide(initiateCheckouts, pageViews),
    checkoutToPurchaseRate: safeDivide(purchases, initiateCheckouts),
  }
}

export function buildSummaryMetrics(lastImport: LastImport): SummaryMetrics {
  const sessionId = 'local:' + lastImport.importedAt

  if (lastImport.sourceType === 'utmify_daily_aggregate') {
    const rows = lastImport.rows as UtmifyDailyRow[]
    const overall = buildFunnelFromDaily(rows)
    const dates = rows.map(r => r.date).filter((d): d is string => !!d).sort()
    return {
      overall,
      byCampaign: [],
      dateRange: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
      sessionId,
    }
  }

  const rows = lastImport.rows as UtmifySession[]
  const overall = buildFunnelFromOrders(rows)
  const dates = rows.map(r => r.orderDate).filter((d): d is string => !!d).sort()
  return {
    overall,
    byCampaign: [],
    dateRange: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
    sessionId,
  }
}
