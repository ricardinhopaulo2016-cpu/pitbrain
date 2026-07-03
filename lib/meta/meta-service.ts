import { getMetaClient } from './meta-client'
import { MetaWriteDisabledError, SyncAbortedError, isMetaRateLimitError, isMetaTokenError, isMetaPermissionError } from './meta-errors'
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
  HEARTBEAT_TICK_MS,
  ADSET_PER_CAMPAIGN_TIMEOUT_MS,
  ADSET_MAX_PAGES_PER_CAMPAIGN,
  ADSET_ACCOUNT_FALLBACK_MAX_PAGES,
  ADSET_ACCOUNT_FALLBACK_TIMEOUT_MS,
  ADS_PER_CAMPAIGN_TIMEOUT_MS,
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

export async function getCampaigns(
  adAccountId: string,
  signal?: AbortSignal,
  onHeartbeat?: () => void
): Promise<MetaCampaign[]> {
  const client = getMetaClient()
  const raw = await client.paginate<MetaRawCampaign>(
    `/${adAccountId}/campaigns`,
    { fields: CAMPAIGN_FIELDS, limit: 100 },
    10,
    signal,
    onHeartbeat
  )
  return raw.map(normalizeCampaign)
}

export async function getAdsets(
  adAccountId: string,
  campaignId?: string,
  signal?: AbortSignal,
  onHeartbeat?: () => void,
  maxPages = 10
): Promise<MetaAdset[]> {
  const client = getMetaClient()
  const path = campaignId ? `/${campaignId}/adsets` : `/${adAccountId}/adsets`
  const raw = await client.paginate<MetaRawAdset>(path, { fields: ADSET_FIELDS, limit: 100 }, maxPages, signal, onHeartbeat)
  return raw.map(normalizeAdset)
}

