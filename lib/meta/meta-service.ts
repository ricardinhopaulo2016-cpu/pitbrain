import { getMetaClient } from './meta-client'
import { MetaWriteDisabledError, SyncAbortedError, isMetaRateLimitError } from './meta-errors'
import {
  normalizeAdAccount,
  normalizeCampaign,
  normalizeAdset,
  normalizeAd,
  normalizeCreative,
  normalizeInsight,
  extractDarkPostAsset,
} from './meta-normalizers'
import { parseCampaignName, parseAdSetName, parseAdName } from '@/lib/parsers/nomenclature-parser'
import { runWithConcurrency } from '@/lib/utils'
import {
  CREATIVE_BATCH_SIZE,
  CREATIVE_BATCH_DELAY_MS,
  META_SYNC_REQUEST_DELAY_MS,
  RATE_LIMIT_BACKOFF_MS,
} from './meta-sync-constants'
import type {
  MetaRawAdAccount,
  MetaRawCampaign,
  MetaRawAdset,
  MetaRawAd,
  MetaRawCreative,
  MetaRawInsight,
  MetaAdAccount,
  MetaCampaign,
  MetaAdset,
  MetaAd,
  MetaCreative,
  MetaDarkPostAsset,
  MetaInsight,
  MetaInsightLevel,
  MetaSyncResult,
} from './meta-types'
import type { ParsedCampaignName, ParsedAdSetName, ParsedAdName } from '@/types/campaign-structure'

const CAMPAIGN_FIELDS =
  'id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,bid_strategy,created_time,updated_time,start_time,stop_time'
const ADSET_FIELDS =
  'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,promoted_object,created_time,updated_time'
const AD_FIELDS =
  'id,name,campaign_id,adset_id,status,effective_status,creative{id},created_time,updated_time,preview_shareable_link'
const CREATIVE_FIELDS =
  'id,name,object_story_id,effective_object_story_id,object_story_spec,asset_feed_spec,call_to_action_type,url_tags,body,title,image_url,thumbnail_url,video_id,instagram_permalink_url,link_url'
const INSIGHT_FIELDS =
  'campaign_id,adset_id,ad_id,spend,impressions,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type,purchase_roas,website_purchase_roas'

export async function listAdAccounts(): Promise<MetaAdAccount[]> {
  const client = getMetaClient()
  const raw = await client.paginate<MetaRawAdAccount>('/me/adaccounts', {
    fields: 'id,account_id,name,currency,timezone_name,account_status',
  })
  return raw.map(normalizeAdAccount)
}

export async function getCampaigns(adAccountId: string, signal?: AbortSignal): Promise<MetaCampaign[]> {
  const client = getMetaClient()
  const raw = await client.paginate<MetaRawCampaign>(
    `/${adAccountId}/campaigns`,
    { fields: CAMPAIGN_FIELDS, limit: 100 },
    20,
    signal
  )
  return raw.map(normalizeCampaign)
}

export async function getAdsets(adAccountId: string, campaignId?: string, signal?: AbortSignal): Promise<MetaAdset[]> {
  const client = getMetaClient()
  const path = campaignId ? `/${campaignId}/adsets` : `/${adAccountId}/adsets`
  const raw = await client.paginate<MetaRawAdset>(path, { fields: ADSET_FIELDS, limit: 100 }, 20, signal)
  return raw.map(normalizeAdset)
}

export async function getAds(
  adAccountId: string,
  campaignId?: string,
  adsetId?: string,
  signal?: AbortSignal
): Promise<MetaAd[]> {
  const client = getMetaClient()
  const path = adsetId ? `/${adsetId}/ads` : campaignId ? `/${campaignId}/ads` : `/${adAccountId}/ads`
  const raw = await client.paginate<MetaRawAd>(path, { fields: AD_FIELDS, limit: 100 }, 20, signal)
  return raw.map(normalizeAd)
}

