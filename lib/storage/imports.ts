import type { PitbrainImport, PitbrainImportSummary } from '@/types/pitbrain'
import type { ImportSummary, LastImport } from '@/lib/calculators/local-metrics'
import type { UtmifyParseResult } from '@/types/utmify'

const IMPORTS_KEY     = 'pitbrain:imports'
const ACTIVE_ID_KEY   = 'pitbrain:activeImportId'

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function loadImports(): PitbrainImport[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(IMPORTS_KEY)
    return raw ? (JSON.parse(raw) as PitbrainImport[]) : []
  } catch { return [] }
}

export function saveImportToList(imp: PitbrainImport): void {
  try {
    const list = loadImports()
    const updated = [imp, ...list.filter(i => i.id !== imp.id)]
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(updated))
  } catch {}
}

export function deleteImportById(id: string): void {
  try {
    const list = loadImports().filter(i => i.id !== id)
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(list))
    if (getActiveImportId() === id) setActiveImportId(null)
  } catch {}
}

export function renameImportById(id: string, name: string): void {
  try {
    const list = loadImports().map(i =>
      i.id === id ? { ...i, name, updatedAt: new Date().toISOString() } : i
    )
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(list))
  } catch {}
}

// ── Active import ID ──────────────────────────────────────────────────────────

export function getActiveImportId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(ACTIVE_ID_KEY) } catch { return null }
}

export function setActiveImportId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_ID_KEY, id)
    else localStorage.removeItem(ACTIVE_ID_KEY)
  } catch {}
}

export function getActiveImport(): PitbrainImport | null {
  const id = getActiveImportId()
  if (!id) return null
  return loadImports().find(i => i.id === id) ?? null
}

// ── Converters ────────────────────────────────────────────────────────────────

export function importSummaryToPitbrain(s: ImportSummary): PitbrainImportSummary {
  return {
    spend:       s.spend,
    revenue:     s.revenue,
    profit:      s.profit,
    roas:        s.roas,
    roi:         s.roi,
    sales:       s.purchases,
    cpa:         s.cpa,
    cpc:         s.cpc,
    ctr:         s.ctr,
    cpm:         s.cpm,
    clicks:      s.clicks,
    impressions: s.impressions,
    pageViews:   s.pageViews,
    ic:          s.initiateCheckout,
  }
}

export function pitbrainImportToLastImport(imp: PitbrainImport): LastImport {
  const summary: ImportSummary = {
    startDate:        imp.dateRange?.start ?? null,
    endDate:          imp.dateRange?.end ?? null,
    days:             0,
    spend:            imp.summary.spend,
    revenue:          imp.summary.revenue,
    profit:           imp.summary.profit,
    purchases:        imp.summary.sales,
    initiateCheckout: imp.summary.ic,
    clicks:           imp.summary.clicks,
    impressions:      imp.summary.impressions,
    pageViews:        imp.summary.pageViews,
    roas:             imp.summary.roas,
    roi:              imp.summary.roi,
    cpa:              imp.summary.cpa,
    cpi:              null,
    cpc:              imp.summary.cpc,
    ctr:              imp.summary.ctr,
    cpm:              imp.summary.cpm,
    ignoredFooterRowsCount: imp.ignoredFooterRowsCount,
  }

  return {
    sourceType:             imp.sourceType,
    fileName:               imp.originalFileName,
    importedAt:             imp.createdAt,
    rows:                   imp.rows as LastImport['rows'],
    summary,
    fileHash:               imp.fileHash,
    importMode:             'replace_current',
    breakdownLevel:         imp.breakdownLevel,
    dimensionField:         imp.dimensionField,
    dimensionLabel:         imp.dimensionLabel,
    ignoredFooterRowsCount: imp.ignoredFooterRowsCount,
  }
}

// ── Builder from parse result ─────────────────────────────────────────────────

export function buildPitbrainImport(opts: {
  parseResult: UtmifyParseResult
  fileName: string
  fileHash: string
  summary: ImportSummary
  dateRange?: { start: string; end: string }
}): PitbrainImport {
  const { parseResult, fileName, fileHash, summary, dateRange } = opts
  const now = new Date().toISOString()
  const id  = crypto.randomUUID()
  const name = fileName.replace(/\.[^.]+$/, '')

  const periodLabel = dateRange ? `${dateRange.start} → ${dateRange.end}` : undefined

  const base = {
    id,
    name,
    originalFileName: fileName,
    source: 'utmify' as const,
    sourceType: parseResult.sourceType,
    dateRange: dateRange ?? null,
    periodLabel,
    rows: parseResult.rows,
    summary: importSummaryToPitbrain(summary),
    rowCount: parseResult.rows.length,
    ignoredFooterRowsCount: 0,
    fileHash,
    createdAt: now,
    updatedAt: now,
  }

  if (parseResult.sourceType === 'utmify_utm_breakdown') {
    return {
      ...base,
      sourceType: 'utmify_utm_breakdown',
      breakdownLevel:         parseResult.breakdownLevel,
      dimensionField:         parseResult.dimensionField,
      dimensionLabel:         parseResult.dimensionLabel,
      ignoredFooterRowsCount: parseResult.ignoredFooterRowsCount,
    }
  }

  return base as PitbrainImport
}