export async function getAds(
  adAccountId: string,
  campaignId?: string,
  adsetId?: string,
  signal?: AbortSignal,
  onHeartbeat?: () => void,
  maxPages = 10
): Promise<MetaAd[]> {
  const client = getMetaClient()
  const path = adsetId ? `/${adsetId}/ads` : campaignId ? `/${campaignId}/ads` : `/${adAccountId}/ads`
  const raw = await client.paginate<MetaRawAd>(path, { fields: AD_FIELDS, limit: 100 }, maxPages, signal, onHeartbeat)
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

/**
 * Like `sleepAbortable`, but for sleeps long enough that they'd otherwise starve the caller's stage
 * watchdog: ticks in HEARTBEAT_TICK_MS slices, touching `onHeartbeat` each tick. Without this, the
 * rate-limit backoff sleep (60s, longer than the 45s stage watchdog) would make the watchdog wrongly
 * abort the sync as "stalled" while it's just waiting out the intended single retry.
 */
async function sleepWithHeartbeat(ms: number, signal: AbortSignal, onHeartbeat?: () => void): Promise<void> {
  let remaining = ms
  while (remaining > 0 && !signal.aborted) {
    const tick = Math.min(HEARTBEAT_TICK_MS, remaining)
    await sleepAbortable(tick, signal)
    onHeartbeat?.()
    remaining -= tick
  }
}

/**
 * Runs `op` with a fresh AbortSignal that's aborted either when `outerSignal` aborts or when
 * `timeoutMs` elapses, whichever comes first — `op` receives this combined signal and must thread
 * it all the way down to the actual fetch (e.g. via MetaClient) for the timeout to really cancel
 * in-flight work instead of just abandoning it. Used to bound a single campaign's adsets/ads fetch
 * (all its pages combined) without tearing down the whole sync when just one item is slow.
 */
async function withPerCallTimeout<T>(
  op: (signal: AbortSignal) => Promise<T>,
  outerSignal: AbortSignal,
  timeoutMs: number
): Promise<T> {
  const perCallController = new AbortController()
  if (outerSignal.aborted) perCallController.abort()
  const onOuterAbort = () => perCallController.abort()
  outerSignal.addEventListener('abort', onOuterAbort, { once: true })
  const timer = setTimeout(() => perCallController.abort(), timeoutMs)
  try {
    return await op(perCallController.signal)
  } finally {
    clearTimeout(timer)
    outerSignal.removeEventListener('abort', onOuterAbort)
  }
}

export interface RateLimitRetryState {
  used: boolean
}

/**
 * Exactly one retry, shared across an entire `runMetaSync()` invocation — not per request.
 * `retryState` is created once per sync and threaded through every call site (campaigns, each
 * adsets/ads iteration, each creative batch), so whichever stage hits the rate limit first spends
 * the sync's single retry budget; any later rate limit (or a second one from the same call) just
 * propagates and aborts the sync, as before. Always keyed off `signal` (the sync-wide abort), never
 * a per-call timeout signal — a rate limit is an account/token-wide condition, not scoped to
 * whatever single item happened to trigger it.
 */
async function withRateLimitBackoff<T>(
  op: () => Promise<T>,
  retryState: RateLimitRetryState,
  signal: AbortSignal,
  onHeartbeat?: () => void
): Promise<T> {
  try {
    return await op()
  } catch (err) {
    if (isMetaRateLimitError(err) && !retryState.used) {
      retryState.used = true
      await sleepWithHeartbeat(RATE_LIMIT_BACKOFF_MS, signal, onHeartbeat)
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
  retryState: RateLimitRetryState,
  onHeartbeat?: () => void
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
  retryState: RateLimitRetryState,
  onHeartbeat?: () => void
): AsyncGenerator<number, MetaCreative[], void> {
  const unique = Array.from(new Set(creativeIds))
  if (unique.length === 0) return []

  const client = getMetaClient()
  const byId: Record<string, MetaRawCreative> = {}
  const batches = chunk(unique, CREATIVE_BATCH_SIZE)

  for (let i = 0; i < batches.length; i++) {
    if (signal.aborted) throw new SyncAbortedError('cancelled')
    const result = await withRateLimitBackoff(
      () => client.get<Record<string, MetaRawCreative>>('/', { ids: batches[i].join(','), fields: CREATIVE_FIELDS }, signal, onHeartbeat),
      retryState,
      signal,
      onHeartbeat
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
  /** Contextual notes for expected-but-surprising-looking outcomes (e.g. ads found but no creatives) — not errors, just explanations so a real absence of data doesn't read as a bug. */
  warnings?: string[]
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
  /** Which item (campaign, currently) is in flight during a per-item loop — only set on the
   * lightweight per-iteration events, not the stage-boundary ones carrying `data`, since "current
   * item" is a stale concept once a stage has fully finished. */
  currentItem?: { index: number; total: number; name: string }
}

const EMPTY_COUNTS: MetaSyncCounts = { campaigns: 0, adsets: 0, ads: 0, creatives: 0, darkPosts: 0 }

function isActive(entity: { effectiveStatus?: string; status: string }): boolean {
  return (entity.effectiveStatus ?? entity.status) === 'ACTIVE'
}

export interface RunMetaSyncDeps {
  /** Injected by app/api/meta/sync/route.ts to check/populate the Supabase creative cache; defaults to the pure, Supabase-free fetchCreativesSerial. */
  fetchCreatives?: CreativeFetcher
  /** Called on every real Meta request attempt (including each page of a paginate() call) and at
   * every stage-boundary yield — lets the caller's stall watchdog tell "still working" apart from
   * "truly stuck," at a finer grain than the per-campaign/per-adset progress events alone give. */
  onHeartbeat?: () => void
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
  let campaigns = await withRateLimitBackoff(
    () => getCampaigns(adAccountId, signal, deps.onHeartbeat),
    retryState,
    signal,
    deps.onHeartbeat
  )
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

  // ── Adsets (serial — one request per campaign, spaced by META_SYNC_REQUEST_DELAY_MS, each call
  // bounded by ADSET_PER_CAMPAIGN_TIMEOUT_MS so one slow/looping campaign can't stall the whole
  // stage — it's skipped and the sync moves on instead) ──
  log('etapa: conjuntos')
  // Emitted immediately, before the first (possibly slow) getAdsets() call — otherwise the client
  // shows nothing between the campaigns event and however long campaign[0]'s adsets fetch takes,
  // which is exactly what made a slow/looping first fetch look like a stuck "Buscando campanhas."
  yield { type: 'progress', stage: 'adsets', counts: { adsets: 0 } }
  const adsets: MetaAdset[] = []
  const failedAdsetCampaignIds: string[] = []
  for (let i = 0; i < campaigns.length; i++) {
    checkAbort()
    const c = campaigns[i]
    yield {
      type: 'progress',
      stage: 'adsets',
      counts: { adsets: counts.adsets },
      currentItem: { index: i + 1, total: campaigns.length, name: c.name },
    }
    try {
      const batch = await withRateLimitBackoff(
        () =>
          withPerCallTimeout(
            sig => getAdsets(adAccountId, c.id, sig, deps.onHeartbeat, ADSET_MAX_PAGES_PER_CAMPAIGN),
            signal,
            ADSET_PER_CAMPAIGN_TIMEOUT_MS
          ),
        retryState,
        signal,
        deps.onHeartbeat
      )
      adsets.push(...(scope.status === 'active' ? batch.filter(isActive) : batch))
    } catch (err) {
      // A real sync-level abort (cancel/global-timeout/stall-watchdog — checked via the OUTER
      // `signal`, not the per-call one, since both surface as the same abort error otherwise) or an
      // account/token-wide condition (rate limit, dead token, missing permission) isn't specific to
      // this campaign and must propagate. Do not simplify this to `err instanceof SyncAbortedError`
      // — a real outer abort during this call surfaces as a plain MetaAPIError(499), not that type.
      if (signal.aborted || isMetaRateLimitError(err) || isMetaTokenError(err) || isMetaPermissionError(err)) throw err
      failedAdsetCampaignIds.push(c.id)
      log('timeout/erro ao buscar adsets da campanha', c.id, c.name, err instanceof Error ? err.message : err)
    }
    counts.adsets = adsets.length
    yield { type: 'progress', stage: 'adsets', counts: { adsets: counts.adsets } }
    if (i < campaigns.length - 1) await sleepAbortable(META_SYNC_REQUEST_DELAY_MS, signal)
  }

  const adsetWarnings: string[] = []
  if (failedAdsetCampaignIds.length > 0) {
    for (const id of failedAdsetCampaignIds) {
      const name = campaigns.find(c => c.id === id)?.name ?? id
      adsetWarnings.push(`Timeout ao buscar conjuntos da campanha ${name}.`)
    }
    // One account-wide fallback call, bounded on its own, to try to recover adsets for whichever
    // campaigns failed above — a single call is cheaper and safer than retrying them one by one.
    try {
      checkAbort()
      const accountAdsets = await withPerCallTimeout(
        sig => getAdsets(adAccountId, undefined, sig, deps.onHeartbeat, ADSET_ACCOUNT_FALLBACK_MAX_PAGES),
        signal,
        ADSET_ACCOUNT_FALLBACK_TIMEOUT_MS
      )
      const failedSet = new Set(failedAdsetCampaignIds)
      const recovered = accountAdsets.filter(a => failedSet.has(a.campaignId))
      const activeFiltered = scope.status === 'active' ? recovered.filter(isActive) : recovered
      const existingIds = new Set(adsets.map(a => a.id))
      for (const a of activeFiltered) {
        if (!existingIds.has(a.id)) {
          adsets.push(a)
          existingIds.add(a.id)
        }
      }
      counts.adsets = adsets.length
      yield { type: 'progress', stage: 'adsets', counts: { adsets: counts.adsets } }
    } catch (err) {
      if (signal.aborted) throw err
      log('fallback by-account de adsets também falhou', err instanceof Error ? err.message : err)
    }
  }
  log('conjuntos encontrados', counts.adsets)
  yield { type: 'progress', stage: 'adsets', counts: { adsets: counts.adsets }, data: { adsets } }

  // ── Ads (serial, bounded by adLimit) ──
  log('etapa: anúncios')
  yield { type: 'progress', stage: 'ads', counts: { ads: 0 } }
  const ads: MetaAd[] = []
  const adsWarnings: string[] = [...adsetWarnings]

  if (adsets.length === 0 && campaigns.length > 0) {
    // No adsets at all — every campaign's fetch failed and the account-wide fallback came up empty,
    // or the account genuinely has none. Fall back to fetching ads directly per campaign so Dark
    // Posts (which only need ads + creatives) can still be reached, instead of ending the sync
    // early. Same per-call timeout + skip-and-continue treatment as the adsets loop above, so this
    // fallback can't reintroduce the same kind of stall one level down.
    adsWarnings.push('Conjuntos não foram carregados, mas o sync tentou buscar anúncios diretamente pelas campanhas.')
    for (let i = 0; i < campaigns.length; i++) {
      if (ads.length >= scope.adLimit) break
      checkAbort()
      const c = campaigns[i]
      yield {
        type: 'progress',
        stage: 'ads',
        counts: { ads: counts.ads },
        currentItem: { index: i + 1, total: campaigns.length, name: c.name },
      }
      try {
        const batch = await withRateLimitBackoff(
          () =>
            withPerCallTimeout(
              sig => getAds(adAccountId, c.id, undefined, sig, deps.onHeartbeat),
              signal,
              ADS_PER_CAMPAIGN_TIMEOUT_MS
            ),
          retryState,
          signal,
          deps.onHeartbeat
        )
        ads.push(...(scope.status === 'active' ? batch.filter(isActive) : batch))
      } catch (err) {
        if (signal.aborted || isMetaRateLimitError(err) || isMetaTokenError(err) || isMetaPermissionError(err)) throw err
        log('timeout/erro ao buscar ads da campanha (fallback sem adsets)', c.id, c.name, err instanceof Error ? err.message : err)
      }
      counts.ads = Math.min(ads.length, scope.adLimit)
      yield { type: 'progress', stage: 'ads', counts: { ads: counts.ads } }
      if (i < campaigns.length - 1 && ads.length < scope.adLimit) await sleepAbortable(META_SYNC_REQUEST_DELAY_MS, signal)
    }
  } else {
    for (let i = 0; i < adsets.length; i++) {
      if (ads.length >= scope.adLimit) break
      checkAbort()
      const a = adsets[i]
      const batch = await withRateLimitBackoff(
        () => getAds(adAccountId, undefined, a.id, signal, deps.onHeartbeat),
        retryState,
        signal,
        deps.onHeartbeat
      )
      ads.push(...(scope.status === 'active' ? batch.filter(isActive) : batch))
      counts.ads = Math.min(ads.length, scope.adLimit)
      yield { type: 'progress', stage: 'ads', counts: { ads: counts.ads } }
      if (i < adsets.length - 1 && ads.length < scope.adLimit) await sleepAbortable(META_SYNC_REQUEST_DELAY_MS, signal)
    }
  }
  const limitedAds = ads.slice(0, scope.adLimit)
  counts.ads = limitedAds.length
  log('anúncios encontrados', counts.ads)
  yield { type: 'progress', stage: 'ads', counts: { ads: counts.ads }, data: { ads: limitedAds } }

  // ── Creatives (cache-aware via deps.fetchCreatives, serial, small batches, delay between batches) ──
  log('etapa: criativos')
  yield { type: 'progress', stage: 'creatives', counts: { creatives: 0 } }
  const creativeIds = limitedAds.map(a => a.creativeId).filter((id): id is string => Boolean(id))
  const fetchCreatives = deps.fetchCreatives ?? fetchCreativesSerial
  let creatives: MetaCreative[]
  {
    const gen = fetchCreatives(creativeIds, signal, retryState, deps.onHeartbeat)
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
      deps.onHeartbeat?.()
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

  // Contextual notes for outcomes that are surprising-looking but expected given the data — so an
  // account that genuinely has no ads/creatives/dark posts in scope doesn't read as a bug.
  const warnings: string[] = [...adsWarnings]
  if (counts.campaigns > 0 && counts.ads === 0) {
    warnings.push('Campanhas encontradas, mas nenhum anúncio foi retornado neste escopo.')
  }
  if (counts.ads > 0 && counts.creatives === 0) {
    warnings.push('Anúncios encontrados, mas nenhum criativo foi carregado.')
  }
  if (counts.creatives > 0 && counts.darkPosts === 0) {
    warnings.push('Criativos carregados, mas nenhum object_story_id/video_id/permalink foi detectado.')
  }

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
    warnings,
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
