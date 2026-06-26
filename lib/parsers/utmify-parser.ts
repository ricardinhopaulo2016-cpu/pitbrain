import Papa from 'papaparse'
import { UtmifySession, UtmifyParseResult } from '@/types/utmify'
import { detectColumnMapping, EXPECTED_COLUMNS } from './normalizer'
import { parseMonetaryValue, parseNumericValue } from '@/lib/utils'

export function parseUtmifyCsv(csvText: string): UtmifyParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (result.data.length === 0) {
    return { rows: [], missingColumns: EXPECTED_COLUMNS, unmappedHeaders: [] }
  }

  const headers = Object.keys(result.data[0])
  const { mapping, missingColumns, unmappedHeaders } = detectColumnMapping(headers)

  function get(row: Record<string, string>, canonical: string): string {
    const header = mapping[canonical]
    return header ? (row[header] ?? '') : ''
  }

  const rows: UtmifySession[] = result.data
    .map((rawRow): UtmifySession | null => {
      const status = get(rawRow, 'status')
      const grossRevenue = parseMonetaryValue(get(rawRow, 'gross_revenue'))

      // Skip rows that are clearly empty or summary/total rows
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
      }
    })
    .filter((row): row is UtmifySession => row !== null)

  return { rows, missingColumns, unmappedHeaders }
}
