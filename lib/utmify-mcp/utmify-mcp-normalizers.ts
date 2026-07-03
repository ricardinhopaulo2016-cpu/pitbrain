// Do NOT reimplement BR number parsing or the Page Views/IC alias rules here — they're shared,
// load-bearing logic that other parts of the app depend on staying in sync. This file reuses the
// existing implementations (lib/utils.ts) and replicates the exact IC/Add-To-Cart fallback pairing
// from lib/parsers/utmify-parser.ts (`ic: icRaw ?? addToCartRaw`, `addToCart: addToCartRaw ?? icRaw`)
// so MCP-sourced data goes through the same rules as CSV/XLSX-sourced data.
//
// The real shape of UTMify MCP's `get_dashboards`/`get_dashboard_summary`/`get_*_ad_objects`
// responses hasn't been confirmed against a live server yet — these normalizers try a handful of
// plausible field names (camelCase, snake_case, common UTMify/PT-BR vocabulary) and never invent a
// number: anything not found becomes `null`/`0` (never guessed), and every function reports whether
// it actually recognized the payload shape so callers can fall back to showing raw JSON.

import { parseMonetaryValue, parseNumericValue, parseCountValue } from '@/lib/utils'
import type { UtmifyDailyRow, UtmifyBreakdownRow, BreakdownLevel } from '@/types/utmify'
import type { PitbrainImportSummary } from '@/types/pitbrain'
import type { McpToolCallResult } from './utmify-mcp-types'

export { parseMonetaryValue, parseNumericValue, parseCountValue }

// ── Generic MCP payload extraction ──────────────────────────────────────────

/** Pulls the actual JSON payload out of a tool-call result — either `structuredContent` (preferred,
 * already-parsed) or a JSON blob embedded in `content[0].text` (some MCP servers only return that). */
function extractPayload(result: McpToolCallResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent
  const textItem = result.content?.find(c => typeof c.text === 'string' && c.text.trim())
  if (textItem?.text) {
    try {
      return JSON.parse(textItem.text)
    } catch {
      return null
    }
  }
  return null
}

/** A payload might already be an array, or an array nested under one of a few plausible wrapper
 * keys — tries the payload itself first, then each wrapper key in order. */
function asList(payload: unknown, wrapperKeys: string[]): unknown[] | null {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of wrapperKeys) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return null
}

function asObject(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function toNumberOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'number') return isNaN(raw) ? null : raw
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parseMonetaryValue(trimmed)
  return isNaN(parsed) ? null : parsed
}

function toCountOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'string' && !raw.trim()) return null
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  return parseCountValue(raw)
}

/** A monetary field's value in cents only counts as cents when the field name itself says so
 * (`{key}Cents` / `{key}_cents`) — never guessed from magnitude alone. */
function pickMonetary(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const camel = `${key}Cents`
    const snake = `${key}_cents`
    if (obj[camel] !== undefined && obj[camel] !== null) {
      const n = toNumberOrNull(obj[camel])
      return n === null ? null : n / 100
    }
    if (obj[snake] !== undefined && obj[snake] !== null) {
      const n = toNumberOrNull(obj[snake])
      return n === null ? null : n / 100
    }
  }
  return toNumberOrNull(pick(obj, keys))
}

// ── Field name candidates (best-effort — unconfirmed against a live MCP server) ────────────────

const SPEND_KEYS = ['spend', 'cost', 'adSpend', 'ad_spend', 'totalSpend', 'total_spend', 'investimento']
const REVENUE_KEYS = ['revenue', 'grossRevenue', 'gross_revenue', 'totalRevenue', 'total_revenue', 'faturamento']
const PURCHASES_KEYS = ['purchases', 'sales', 'orders', 'vendas', 'totalPurchases', 'total_purchases']
const CLICKS_KEYS = ['clicks', 'totalClicks', 'total_clicks', 'cliques']
const IMPRESSIONS_KEYS = ['impressions', 'totalImpressions', 'total_impressions', 'impressoes']
const PAGE_VIEWS_KEYS = ['pageViews', 'page_views', 'visPag', 'vis_de_pag', 'visitasPagina']
const IC_KEYS = ['ic', 'initiateCheckout', 'initiate_checkout', 'initiateCheckouts', 'initiate_checkouts']
const ATC_KEYS = ['addToCart', 'add_to_cart', 'atc']

