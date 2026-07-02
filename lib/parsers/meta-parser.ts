import Papa from 'papaparse'
import { MetaCampaign, MetaRawRow } from '@/types/meta'
import { MetaRowSchema } from '@/lib/validators/meta-schema'
import { parseMonetaryValue, parseNumericValue } from '@/lib/utils'
import { detectIsMetaStructure, cleanHeader } from '@/lib/parsers/normalizer'

export interface MetaParseResult {
  rows: MetaCampaign[]
  sourceType: 'meta_ads_performance' | 'meta_ads_structure'
}

// Common column name aliases across Meta export versions
const COLUMN_MAP: Record<string, keyof MetaRawRow> = {
  // Campaign
  'nome da campanha': 'campaign_name',
  'campaign name': 'campaign_name',
  'nome da camp': 'campaign_name',
  'id da campanha': 'campaign_id',
  'campaign id': 'campaign_id',
  // Ad Set
  'conjunto de anúncios': 'adset_name',
  'conjunto de anuncios': 'adset_name',
  'ad set name': 'adset_name',
  'nome do conjunto de anuncios': 'adset_name',
  'id do conjunto de anuncios': 'adset_id',
  'ad set id': 'adset_id',
  // Ad
  'anúncio': 'ad_name',
  'anuncio': 'ad_name',
  'ad name': 'ad_name',
  'id do anuncio': 'ad_id',
  'ad id': 'ad_id',
  // Performance
  'valor usado (brl)': 'spend',
  'amount spent (brl)': 'spend',
  'valor gasto': 'spend',
  'spend': 'spend',
  'impressões': 'impressions',
  'impressoes': 'impressions',
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
  // Dates
  'início dos relatórios': 'date_start',
  'inicio dos relatorios': 'date_start',
  'reporting starts': 'date_start',
  'término dos relatórios': 'date_stop',
  'termino dos relatorios': 'date_stop',
  'reporting ends': 'date_stop',
  // Actions
  'compras no site': 'purchase_roas',
  'website purchases': 'purchase_roas',
  'purchases': 'purchase_roas',
  'iniciações de checkout no site': 'actions',
  'iniciacoes de checkout no site': 'actions',
}

/**
 * Normalize a CSV header key:
 * - strip BOM (the most common cause of "Campaign Name" → "Sem nome")
 * - lowercase + trim + collapse whitespace
 * - remove accent combining marks
 */
function normalizeKey(key: string): string {
  return key
    .replace(/^﻿/, '') // strip BOM
    .replace(/\t/g, ' ')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\s+/g, ' ')
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
    // cleanHeader strips BOM and trims; without this the first column name
    // has an invisible ﻿ prefix that breaks all COLUMN_MAP lookups.
    transformHeader: cleanHeader,
  })

  if (process.env.NODE_ENV === 'development') {
    console.log('[pitbrain:meta-parser] headers', result.meta?.fields)
    console.log('[pitbrain:meta-parser] rowCount', result.data.length)
  }

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
        campaignName: r.campaign_name || '',
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

/**
 * Parse a Meta Ads CSV and detect whether it is a structure or performance export.
 * Use this in the upload API instead of `parseMetaCsv` so the route can return
 * `metaSourceType` and redirect accordingly.
 */
export function parseMetaFileText(csvText: string): MetaParseResult {
  // Parse one row to get headers for type detection
  const headerScan = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    preview: 1,
    skipEmptyLines: true,
    transformHeader: cleanHeader,
  })
  const headers = headerScan.meta?.fields ?? Object.keys(headerScan.data[0] ?? {})
  const isStructure = detectIsMetaStructure(headers)

  if (process.env.NODE_ENV === 'development') {
    console.log('[pitbrain:meta-parser] file type detection', {
      headers,
      isStructure,
      sourceType: isStructure ? 'meta_ads_structure' : 'meta_ads_performance',
    })
  }

  const rows = parseMetaCsv(csvText)
  return {
    rows,
    sourceType: isStructure ? 'meta_ads_structure' : 'meta_ads_performance',
  }
}
