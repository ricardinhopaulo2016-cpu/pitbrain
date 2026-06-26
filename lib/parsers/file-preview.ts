'use client'

import Papa from 'papaparse'
import {
  detectColumnMapping,
  detectDailyAggregateMapping,
  detectIsDailyAggregate,
  COLUMN_LABELS,
  DAILY_COLUMN_LABELS,
  EXPECTED_COLUMNS,
  DAILY_EXPECTED_COLUMNS,
} from './normalizer'

export type DetectedFileType = 'meta_ads' | 'utmify_orders' | 'utmify_daily' | 'unknown'

export interface RecognizedColumn {
  original: string
  canonical: string
  label: string
}

export interface MissingColumn {
  canonical: string
  label: string
  required: boolean
}

export interface FilePreviewData {
  fileName: string
  detectedType: DetectedFileType
  rowCount: number
  allColumns: string[]
  recognizedColumns: RecognizedColumn[]
  missingColumns: MissingColumn[]
  previewRows: Record<string, string>[]
  error?: string
}

// Meta Ads recognized columns (canonical keys from meta-parser COLUMN_MAP)
const META_CANONICAL_LABELS: Record<string, string> = {
  campaign_name: 'Nome da campanha',
  campaign_id: 'ID da campanha',
  adset_name: 'Conjunto de anúncios',
  adset_id: 'ID do conjunto',
  ad_name: 'Nome do anúncio',
  ad_id: 'ID do anúncio',
  date_start: 'Data início',
  date_stop: 'Data fim',
  spend: 'Valor gasto',
  impressions: 'Impressões',
  clicks: 'Cliques',
  reach: 'Alcance',
  cpm: 'CPM',
  cpc: 'CPC',
  ctr: 'CTR',
}

const META_COLUMN_ALIASES: Record<string, string[]> = {
  campaign_name: ['nome da campanha', 'campaign name'],
  campaign_id: ['id da campanha', 'campaign id'],
  adset_name: ['conjunto de anuncios', 'ad set name'],
  adset_id: ['id do conjunto', 'ad set id'],
  ad_name: ['anuncio', 'ad name'],
  ad_id: ['id do anuncio', 'ad id'],
  date_start: ['inicio dos relatorios', 'reporting starts', 'data inicio'],
  date_stop: ['termino dos relatorios', 'reporting ends', 'data fim'],
  spend: ['valor usado', 'amount spent', 'valor gasto', 'spend'],
  impressions: ['impressoes', 'impressions'],
  clicks: ['cliques', 'clicks', 'link clicks'],
  reach: ['alcance', 'reach'],
  cpm: ['cpm'],
  cpc: ['cpc'],
  ctr: ['ctr'],
}

const REQUIRED_FOR_DIAGNOSIS = new Set(['order_date', 'gross_revenue', 'status', 'utm_campaign'])

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function csvFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_csv(sheet)
  }
  return file.text()
}

function detectMetaColumns(headers: string[]): { recognized: RecognizedColumn[]; missing: MissingColumn[] } {
  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeStr(h) }))
  const recognized: RecognizedColumn[] = []

  for (const [canonical, aliases] of Object.entries(META_COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const target = normalizeStr(alias)
      const hit = normalizedHeaders.find(h => h.normalized === target || h.normalized.includes(target))
      if (hit) {
        recognized.push({
          original: hit.original,
          canonical,
          label: META_CANONICAL_LABELS[canonical] ?? canonical,
        })
        break
      }
    }
  }

  return { recognized, missing: [] }
}

