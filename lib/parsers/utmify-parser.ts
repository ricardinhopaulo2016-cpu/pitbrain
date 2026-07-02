import Papa from 'papaparse'
import {
  UtmifySession,
  UtmifyDailyRow,
  UtmifyBreakdownRow,
  UtmifyParseResult,
  BreakdownLevel,
} from '@/types/utmify'
import {
  detectColumnMapping,
  detectDailyAggregateMapping,
  detectBreakdownMapping,
  detectIsDailyAggregate,
  detectIsUtmBreakdown,
  cleanHeader,
  EXPECTED_COLUMNS,
  DAILY_EXPECTED_COLUMNS,
} from './normalizer'
import { parseMonetaryValue, parseNumericValue, parseCountValue } from '@/lib/utils'

// ── Footer row detection ──────────────────────────────────────────────────────
// Filters rows like "28 Resultados", "Total", "Totais" from UTMify exports.
// These are summary/totalizer rows — including them doubles all aggregated values.

export function isUtmifyFooterRow(value: string): boolean {
  const normalized = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

  return (
    normalized.includes('resultado') ||
    normalized === 'total' ||
    normalized === 'totais' ||
    normalized === 'subtotal' ||
    /^\d+\s+resultado/.test(normalized)
  )
}

// ── UTM Breakdown ─────────────────────────────────────────────────────────────

function detectBreakdownInfo(
  firstHeader: string
): { level: BreakdownLevel; field: string; label: string } {
  const norm = firstHeader.toLowerCase().replace(/[\s_-]+/g, '_')

  if (norm.includes('campaign')) return { level: 'campaign', field: 'utm_campaign', label: 'Campanha' }
  if (norm.includes('medium'))   return { level: 'adset',    field: 'utm_medium',   label: 'Conjunto' }
  if (norm.includes('content'))  return { level: 'ad',       field: 'utm_content',  label: 'Anúncio/Criativo' }
  if (norm.includes('term'))     return { level: 'placement',field: 'utm_term',     label: 'Posicionamento' }
  if (norm.includes('source'))   return { level: 'campaign', field: 'utm_source',   label: 'Fonte' }

  return { level: 'campaign', field: firstHeader, label: firstHeader }
}

function parseUtmBreakdown(
  data: Record<string, string>[],
  headers: string[]
): UtmifyParseResult {
  const firstHeader = headers[0]
  const { level, field, label } = detectBreakdownInfo(firstHeader)
  const { mapping, missingColumns, unmappedHeaders } = detectBreakdownMapping(headers)

  function get(row: Record<string, string>, canonical: string): string {
    const header = mapping[canonical]
    return header ? (row[header] ?? '') : ''
  }

  function monOrNull(raw: string): number | null {
    if (!raw.trim()) return null
    const v = parseMonetaryValue(raw)
    return isNaN(v) ? null : v
  }

  function numOrNull(raw: string): number | null {
    if (!raw.trim() || raw.trim().toUpperCase() === 'N/A') return null
    const v = parseNumericValue(raw)
    return isNaN(v) ? null : v
  }

  function countOrNull(raw: string): number | null {
    if (!raw.trim()) return null
    const v = parseCountValue(raw)
    return isNaN(v) ? null : v
  }

  let ignoredFooterRowsCount = 0
  const rows: UtmifyBreakdownRow[] = []

  for (const rawRow of data) {
    const dimensionValue = rawRow[firstHeader] ?? ''

    if (isUtmifyFooterRow(dimensionValue)) {
      ignoredFooterRowsCount++
      continue
    }

    if (!dimensionValue.trim()) continue

    const icRaw = countOrNull(get(rawRow, 'ic'))
    const addToCartRaw = countOrNull(get(rawRow, 'add_to_cart'))

    rows.push({
      dimensionField: field,
      dimensionName: dimensionValue.trim(),
      rawDimension: dimensionValue,
      breakdownLevel: level,
      spend: monOrNull(get(rawRow, 'spend')) ?? 0,
      revenue: monOrNull(get(rawRow, 'revenue')) ?? 0,
      profit: monOrNull(get(rawRow, 'profit')),
      roas: numOrNull(get(rawRow, 'roas')),
      purchases: parseCountValue(get(rawRow, 'purchases')),
      margin: numOrNull(get(rawRow, 'margin')),
      roi: numOrNull(get(rawRow, 'roi')),
      ic: icRaw ?? addToCartRaw,
      addToCart: addToCartRaw ?? icRaw,
      cpa: monOrNull(get(rawRow, 'cpa')),
      cpi: monOrNull(get(rawRow, 'cpi')),
      cpc: monOrNull(get(rawRow, 'cpc')),
      ctr: numOrNull(get(rawRow, 'ctr')),
      cpm: monOrNull(get(rawRow, 'cpm')),
      hook: numOrNull(get(rawRow, 'hook')),
      clicks: countOrNull(get(rawRow, 'clicks')),
      impressions: countOrNull(get(rawRow, 'impressions')),
      pageViews: countOrNull(get(rawRow, 'page_views')),
      sourceType: 'utmify_utm_breakdown',
    })
  }

  return {
    sourceType: 'utmify_utm_breakdown',
    rows,
    breakdownLevel: level,
    dimensionField: field,
    dimensionLabel: label,
    missingColumns,
    unmappedHeaders,
    ignoredFooterRowsCount,
  }
}

// ── Orders parser ─────────────────────────────────────────────────────────────