const IDS_BATCH_LIMIT = 50 // Graph API's `?ids=` endpoint rejects requests with more than 50 ids
const CREATIVE_FETCH_CONCURRENCY = 3 // only applies to getAdCreatives()'s on-demand id-batch fan-out, not the sync loop

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Like `sleep`, but resolves early if `signal` aborts instead of leaving a dangling timer. */
async function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export interface RateLimitRetryState {
  used: boolean
}

/**
 * Exactly one retry, shared across an entire `runMetaSync()` invocation — not per request.
 * `retryState` is created once per sync and threaded through every call site (campaigns, each
 * adsets/ads iteration, each creative batch), so whichever stage hits the rate limit first spends
 * the sync's single retry budget; any later rate limit (or a second one from the same call) just
 * propagates and aborts the sync, as before.
 */
async function withRateLimitBackoff<T>(
  op: () => Promise<T>,
  retryState: RateLimitRetryState,
  signal: AbortSignal
): Promise<T> {
  try {
    return await op()
  } catch (err) {
    if (isMetaRateLimitError(err) && !retryState.used) {
      retryState.used = true
      await sleepAbortable(RATE_LIMIT_BACKOFF_MS, signal)
      if (signal.aborted) throw new SyncAbortedError('cancelled')
      return await op()
    }
    throw err
  }
}

/** Batch-fetches creatives by id via the Graph API's root `?ids=` endpoint (chunked to stay under the 50-id cap). */
export async function getAdCreatives(adAccountId: string, creativeIds: string[], signal?: AbortSignal): Promise<MetaCreative[]> {
  if (creativeIds.length === 0) return []
  const client = getMetaClient()
  const unique = Array.from(new Set(creativeIds))

  const batches = await runWithConcurrency(chunk(unique, IDS_BATCH_LIMIT), CREATIVE_FETCH_CONCURRENCY, batch =>
    client.get<Record<string, MetaRawCreative>>('/', { ids: batch.join(','), fields: CREATIVE_FIELDS }, signal)
  )
  const byId = Object.assign({}, ...batches) as Record<string, MetaRawCreative>

  return unique.filter(id => byId[id]).map(id => normalizeCreative(byId[id]))
}

export type CreativeFetcher = (
  creativeIds: string[],
  signal: AbortSignal,
  retryState: RateLimitRetryState
) => AsyncGenerator<number, MetaCreative[], void>

/**
 * Serial, small-batch creative fetch used by the safe sync loop (as opposed to `getAdCreatives`'s
 * `runWithConcurrency` fan-out): batches of `CREATIVE_BATCH_SIZE` ids, one request at a time, with
 * a fixed delay between batches — yields the running count after each batch so the caller can
 * report progress. This is the default `CreativeFetcher`; `lib/meta/meta-creative-cache.ts` provides
 * a cache-aware alternative with the same signature for dependency injection into `runMetaSync`.
 */
export async function* fetchCreativesSerial(
  creativeIds: string[],
  signal: AbortSignal,
  retryState: RateLimitRetryState
): AsyncGenerator<number, MetaCreative[], void> {
  const unique = Array.from(new Set(creativeIds))
  if (unique.length === 0) return []

  const client = getMetaClient()
  const byId: Record<string, MetaRawCreative> = {}
  const batches = chunk(unique, CREATIVE_BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    if (signal.aborted) throw new SyncAbortedError('cancelled')
    const result = await withRateLimitBackoff(
      () => client.get<Record<string, MetaRawCreative>>('/', { ids: batches[i].join(','), fields: CREATIVE_FIELDS }, signal),
      retryState,
      signal
    )
    Object.assign(byId, result)
    yield Object.keys(byId).length
    if (i < batches.length - 1) await sleep(CREATIVE_BATCH_DELAY_MS)
  }

  return unique.filter(id => byId[id]).map(id => normalizeCreative(byId[id]))
}

export interface GetInsightsOptions {
  datePreset?: string // e.g. 'last_7d' | 'last_30d' | 'maximum'
  since?: string // YYYY-MM-DD, used together with `until`
  until?: string
  limit?: number // caps returned rows — used by the separate, opt-in Insights Sync
}

