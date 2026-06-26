import Papa from 'papaparse'
import { UtmifySession, UtmifyDailyRow, UtmifyParseResult } from '@/types/utmify'
import {
  detectColumnMapping,
  detectDailyAggregateMapping,
  detectIsDailyAggregate,
  EXPECTED_COLUMNS,
  DAILY_EXPECTED_COLUMNS,
} from './normalizer'
import { parseMonetaryValue, parseNumericValue } from '@/lib/utils'

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
        pageViews: parseNumericValue(get(rawRow, 'page_views')),
        initiateCheckouts: parseNumericValue(get(rawRow, 'initiate_checkouts')),
        sourceType: 'utmify_orders',
      }
    })
    .filter((r): r is UtmifySession => r !== null)

  return { sourceType: 'utmify_orders', rows, missingColumns, unmappedHeaders }
}

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

  const rows: UtmifyDailyRow[] = data
    .map((rawRow): UtmifyDailyRow | null => {
      const spendVal = monOrNull(get(rawRow, 'spend'))
      const revenueVal = monOrNull(get(rawRow, 'revenue'))
      const purchasesRaw = get(rawRow, 'purchases')
      const purchases = parseNumericValue(purchasesRaw)

      if (spendVal === null && revenueVal === null && !purchasesRaw.trim()) return null

      return {
        date: get(rawRow, 'date') || null,
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
        initiateCheckout: numOrNull(get(rawRow, 'ic')),
        cpi: monOrNull(get(rawRow, 'cpi')),
        clicks: numOrNull(get(rawRow, 'clicks')),
        impressions: numOrNull(get(rawRow, 'impressions')),
        pageViews: numOrNull(get(rawRow, 'page_views')),
        sourceType: 'utmify_daily_aggregate',
      }
    })
    .filter((r): r is UtmifyDailyRow => r !== null)

  return { sourceType: 'utmify_daily_aggregate', rows, missingColumns, unmappedHeaders }
}

export function parseUtmifyCsv(csvText: string): UtmifyParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
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
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const csvText = XLSX.utils.sheet_to_csv(sheet)
    return parseUtmifyCsv(csvText)
  }

  const text = await file.text()
  return parseUtmifyCsv(text)
}

export { EXPECTED_COLUMNS, DAILY_EXPECTED_COLUMNS }
