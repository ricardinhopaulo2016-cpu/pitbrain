// Core PitBrain domain types — independent of any third-party API

export type UtmifySourceType = 'utmify_orders' | 'utmify_daily_aggregate' | 'utmify_utm_breakdown'
export type BreakdownLevel = 'campaign' | 'adset' | 'ad' | 'placement'

export interface PitbrainImportSummary {
  spend: number
  revenue: number
  profit: number
  roas: number | null
  roi: number | null
  sales: number
  cpa: number | null
  cpc: number | null
  ctr: number | null
  cpm: number | null
  clicks: number
  impressions: number
  pageViews: number
  ic: number
}

export interface PitbrainImport {
  id: string
  name: string
  originalFileName: string
  source: 'utmify'
  sourceType: UtmifySourceType
  breakdownLevel?: BreakdownLevel
  dimensionField?: string
  dimensionLabel?: string
  product?: string
  funnelGroup?: string
  tags?: string[]
  periodLabel?: string
  dateRange?: { start?: string; end?: string } | null
  rows: unknown[]
  footerTotals?: unknown[]
  summary: PitbrainImportSummary
  rowCount: number
  ignoredFooterRowsCount: number
  fileHash: string
  createdAt: string
  updatedAt: string
}

export type PitbrainImportPatch = Partial<
  Pick<PitbrainImport, 'name' | 'product' | 'funnelGroup' | 'tags' | 'periodLabel'>
>