/** Derived metrics — always computed from the raw totals (roas = revenue/spend, etc.), never taken
 * from a direct field on the MCP payload, so there's no ambiguity about percent-vs-fraction scaling
 * for fields UTMify itself might report differently. Mirrors the exact formulas the rest of the app
 * already uses (lib/calculators/local-metrics.ts's buildFunnelFromDaily/buildFunnelFromBreakdown). */
function deriveMetrics(spend: number, revenue: number, purchases: number, clicks: number | null, impressions: number | null, ic: number | null) {
  const profit = revenue - spend
  const roas = spend > 0 ? revenue / spend : null
  const roi = spend > 0 ? (profit / spend) * 100 : null
  const cpa = purchases > 0 ? spend / purchases : null
  const cpc = clicks && clicks > 0 ? spend / clicks : null
  const cpm = impressions && impressions > 0 ? (spend / impressions) * 1000 : null
  const ctr = clicks !== null && impressions && impressions > 0 ? (clicks / impressions) * 100 : null
  const cpi = ic && ic > 0 ? spend / ic : null
  return { profit, roas, roi, cpa, cpc, cpm, ctr, cpi }
}

// ── get_dashboards ───────────────────────────────────────────────────────────

export interface UtmifyDashboardOption {
  id: string
  name: string
}

export function normalizeUtmifyDashboards(result: McpToolCallResult): { dashboards: UtmifyDashboardOption[]; recognized: boolean } {
  const payload = extractPayload(result)
  const list = asList(payload, ['dashboards', 'data', 'items', 'results'])
  if (!list) return { dashboards: [], recognized: false }

  const dashboards: UtmifyDashboardOption[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id = pick(obj, ['id', 'dashboardId', 'dashboard_id', 'uuid'])
    if (id === undefined) continue
    const name = pick(obj, ['name', 'title', 'label', 'dashboardName', 'dashboard_name'])
    dashboards.push({ id: String(id), name: name !== undefined ? String(name) : String(id) })
  }
  return { dashboards, recognized: true }
}

// ── get_dashboard_summary ─────────────────────────────────────────────────────

export interface UtmifyPeriod {
  label: string
  start: string
  end: string
}

/** Produces both a `PitbrainImportSummary` (what gets stored/displayed) and a single row shaped
 * exactly like `UtmifyDailyRow` (what `buildFunnelFromDaily` in local-metrics.ts reduces over — used
 * as the calculation vehicle for a no-breakdown MCP pull, not meant to be rendered as a "daily"
 * table since it represents a whole period, not one day). */
export function normalizeUtmifyDashboardSummary(
  result: McpToolCallResult,
  period: UtmifyPeriod
): { summary: PitbrainImportSummary; row: UtmifyDailyRow; recognized: boolean } {
  const obj = asObject(extractPayload(result))

  const spend = obj ? (pickMonetary(obj, SPEND_KEYS) ?? 0) : 0
  const revenue = obj ? (pickMonetary(obj, REVENUE_KEYS) ?? 0) : 0
  const purchases = obj ? (toCountOrNull(pick(obj, PURCHASES_KEYS)) ?? 0) : 0
  const clicks = obj ? toCountOrNull(pick(obj, CLICKS_KEYS)) : null
  const impressions = obj ? toCountOrNull(pick(obj, IMPRESSIONS_KEYS)) : null
  const pageViews = obj ? toCountOrNull(pick(obj, PAGE_VIEWS_KEYS)) : null
  const icRaw = obj ? toCountOrNull(pick(obj, IC_KEYS)) : null
  const atcRaw = obj ? toCountOrNull(pick(obj, ATC_KEYS)) : null
  const ic = icRaw ?? atcRaw
  const addToCart = atcRaw ?? icRaw

  const { profit, roas, roi, cpa, cpc, cpm, ctr, cpi } = deriveMetrics(spend, revenue, purchases, clicks, impressions, ic)

  const row: UtmifyDailyRow = {
    date: period.start || period.label,
    purchases,
    spend,
    revenue,
    profit,
    roas,
    cpa,
    cpc,
    ctr,
    cpm,
    roi,
    margin: null,
    initiateCheckout: ic,
    addToCart,
    cpi,
    clicks,
    impressions,
    pageViews,
    sourceType: 'utmify_daily_aggregate',
  }

  const summary: PitbrainImportSummary = {
    spend,
    revenue,
    profit,
    roas,
    roi,
    sales: purchases,
    cpa,
    cpc,
    ctr,
    cpm,
    clicks: clicks ?? 0,
    impressions: impressions ?? 0,
    pageViews: pageViews ?? 0,
    ic: ic ?? 0,
  }

  return { summary, row, recognized: obj !== null }
}

