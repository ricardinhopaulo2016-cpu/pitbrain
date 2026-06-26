import Papa from 'papaparse'
import { MetaCampaign, MetaRawRow } from '@/types/meta'
import { MetaRowSchema } from '@/lib/validators/meta-schema'
import { parseMonetaryValue, parseNumericValue } from '@/lib/utils'

// Common column name aliases across Meta export versions
const COLUMN_MAP: Record<string, keyof MetaRawRow> = {
  'nome da campanha': 'campaign_name',
  'campaign name': 'campaign_name',
  'id da campanha': 'campaign_id',
  'campaign id': 'campaign_id',
  'conjunto de anúncios': 'adset_name',
  'ad set name': 'adset_name',
  'anúncio': 'ad_name',
  'ad name': 'ad_name',
  'valor usado (brl)': 'spend',
  'amount spent (brl)': 'spend',
  'valor gasto': 'spend',
  'spend': 'spend',
  'impressões': 'impressions',
  'impressions': 'impressions',
  'cliques (todos)': 'clicks',
  'clicks (all)': 'clicks',
  'cliques no link': 'clicks',
  'link clicks': 'clicks',
  'alcance': 'reach',
  'reach': 'reach',
  'cpm (custo por 1.000 impressões)': 'cpm',
  'cpm (cost per 1,000 impressions)': 'cpm',
  'cpm': 'cpm',
  'cpc (custo por clique no link)': 'cpc',
  'cpc (cost per link click)': 'cpc',
  'cpc (all)': 'cpc',
  'cpc': 'cpc',
  'ctr (taxa de clique no link)': 'ctr',
  'ctr (link click-through rate)': 'ctr',
  'ctr (all)': 'ctr',
  'ctr': 'ctr',
  'início dos relatórios': 'date_start',
  'reporting starts': 'date_start',
  'término dos relatórios': 'date_stop',
  'reporting ends': 'date_stop',
  'compras no site': 'purchase_roas',
  'website purchases': 'purchase_roas',
  'purchases': 'purchase_roas',
  'iniciações de checkout no site': 'actions',
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim()
}

function remapRow(raw: Record<string, string>): MetaRawRow {
  const remapped: MetaRawRow = {}
  for (const [k, v] of Object.entries(raw)) {
    const normalized = normalizeKey(k)
    const mapped = COLUMN_MAP[normalized]
    if (mapped) {
      remapped[mapped] = v
    } else {
      remapped[k] = v
    }
  }
  return remapped
}

function extractActionValue(row: MetaRawRow, actionType: string): number {
  // Meta exports action columns like "purchases" or "website_purchases"
  const keys = Object.keys(row).map(k => k.toLowerCase())
  for (const key of keys) {
    if (key.includes(actionType)) {
      return parseNumericValue(row[key] as string)
    }
  }
  return 0
}

export function parseMetaCsv(csvText: string): MetaCampaign[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  return result.data
    .map((rawRow): MetaCampaign | null => {
      const remapped = remapRow(rawRow)
      const parsed = MetaRowSchema.safeParse(remapped)
      if (!parsed.success) return null
      const r = parsed.data as MetaRawRow

      const purchases = extractActionValue(remapped, 'purchase')
      const initiateCheckouts = extractActionValue(remapped, 'checkout') || extractActionValue(remapped, 'initiat')
      const landingPageViews = extractActionValue(remapped, 'landing_page') || extractActionValue(remapped, 'page_view')
      const purchaseValue = extractActionValue(remapped, 'purchase_value') || extractActionValue(remapped, 'value')

      return {
        campaignId: r.campaign_id || '',
        campaignName: r.campaign_name || 'Sem nome',
        adsetName: r.adset_name || '',
        adsetId: r.adset_id || '',
        adName: r.ad_name || '',
        adId: r.ad_id || '',
        dateStart: r.date_start || '',
        dateStop: r.date_stop || '',
        spend: parseMonetaryValue(r.spend),
        impressions: parseNumericValue(r.impressions),
        clicks: parseNumericValue(r.clicks),
        reach: parseNumericValue(r.reach),
        cpm: parseNumericValue(r.cpm),
        cpc: parseNumericValue(r.cpc),
        ctr: parseNumericValue(r.ctr),
        purchases,
        purchaseValue,
        initiateCheckouts,
        addToCarts: extractActionValue(remapped, 'add_to_cart') || extractActionValue(remapped, 'carrinho'),
        landingPageViews,
      }
    })
    .filter((row): row is MetaCampaign => row !== null)
}