export async function getInsights(
  adAccountId: string,
  level: MetaInsightLevel,
  options: GetInsightsOptions = {},
  signal?: AbortSignal
): Promise<MetaInsight[]> {
  const client = getMetaClient()
  const params: Record<string, string | number> = {
    level,
    fields: INSIGHT_FIELDS,
  }
  if (options.since && options.until) {
    params.time_range = JSON.stringify({ since: options.since, until: options.until })
  } else {
    params.date_preset = options.datePreset ?? 'last_30d'
  }
  if (options.limit) params.limit = options.limit

  // A bounded request only needs its first page — paginating further would defeat `limit`'s point.
  const maxPages = options.limit ? 1 : 20
  const raw = await client.paginate<MetaRawInsight>(`/${adAccountId}/insights`, params, maxPages, signal)
  const mapped = raw.map(r => normalizeInsight(r, level))
  return options.limit ? mapped.slice(0, options.limit) : mapped
}

export interface MetaCampaignDecoded extends MetaCampaign {
  decoded: ParsedCampaignName
}
export interface MetaAdsetDecoded extends MetaAdset {
  decoded: ParsedAdSetName
}
export interface MetaAdDecoded extends MetaAd {
  decoded: ParsedAdName
}

export interface SyncMetaAccountResult extends MetaSyncResult {
  campaignsDecoded: MetaCampaignDecoded[]
  adsetsDecoded: MetaAdsetDecoded[]
  adsDecoded: MetaAdDecoded[]
  /** Set when the sync ended early because no campaign matched the filters — UI shows this instead of the normal summary. */
  emptyReason?: string
}

// ── Safe sync scope ────────────────────────────────────────────────────────────
// Ultra-safe defaults: active campaigns only, small limits — the first sync should
// never risk hitting Meta's rate limit before the user opts into more. Insights are
// no longer part of this scope — they're a fully separate, opt-in sync (see Insights
// Sync in app/meta-sync/page.tsx and GET /api/meta/insights).

export interface MetaSyncScope {
  status: 'active' | 'all'
  campaignLimit: number
  adLimit: number
  nameContains?: string
}

export const DEFAULT_SYNC_SCOPE: MetaSyncScope = {
  status: 'active',
  campaignLimit: 10,
  adLimit: 50,
}

export type MetaSyncStage = 'campaigns' | 'adsets' | 'ads' | 'creatives' | 'dark_posts' | 'done'

export interface MetaSyncCounts {
  campaigns: number
  adsets: number
  ads: number
  creatives: number
  darkPosts: number
}

/** Snapshot of whatever's been fetched so far — attached to stage-boundary progress events only, so the route handler can checkpoint to Supabase without resending growing arrays on every tick. */
export interface MetaSyncCheckpointData {
  campaigns?: MetaCampaign[]
  adsets?: MetaAdset[]
  ads?: MetaAd[]
  creatives?: MetaCreative[]
  darkPosts?: MetaDarkPostAsset[]
}

export interface MetaSyncProgressEvent {
  type: 'progress'
  stage: MetaSyncStage
  counts: Partial<MetaSyncCounts>
  data?: MetaSyncCheckpointData
}

const EMPTY_COUNTS: MetaSyncCounts = { campaigns: 0, adsets: 0, ads: 0, creatives: 0, darkPosts: 0 }

function isActive(entity: { effectiveStatus?: string; status: string }): boolean {
  return (entity.effectiveStatus ?? entity.status) === 'ACTIVE'
}

export interface RunMetaSyncDeps {
  /** Injected by app/api/meta/sync/route.ts to check/populate the Supabase creative cache; defaults to the pure, Supabase-free fetchCreativesSerial. */
  fetchCreatives?: CreativeFetcher
}

/**
 * Read-only structural sync for one ad account, run as an async generator so the caller (the
 * streaming API route) can relay progress + partial counts to the UI as each stage completes.
 * Serial by design (no `Promise.all` fan-out across campaigns/adsets/ads) to keep request volume
 * predictable under `scope` limits, with an explicit delay between iterations
 * (`META_SYNC_REQUEST_DELAY_MS`) — the main defenses against tripping Meta's rate limit, backed by
 * a single rate-limit retry (see `withRateLimitBackoff`). `signal` aborts cooperatively: checked
 * between every network call/batch, never mid-request. Stays Supabase-agnostic on purpose — the
 * only I/O this function knows about is the Meta API and, optionally, `deps.fetchCreatives`.
 */