// ── get_{platform}_ad_objects ─────────────────────────────────────────────────

export type UtmifyMcpPlatform = 'meta' | 'google' | 'kwai' | 'tiktok'
export type UtmifyMcpLevel = 'all' | 'account' | 'campaign' | 'adset' | 'ad'

/** Maps a UI-selected level to the UTM dimension the resulting rows represent (matches how UTMify's
 * own CSV UTM-breakdown export ties a level to a dimension field) and to the closest
 * `BreakdownLevel` row-shape literal — 'account'/'all' have no dedicated member, so they fall back to
 * 'campaign' purely for the row's structural typing (never surfaced to the user; the real level is
 * carried separately by the caller for `PitbrainImport.breakdownLevel`/`dimensionField`). */
export function dimensionFieldForLevel(level: UtmifyMcpLevel): string {
  switch (level) {
    case 'campaign': return 'utm_campaign'
    case 'adset': return 'utm_medium'
    case 'ad': return 'utm_content'
    default: return 'account'
  }
}

function breakdownLevelForLevel(level: UtmifyMcpLevel): BreakdownLevel {
  switch (level) {
    case 'campaign': return 'campaign'
    case 'adset': return 'adset'
    case 'ad': return 'ad'
    default: return 'campaign'
  }
}

export function normalizeUtmifyAdObjects(
  result: McpToolCallResult,
  opts: { platform: UtmifyMcpPlatform; level: UtmifyMcpLevel }
): { rows: UtmifyBreakdownRow[]; recognized: boolean } {
  const payload = extractPayload(result)
  const list = asList(payload, ['objects', 'ads', 'adsets', 'campaigns', 'accounts', 'data', 'items', 'results'])
  if (!list) return { rows: [], recognized: false }

  const dimensionField = dimensionFieldForLevel(opts.level)
  const breakdownLevel = breakdownLevelForLevel(opts.level)

  const rows: UtmifyBreakdownRow[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const id = pick(obj, ['id', 'campaignId', 'campaign_id', 'adsetId', 'adset_id', 'adId', 'ad_id', 'accountId', 'account_id'])
    const name = pick(obj, ['name', 'campaignName', 'campaign_name', 'adsetName', 'adset_name', 'adName', 'ad_name', 'title', 'label'])
    if (id === undefined && name === undefined) continue

    const spend = pickMonetary(obj, SPEND_KEYS) ?? 0
    const revenue = pickMonetary(obj, REVENUE_KEYS) ?? 0
    const purchases = toCountOrNull(pick(obj, PURCHASES_KEYS)) ?? 0
    const clicks = toCountOrNull(pick(obj, CLICKS_KEYS))
    const impressions = toCountOrNull(pick(obj, IMPRESSIONS_KEYS))
    const pageViews = toCountOrNull(pick(obj, PAGE_VIEWS_KEYS))
    const icRaw = toCountOrNull(pick(obj, IC_KEYS))
    const atcRaw = toCountOrNull(pick(obj, ATC_KEYS))
    const ic = icRaw ?? atcRaw
    const addToCart = atcRaw ?? icRaw

    const { profit, roas, roi, cpa, cpc, cpm, ctr, cpi } = deriveMetrics(spend, revenue, purchases, clicks, impressions, ic)

    rows.push({
      dimensionField,
      dimensionName: name !== undefined ? String(name) : String(id),
      rawDimension: id !== undefined ? String(id) : String(name),
      breakdownLevel,
      spend,
      revenue,
      profit,
      roas,
      purchases,
      margin: null,
      roi,
      addToCart,
      ic,
      cpa,
      cpi,
      cpc,
      ctr,
      cpm,
      hook: null,
      clicks,
      impressions,
      pageViews,
      sourceType: 'utmify_utm_breakdown',
    })
  }

  return { rows, recognized: true }
}