function parseOrders(
  data: Record<string, string>[],
  headers: string[]
): UtmifyParseResult {
  const { mapping, missingColumns, unmappedHeaders } = detectColumnMapping(headers)

  function get(row: Record<string, string>, canonical: string): string {
    const header = mapping[canonical]
    return header ? (row[header] ?? '') : ''
  }

  const rows: UtmifySession[] = data
    .map((rawRow): UtmifySession | null => {
      const status = get(rawRow, 'status')
      const grossRevenue = parseMonetaryValue(get(rawRow, 'gross_revenue'))
      if (!status && grossRevenue === 0) return null

      return {
        orderId: get(rawRow, 'order_id'),
        orderDate: get(rawRow, 'order_date') || null,
        productName: get(rawRow, 'product_name') || null,
        status,
        paymentMethod: get(rawRow, 'payment_method') || null,
        grossRevenue,
        netRevenue: parseMonetaryValue(get(rawRow, 'net_revenue')),
        utmSource: get(rawRow, 'utm_source') || null,
        utmMedium: get(rawRow, 'utm_medium') || null,
        utmCampaign: get(rawRow, 'utm_campaign') || null,
        utmTerm: get(rawRow, 'utm_term') || null,
        utmContent: get(rawRow, 'utm_content') || null,
        campaignId: get(rawRow, 'campaign_id') || null,
        adsetId: get(rawRow, 'adset_id') || null,
        adId: get(rawRow, 'ad_id') || null,
        pageViews: parseCountValue(get(rawRow, 'page_views')),
        initiateCheckouts: parseCountValue(get(rawRow, 'initiate_checkouts')),
        sourceType: 'utmify_orders',
      }
    })
    .filter((r): r is UtmifySession => r !== null)

  return { sourceType: 'utmify_orders', rows, missingColumns, unmappedHeaders }
}

// ── Daily aggregate parser ────────────────────────────────────────────────────

function parseDailyAggregate(
  data: Record<string, string>[],
  headers: string[]
): UtmifyParseResult {
  const { mapping, missingColumns, unmappedHeaders } = detectDailyAggregateMapping(headers)

  function get(row: Record<string, string>, canonical: string): string {
    const header = mapping[canonical]
    return header ? (row[header] ?? '') : ''
  }

  function numOrNull(raw: string): number | null {
    if (!raw.trim()) return null
    const v = parseNumericValue(raw)
    return isNaN(v) ? null : v
  }

  function monOrNull(raw: string): number | null {
    if (!raw.trim()) return null
    return parseMonetaryValue(raw)
  }

  function countOrNull(raw: string): number | null {
    if (!raw.trim()) return null
    const v = parseCountValue(raw)
    return isNaN(v) ? null : v
  }

  const rows: UtmifyDailyRow[] = data
    .map((rawRow): UtmifyDailyRow | null => {
      const dateVal = get(rawRow, 'date')
      // Filter footer rows ("Total", "Totais") that appear in the date column
      if (dateVal && isUtmifyFooterRow(dateVal)) return null

      const spendVal = monOrNull(get(rawRow, 'spend'))
      const revenueVal = monOrNull(get(rawRow, 'revenue'))
      const purchasesRaw = get(rawRow, 'purchases')
      const purchases = parseCountValue(purchasesRaw)

      if (spendVal === null && revenueVal === null && !purchasesRaw.trim()) return null

      const icRaw = countOrNull(get(rawRow, 'ic'))
      const addToCartRaw = countOrNull(get(rawRow, 'add_to_cart'))

      return {
        date: dateVal || null,
        purchases,
        spend: spendVal ?? 0,
        revenue: revenueVal ?? 0,
        profit: monOrNull(get(rawRow, 'profit')),
        roas: numOrNull(get(rawRow, 'roas')),
        cpa: monOrNull(get(rawRow, 'cpa')),
        cpc: monOrNull(get(rawRow, 'cpc')),
        ctr: numOrNull(get(rawRow, 'ctr')),
        cpm: monOrNull(get(rawRow, 'cpm')),
        roi: numOrNull(get(rawRow, 'roi')),
        margin: numOrNull(get(rawRow, 'margin')),
        initiateCheckout: icRaw ?? addToCartRaw,
        addToCart: addToCartRaw ?? icRaw,
        cpi: monOrNull(get(rawRow, 'cpi')),
        clicks: countOrNull(get(rawRow, 'clicks')),
        impressions: countOrNull(get(rawRow, 'impressions')),
        pageViews: countOrNull(get(rawRow, 'page_views')),
        sourceType: 'utmify_daily_aggregate',
      }
    })
    .filter((r): r is UtmifyDailyRow => r !== null)

  return { sourceType: 'utmify_daily_aggregate', rows, missingColumns, unmappedHeaders }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseUtmifyCsv(csvText: string): UtmifyParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: cleanHeader, // strips BOM + trims whitespace
  })

  if (result.data.length === 0) {
    return {
      sourceType: 'utmify_orders',
      rows: [],
      missingColumns: EXPECTED_COLUMNS,
      unmappedHeaders: [],
    }
  }

  const headers = Object.keys(result.data[0])

  // UTM breakdown check FIRST — breakdown files also match detectIsDailyAggregate
  // because they share the same aggregate columns (gastos, faturamento, etc.).
  if (detectIsUtmBreakdown(headers)) {
    return parseUtmBreakdown(result.data, headers)
  }

  if (detectIsDailyAggregate(headers)) {
    return parseDailyAggregate(result.data, headers)
  }

  return parseOrders(result.data, headers)
}

export async function parseUtmifyFile(file: File): Promise<UtmifyParseResult> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const csvText = XLSX.utils.sheet_to_csv(sheet)
    return parseUtmifyCsv(csvText)
  }

  const text = await file.text()
  return parseUtmifyCsv(text)
}

export { EXPECTED_COLUMNS, DAILY_EXPECTED_COLUMNS }