export async function* runMetaSync(
  adAccountId: string,
  scope: MetaSyncScope,
  signal: AbortSignal,
  deps: RunMetaSyncDeps = {}
): AsyncGenerator<MetaSyncProgressEvent, SyncMetaAccountResult, void> {
  function checkAbort() {
    if (signal.aborted) throw new SyncAbortedError('cancelled')
  }
  const dev = process.env.NODE_ENV === 'development'
  function log(...args: unknown[]) {
    if (dev) console.log('[pitbrain:meta:sync]', adAccountId, ...args)
  }

  const retryState: RateLimitRetryState = { used: false }
  const counts: MetaSyncCounts = { ...EMPTY_COUNTS }

  // ── Campaigns ──
  log('etapa: campanhas')
  checkAbort()
  let campaigns = await withRateLimitBackoff(() => getCampaigns(adAccountId, signal), retryState, signal)
  if (scope.status === 'active') campaigns = campaigns.filter(isActive)
  if (scope.nameContains?.trim()) {
    const needle = scope.nameContains.trim().toLowerCase()
    campaigns = campaigns.filter(c => c.name.toLowerCase().includes(needle))
  }
  campaigns = campaigns.slice(0, scope.campaignLimit)
  counts.campaigns = campaigns.length
  log('campanhas encontradas', counts.campaigns)
  yield { type: 'progress', stage: 'campaigns', counts: { campaigns: counts.campaigns }, data: { campaigns } }

  if (campaigns.length === 0) {
    const syncedAt = new Date().toISOString()
    yield { type: 'progress', stage: 'done', counts: { ...counts } }
    log('nenhuma campanha encontrada com esse filtro — encerrando cedo')
    return {
      adAccountId,
      syncedAt,
      campaigns: [],
      adsets: [],
      ads: [],
      creatives: [],
      darkPosts: [],
      campaignsDecoded: [],
      adsetsDecoded: [],
      adsDecoded: [],
      counts,
      emptyReason: 'Nenhuma campanha encontrada com esse filtro.',
    }
  }

  // ── Adsets (serial — one request per campaign, spaced by META_SYNC_REQUEST_DELAY_MS) ──
  log('etapa: conjuntos')
  const adsets: MetaAdset[] = []
  for (let i = 0; i < campaigns.length; i++) {
    checkAbort()
    const c = campaigns[i]
    const batch = await withRateLimitBackoff(() => getAdsets(adAccountId, c.id, signal), retryState, signal)
    adsets.push(...(scope.status === 'active' ? batch.filter(isActive) : batch))
    counts.adsets = adsets.length
    yield { type: 'progress', stage: 'adsets', counts: { adsets: counts.adsets } }
    if (i < campaigns.length - 1) await sleepAbortable(META_SYNC_REQUEST_DELAY_MS, signal)
  }
  log('conjuntos encontrados', counts.adsets)
  yield { type: 'progress', stage: 'adsets', counts: { adsets: counts.adsets }, data: { adsets } }

  // ── Ads (serial — one request per adset, stop once adLimit is reached) ──
  log('etapa: anúncios')
  const ads: MetaAd[] = []
  for (let i = 0; i < adsets.length; i++) {
    if (ads.length >= scope.adLimit) break
    checkAbort()
    const a = adsets[i]
    const batch = await withRateLimitBackoff(() => getAds(adAccountId, undefined, a.id, signal), retryState, signal)
    ads.push(...(scope.status === 'active' ? batch.filter(isActive) : batch))
    counts.ads = Math.min(ads.length, scope.adLimit)
    yield { type: 'progress', stage: 'ads', counts: { ads: counts.ads } }
    if (i < adsets.length - 1 && ads.length < scope.adLimit) await sleepAbortable(META_SYNC_REQUEST_DELAY_MS, signal)
  }
  const limitedAds = ads.slice(0, scope.adLimit)
  counts.ads = limitedAds.length
  log('anúncios encontrados', counts.ads)
  yield { type: 'progress', stage: 'ads', counts: { ads: counts.ads }, data: { ads: limitedAds } }

  // ── Creatives (cache-aware via deps.fetchCreatives, serial, small batches, delay between batches) ──
  log('etapa: criativos')
  const creativeIds = limitedAds.map(a => a.creativeId).filter((id): id is string => Boolean(id))
  const fetchCreatives = deps.fetchCreatives ?? fetchCreativesSerial
  let creatives: MetaCreative[]
  {
    const gen = fetchCreatives(creativeIds, signal, retryState)
    while (true) {
      let step: IteratorResult<number, MetaCreative[]>
      try {
        step = await gen.next()
      } catch (err) {
        if (isMetaRateLimitError(err)) log('rate limit detectado — abortando sync')
        throw err
      }
      if (step.done) {
        creatives = step.value
        break
      }
      counts.creatives = step.value
      yield { type: 'progress', stage: 'creatives', counts: { creatives: counts.creatives } }
    }
  }
  log('criativos encontrados', counts.creatives)

  // ── Dark posts (pure, in-memory — no extra requests) ──
  log('etapa: dark posts')
  const campaignById = new Map(campaigns.map(c => [c.id, c]))
  const adsetById = new Map(adsets.map(a => [a.id, a]))
  const creativeById = new Map(creatives.map(c => [c.id, c]))
  const syncedAt = new Date().toISOString()
  const darkPosts = limitedAds.map(ad =>
    extractDarkPostAsset(
      ad,
      ad.creativeId ? creativeById.get(ad.creativeId) : undefined,
      campaignById.get(ad.campaignId),
      adsetById.get(ad.adsetId),
      syncedAt
    )
  )
  counts.darkPosts = darkPosts.filter(d => d.darkPostReady).length
  log('dark posts detectados', counts.darkPosts)
  yield { type: 'progress', stage: 'dark_posts', counts: { darkPosts: counts.darkPosts }, data: { creatives, darkPosts } }

  const campaignsDecoded: MetaCampaignDecoded[] = campaigns.map(c => ({ ...c, decoded: parseCampaignName(c.name) }))
  const adsetsDecoded: MetaAdsetDecoded[] = adsets.map(a => ({ ...a, decoded: parseAdSetName(a.name) }))
  const adsDecoded: MetaAdDecoded[] = limitedAds.map(a => ({ ...a, decoded: parseAdName(a.name) }))

  yield { type: 'progress', stage: 'done', counts: { ...counts } }
  log('sync finalizado', counts)

  return {
    adAccountId,
    syncedAt,
    campaigns,
    adsets,
    ads: limitedAds,
    creatives,
    darkPosts,
    campaignsDecoded,
    adsetsDecoded,
    adsDecoded,
    counts,
  }
}

/**
 * Non-streaming convenience wrapper around `runMetaSync` for callers that just want the final
 * result (e.g. the planned MCP tool in `mcp/meta-tools/README.md`) — drains the generator and
 * discards progress events. Prefer `runMetaSync` directly when the caller can relay progress.
 */
export async function syncMetaAccount(adAccountId: string): Promise<SyncMetaAccountResult> {
  const scope: MetaSyncScope = {
    status: 'all',
    campaignLimit: Number.MAX_SAFE_INTEGER,
    adLimit: Number.MAX_SAFE_INTEGER,
  }
  const controller = new AbortController()
  const gen = runMetaSync(adAccountId, scope, controller.signal)
  let result: IteratorResult<MetaSyncProgressEvent, SyncMetaAccountResult>
  do {
    result = await gen.next()
  } while (!result.done)
  return result.value
}

// ── Write actions — disabled in this MVP (read-only phase) ────────────────────

export function createCampaign(): never {
  throw new MetaWriteDisabledError()
}
export function updateCampaign(): never {
  throw new MetaWriteDisabledError()
}
export function pauseCampaign(): never {
  throw new MetaWriteDisabledError()
}
export function publishAd(): never {
  throw new MetaWriteDisabledError()
}
