import { UtmifyDailyRow, UtmifySession, UtmifyBreakdownRow, UtmifyParseResult, BreakdownLevel } from '@/types/utmify'
import { FunnelMetrics, SummaryMetrics } from '@/types/metrics'
import { ImportMode, ImportSession } from '@/types/import'

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
  addToCart?: number
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
  ignoredFooterRowsCount?: number
}

export interface LastImport {
  sourceType: 'utmify_orders' | 'utmify_daily_aggregate' | 'utmify_utm_breakdown' | 'meta_ads_structure' | 'utmify_mcp'
  fileName: string
  importedAt: string
  rows: UtmifySession[] | UtmifyDailyRow[] | UtmifyBreakdownRow[]
  summary: ImportSummary
  fileHash?: string
  importMode?: ImportMode
  // Only present for utmify_utm_breakdown
  breakdownLevel?: BreakdownLevel
  dimensionField?: string
  dimensionLabel?: string
  ignoredFooterRowsCount?: number
}

const META_STRUCTURE_KEY = 'pitbrain:currentMetaStructure'

export interface MetaStructureInfo {
  fileName: string
  sessionId: string
  importedAt: string
  rowCount: number
}

export function saveMetaStructureInfo(info: MetaStructureInfo): void {
  try {
    localStorage.setItem(META_STRUCTURE_KEY, JSON.stringify(info))
  } catch {}
}

export function loadMetaStructureInfo(): MetaStructureInfo | null {
  try {
    const raw = localStorage.getItem(META_STRUCTURE_KEY)
    return raw ? (JSON.parse(raw) as MetaStructureInfo) : null
  } catch {
    return null
  }
}

export function emptyImportSummary(): ImportSummary {
  return {
    startDate: null, endDate: null, days: 0,
    spend: 0, revenue: 0, profit: 0, purchases: 0,
    initiateCheckout: 0, addToCart: 0, clicks: 0, impressions: 0, pageViews: 0,
    roas: null, roi: null, cpa: null, cpi: null, cpc: null, ctr: null, cpm: null,
  }
}

// ── Storage keys ─────────────────────────────────────────────────────────────

const CURRENT_DATASET_KEY  = 'pitbrain:currentDataset'
const IMPORT_HISTORY_KEY   = 'pitbrain:importHistory'
export const WINNER_LIBRARY_KEY = 'pitbrain:winnerLibrary'
const LEGACY_KEY           = 'pitbrain:lastImport'

// ── File hash ────────────────────────────────────────────────────────────────

export async function generateFileHash(file: File): Promise<string> {
  const head = await file.slice(0, 4096).text()
  const str = `${file.name}|${file.size}|${head}`
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // keep 32-bit
  }
  return Math.abs(hash).toString(36)
}

// ── Current dataset I/O ──────────────────────────────────────────────────────

export function saveCurrentDataset(data: LastImport): void {
  try {
    localStorage.setItem(CURRENT_DATASET_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('[pitbrain] Failed to save currentDataset:', err)
  }
}

export function loadCurrentDataset(): LastImport | null {
  try {
    const raw = localStorage.getItem(CURRENT_DATASET_KEY)
    if (raw) return JSON.parse(raw) as LastImport
    // Migrate from old key
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      localStorage.setItem(CURRENT_DATASET_KEY, legacy)
      localStorage.removeItem(LEGACY_KEY)
      return JSON.parse(legacy) as LastImport
    }
    return null
  } catch (err) {
    console.error('[pitbrain] Failed to load currentDataset:', err)
    return null
  }
}

export function clearCurrentDataset(): void {
  try {
    localStorage.removeItem(CURRENT_DATASET_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {}
}

// ── Import history (metadata only — no rows) ─────────────────────────────────

export function loadImportHistory(): ImportSession[] {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY)
    return raw ? (JSON.parse(raw) as ImportSession[]) : []
  } catch {
    return []
  }
}

export function addToImportHistory(session: ImportSession): void {
  try {
    const history = loadImportHistory()
    // Replace same id, then limit to 20 entries
    const updated = [session, ...history.filter(h => h.id !== session.id)].slice(0, 20)
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('[pitbrain] Failed to save import history:', err)
  }
}

