import type { MetaSyncScope } from './meta-service'
import { CREATIVE_BATCH_SIZE } from './meta-sync-constants'

export type MetaSyncPresetId = 'seguro' | 'medio' | 'completo'

export interface MetaSyncPreset {
  id: MetaSyncPresetId
  label: string
  description: string
  scope: MetaSyncScope
  needsConfirmation: boolean
}

export const SYNC_PRESETS: MetaSyncPreset[] = [
  {
    id: 'seguro',
    label: 'Seguro',
    description: 'Ativas · 10 campanhas · 50 anúncios',
    scope: { status: 'active', campaignLimit: 10, adLimit: 50 },
    needsConfirmation: false,
  },
  {
    id: 'medio',
    label: 'Médio',
    description: 'Ativas · 25 campanhas · 100 anúncios',
    scope: { status: 'active', campaignLimit: 25, adLimit: 100 },
    needsConfirmation: false,
  },
  {
    id: 'completo',
    label: 'Completo',
    description: 'Todas · 50 campanhas · 250 anúncios',
    scope: { status: 'all', campaignLimit: 50, adLimit: 250 },
    needsConfirmation: true,
  },
]

/** Default scope for the separate, opt-in Insights Sync — not a MetaSyncScope, insights aren't part of Structure Sync anymore. */
export const DEFAULT_INSIGHTS_SCOPE = {
  level: 'ad' as const,
  datePreset: 'last_7d',
  limit: 50,
}

export interface MetaSyncPlan {
  adAccountId: string
  syncType: 'structure' | 'insights'
  statusFilter: 'active' | 'all'
  campaignLimit: number
  adsLimit: number
  nameContains?: string
  includeInsights: boolean
  estimatedRequests: number
  warnings: string[]
}

const HEAVY_CAMPAIGN_LIMIT = 25
const HEAVY_AD_LIMIT = 100
const HEAVY_REQUEST_THRESHOLD = 40

/**
 * Pure arithmetic estimate — no network calls. Real adset/ad counts per campaign aren't known
 * until the sync actually runs, so this is a rough upper bound (worst case: one adset per
 * campaign, one ad per adset) meant to size the warning banner, not to guarantee a call count.
 */
export function buildSyncPlan(adAccountId: string, scope: MetaSyncScope): MetaSyncPlan {
  const estimatedRequests =
    1 + // campaigns
    scope.campaignLimit + // adsets, ~1 request per campaign
    scope.campaignLimit + // ads, ~1 request per adset (campaignLimit used as a rough adset-count proxy)
    Math.ceil(scope.adLimit / CREATIVE_BATCH_SIZE) // creative batches

  const warnings: string[] = []
  if (scope.status === 'all') warnings.push('Status "Todas" inclui campanhas pausadas e arquivadas — mais chamadas que "Ativas".')
  if (scope.campaignLimit > HEAVY_CAMPAIGN_LIMIT) warnings.push(`Limite de campanhas alto (${scope.campaignLimit}).`)
  if (scope.adLimit > HEAVY_AD_LIMIT) warnings.push(`Limite de anúncios alto (${scope.adLimit}).`)
  if (estimatedRequests > HEAVY_REQUEST_THRESHOLD) {
    warnings.push(`Estimativa de ~${estimatedRequests} chamadas à Meta — escopo pesado, risco de rate limit.`)
  }

  return {
    adAccountId,
    syncType: 'structure',
    statusFilter: scope.status,
    campaignLimit: scope.campaignLimit,
    adsLimit: scope.adLimit,
    nameContains: scope.nameContains,
    includeInsights: false,
    estimatedRequests,
    warnings,
  }
}

export function planNeedsConfirmation(plan: MetaSyncPlan): boolean {
  return plan.statusFilter === 'all' && plan.campaignLimit > HEAVY_CAMPAIGN_LIMIT && plan.adsLimit > HEAVY_AD_LIMIT
    ? true
    : plan.warnings.length >= 2
}