export async function generateMetaPreview(file: File): Promise<FilePreviewData> {
  try {
    const csvText = await csvFromFile(file)
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (result.data.length === 0) {
      return {
        fileName: file.name,
        detectedType: 'meta_ads',
        rowCount: 0,
        allColumns: [],
        recognizedColumns: [],
        missingColumns: [],
        previewRows: [],
        error: 'Não conseguimos identificar dados válidos neste arquivo. Confira se ele é um relatório da UTMify ou export do Meta Ads.',
      }
    }

    const headers = Object.keys(result.data[0])
    const { recognized, missing } = detectMetaColumns(headers)

    const previewRows = result.data.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {}
      for (const rec of recognized) {
        mapped[rec.label] = row[rec.original] ?? ''
      }
      return mapped
    })

    return {
      fileName: file.name,
      detectedType: 'meta_ads',
      rowCount: result.data.length,
      allColumns: headers,
      recognizedColumns: recognized,
      missingColumns: missing,
      previewRows,
    }
  } catch (err) {
    return {
      fileName: file.name,
      detectedType: 'unknown',
      rowCount: 0,
      allColumns: [],
      recognizedColumns: [],
      missingColumns: [],
      previewRows: [],
      error: `Erro ao ler arquivo: ${err instanceof Error ? err.message : 'desconhecido'}`,
    }
  }
}

export async function generateUtmifyPreview(file: File): Promise<FilePreviewData> {
  try {
    const csvText = await csvFromFile(file)
    const result = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (result.data.length === 0) {
      return {
        fileName: file.name,
        detectedType: 'unknown',
        rowCount: 0,
        allColumns: [],
        recognizedColumns: [],
        missingColumns: [],
        previewRows: [],
        error: 'Não conseguimos identificar dados válidos neste arquivo. Confira se ele é um relatório da UTMify ou export do Meta Ads.',
      }
    }

    const headers = Object.keys(result.data[0])
    const isDaily = detectIsDailyAggregate(headers)

    if (isDaily) {
      const { mapping, missingColumns: missingKeys, unmappedHeaders: _ } = detectDailyAggregateMapping(headers)

      const recognized: RecognizedColumn[] = Object.entries(mapping)
        .filter(([, v]) => v !== null)
        .map(([canonical, original]) => ({
          original: original as string,
          canonical,
          label: DAILY_COLUMN_LABELS[canonical] ?? canonical,
        }))

      const missing: MissingColumn[] = missingKeys.map(canonical => ({
        canonical,
        label: DAILY_COLUMN_LABELS[canonical] ?? canonical,
        required: DAILY_EXPECTED_COLUMNS.includes(canonical),
      }))

      const reverseMap: Record<string, string> = {}
      for (const rec of recognized) {
        reverseMap[rec.original] = rec.label
      }

      const previewRows = result.data.slice(0, 5).map(row => {
        const mapped: Record<string, string> = {}
        for (const rec of recognized) {
          mapped[rec.label] = row[rec.original] ?? ''
        }
        return mapped
      })

      return {
        fileName: file.name,
        detectedType: 'utmify_daily',
        rowCount: result.data.length,
        allColumns: headers,
        recognizedColumns: recognized,
        missingColumns: missing,
        previewRows,
      }
    }

    // Orders mode
    const { mapping, missingColumns: missingKeys } = detectColumnMapping(headers)

    const recognized: RecognizedColumn[] = Object.entries(mapping)
      .filter(([, v]) => v !== null)
      .map(([canonical, original]) => ({
        original: original as string,
        canonical,
        label: COLUMN_LABELS[canonical] ?? canonical,
      }))

    const missing: MissingColumn[] = missingKeys.map(canonical => ({
      canonical,
      label: COLUMN_LABELS[canonical] ?? canonical,
      required: REQUIRED_FOR_DIAGNOSIS.has(canonical),
    }))

    const previewRows = result.data.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {}
      for (const rec of recognized) {
        mapped[rec.label] = row[rec.original] ?? ''
      }
      return mapped
    })

    return {
      fileName: file.name,
      detectedType: 'utmify_orders',
      rowCount: result.data.length,
      allColumns: headers,
      recognizedColumns: recognized,
      missingColumns: missing,
      previewRows,
    }
  } catch (err) {
    return {
      fileName: file.name,
      detectedType: 'unknown',
      rowCount: 0,
      allColumns: [],
      recognizedColumns: [],
      missingColumns: [],
      previewRows: [],
      error: `Erro ao ler arquivo: ${err instanceof Error ? err.message : 'desconhecido'}`,
    }
  }
}