export function clearImportHistory(): void {
  try {
    localStorage.removeItem(IMPORT_HISTORY_KEY)
  } catch {}
}

// ── Dataset merge ────────────────────────────────────────────────────────────

function getOrderKey(row: UtmifySession): string {
  return `${row.orderDate ?? ''}|${row.grossRevenue ?? ''}|${row.status ?? ''}|${row.utmCampaign ?? ''}`
}

export function mergeDatasets(current: LastImport, next: LastImport): LastImport {
  if (current.sourceType !== next.sourceType) return next

  if (next.sourceType === 'utmify_utm_breakdown') {
    const currentRows = current.rows as UtmifyBreakdownRow[]
    const nextRows = next.rows as UtmifyBreakdownRow[]
    const byDimension = new Map<string, UtmifyBreakdownRow>()
    for (const r of currentRows) byDimension.set(r.dimensionName, r)
    for (const r of nextRows) byDimension.set(r.dimensionName, r) // newer wins
    const merged = Array.from(byDimension.values())
    return { ...next, rows: merged }
  }

  if (next.sourceType === 'utmify_daily_aggregate') {
    const currentRows = current.rows as UtmifyDailyRow[]
    const nextRows = next.rows as UtmifyDailyRow[]
    const byDate = new Map<string, UtmifyDailyRow>()
    for (const r of currentRows) if (r.date) byDate.set(r.date, r)
    for (const r of nextRows) if (r.date) byDate.set(r.date, r) // newer wins
    const merged = Array.from(byDate.values()).sort((a, b) =>
      (a.date ?? '').localeCompare(b.date ?? ''))
    return {
      ...next,
      rows: merged,
      summary: buildImportSummary({ sourceType: next.sourceType, rows: merged } as UtmifyParseResult),
    }
  }

  if (next.sourceType === 'utmify_orders') {
    const currentRows = current.rows as UtmifySession[]
    const nextRows = next.rows as UtmifySession[]
    const byKey = new Map<string, UtmifySession>()
    for (const r of currentRows) byKey.set(getOrderKey(r), r)
    for (const r of nextRows) byKey.set(getOrderKey(r), r) // newer wins
    const merged = Array.from(byKey.values())
    return {
      ...next,
      rows: merged,
      summary: buildImportSummary({ sourceType: next.sourceType, rows: merged } as UtmifyParseResult),
    }
  }

  return next
}

// ── Backward-compat aliases ───────────────────────────────────────────────────

/** @deprecated Use saveCurrentDataset */
export function saveLastImport(data: LastImport): void { saveCurrentDataset(data) }
/** @deprecated Use loadCurrentDataset */
export function loadLastImport(): LastImport | null { return loadCurrentDataset() }

// ── Summary calculation ──────────────────────────────────────────────────────

export function buildImportSummary(parseResult: UtmifyParseResult): ImportSummary {
  if (parseResult.sourceType === 'utmify_utm_breakdown') {
    const rows = parseResult.rows
    const spend = rows.reduce((s, r) => s + safeNumber(r.spend), 0)
    const revenue = rows.reduce((s, r) => s + safeNumber(r.revenue), 0)
    const profit = rows.reduce((s, r) => s + safeNumber(r.profit), 0)
    const purchases = rows.reduce((s, r) => s + safeNumber(r.purchases), 0)
    const ic = rows.reduce((s, r) => s + safeNumber(r.ic), 0)
    const atc = rows.reduce((s, r) => s + safeNumber(r.addToCart), 0)
    const clicks = rows.reduce((s, r) => s + safeNumber(r.clicks), 0)
    const impressions = rows.reduce((s, r) => s + safeNumber(r.impressions), 0)
    const pageViews = rows.reduce((s, r) => s + safeNumber(r.pageViews), 0)

    return {
      startDate: null,
      endDate: null,
      days: 0,
      spend,
      revenue,
      profit,
      purchases,
      initiateCheckout: ic,
      addToCart: atc,
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
      ignoredFooterRowsCount: parseResult.ignoredFooterRowsCount,
    }
  }

  if (parseResult.sourceType === 'utmify_daily_aggregate') {
    const rows = parseResult.rows as UtmifyDailyRow[]
    const spend = rows.reduce((s, r) => s + safeNumber(r.spend), 0)
    const revenue = rows.reduce((s, r) => s + safeNumber(r.revenue), 0)
    const profit = rows.reduce((s, r) => s + safeNumber(r.profit), 0)
    const purchases = rows.reduce((s, r) => s + safeNumber(r.purchases), 0)
    const ic = rows.reduce((s, r) => s + safeNumber(r.initiateCheckout), 0)
    const atc = rows.reduce((s, r) => s + safeNumber(r.addToCart), 0)
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
      addToCart: atc,
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

function emptyFunnel(): FunnelMetrics {
  return {
    spend: 0, revenue: 0, roas: 0, cpa: 0, ctr: 0, cpc: 0, cpm: 0,
    impressions: 0, clicks: 0, reach: 0, pageViews: 0,
    initiateCheckouts: 0, purchases: 0,
    clickToPurchaseRate: 0, pageViewToCheckoutRate: 0, checkoutToPurchaseRate: 0,
  }
}

function buildFunnelFromBreakdown(rows: UtmifyBreakdownRow[]): FunnelMetrics {
  const spend = rows.reduce((s, r) => s + safeNumber(r.spend), 0)
  const revenue = rows.reduce((s, r) => s + safeNumber(r.revenue), 0)
  const purchases = rows.reduce((s, r) => s + safeNumber(r.purchases), 0)
  const clicks = rows.reduce((s, r) => s + safeNumber(r.clicks), 0)
  const impressions = rows.reduce((s, r) => s + safeNumber(r.impressions), 0)
  const pageViews = rows.reduce((s, r) => s + safeNumber(r.pageViews), 0)
  const ic = rows.reduce((s, r) => s + safeNumber(r.ic), 0)

  // Always recalculate ratios from aggregated totals — never sum per-row ratios
  const ctr = safeDivide(clicks, impressions)
  const cpm = impressions > 0 ? safeDivide(spend, impressions) * 1000 : 0
  const cpc = safeDivide(spend, clicks)

  return {
    spend,
    revenue,
    roas: safeDivide(revenue, spend),
    cpa: purchases > 0 ? safeDivide(spend, purchases) : 0,
    ctr,
    cpc,
    cpm,
    impressions,
    clicks,
    reach: 0,
    pageViews,
    initiateCheckouts: ic,
    purchases,
    clickToPurchaseRate: safeDivide(purchases, clicks),
    pageViewToCheckoutRate: safeDivide(ic, pageViews),
    checkoutToPurchaseRate: safeDivide(purchases, ic),
  }
}

export function buildSummaryMetrics(lastImport: LastImport): SummaryMetrics {
  const sessionId = 'local:' + lastImport.importedAt

  // Structure files have no performance data — return empty metrics
  if (lastImport.sourceType === 'meta_ads_structure') {
    return { overall: emptyFunnel(), byCampaign: [], dateRange: { from: '', to: '' }, sessionId }
  }

  if (lastImport.sourceType === 'utmify_utm_breakdown') {
    const rows = lastImport.rows as UtmifyBreakdownRow[]
    const overall = buildFunnelFromBreakdown(rows)
    return { overall, byCampaign: [], dateRange: { from: '', to: '' }, sessionId }
  }

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

  if (lastImport.sourceType === 'utmify_mcp') {
    // Normalized at ingestion time (lib/utmify-mcp/utmify-mcp-normalizers.ts) into rows shaped
    // exactly like UtmifyBreakdownRow (campaign/adset/ad breakdown pulls) or UtmifyDailyRow
    // (summary-only pulls, as one synthetic row) — reuses the same reducers as their file-upload
    // counterparts unchanged, just routed here based on whether a breakdown was requested.
    if (lastImport.breakdownLevel) {
      const rows = lastImport.rows as UtmifyBreakdownRow[]
      const overall = buildFunnelFromBreakdown(rows)
      return { overall, byCampaign: [], dateRange: { from: '', to: '' }, sessionId }
    }
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
