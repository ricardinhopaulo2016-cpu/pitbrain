// Single source of truth for Meta Sync's timing/limit knobs — shared by meta-service.ts,
// app/api/meta/sync/route.ts and app/meta-sync/page.tsx so client/server never drift apart
// (they used to define GLOBAL_TIMEOUT_MS independently).

/** Global sync timeout — aborts the whole structure sync past this point. */
export const GLOBAL_TIMEOUT_MS = 120_000

/** Delay between serial iterations of the adsets/ads fetch loops (one campaign/adset per iteration). */
export const META_SYNC_REQUEST_DELAY_MS = Number(process.env.META_SYNC_REQUEST_DELAY_MS) || 1200

/** Creative ids per batch when fetching creatives not already in cache. */
export const CREATIVE_BATCH_SIZE = 5

/** Delay between creative batches. */
export const CREATIVE_BATCH_DELAY_MS = 1500

/** Backoff before the single rate-limit retry allowed per sync. */
export const RATE_LIMIT_BACKOFF_MS = 60_000

/** Timeout for a single Supabase checkpoint/cache call (select/update/upsert) — a hung Supabase
 * call must never block the sync's drain loop the way it could before this existed. */
export const CHECKPOINT_TIMEOUT_MS = 8_000

/** If a sync stage produces no heartbeat (new Meta request, new item, or stage change) for this
 * long, the watchdog in app/api/meta/sync/route.ts aborts the sync as "stalled" instead of hanging
 * forever — this is the fix for syncs getting stuck showing a stale stage indefinitely. */
export const STAGE_TIMEOUT_MS = 45_000

/** Grace period after the watchdog calls controller.abort() before it force-closes the stream
 * itself, in case the generator's in-flight promise never settles on its own. */
export const STALL_FORCE_CLOSE_GRACE_MS = 5_000

/** How long a single campaign's adsets fetch (all its pages combined) may run before it's skipped
 * in favor of the next campaign — sized so DEFAULT_SYNC_SCOPE.campaignLimit (10) × this stays well
 * under GLOBAL_TIMEOUT_MS even if every campaign times out. */
export const ADSET_PER_CAMPAIGN_TIMEOUT_MS = 12_000

/** Pagination cap for a single campaign's adsets fetch — tighter than the generic paginate()
 * default since this runs once per campaign, not once per sync. */
export const ADSET_MAX_PAGES_PER_CAMPAIGN = 5

/** Pagination cap for the one-shot account-wide adsets fallback (covers every campaign that timed
 * out or errored during the per-campaign loop, so it can afford more pages than a single campaign). */
export const ADSET_ACCOUNT_FALLBACK_MAX_PAGES = 20

/** Timeout for the account-wide adsets fallback call — bigger budget than a single campaign since
 * it's meant to cover all the campaigns that failed, but still well under GLOBAL_TIMEOUT_MS. */
export const ADSET_ACCOUNT_FALLBACK_TIMEOUT_MS = 30_000

/** Same per-campaign timeout budget as adsets, reused by the ads-without-adsets fallback loop so it
 * can't reintroduce the same kind of stall one level down. */
export const ADS_PER_CAMPAIGN_TIMEOUT_MS = 12_000

/** Granularity at which the rate-limit backoff sleep (RATE_LIMIT_BACKOFF_MS) touches the sync
 * heartbeat — without this, a 60s backoff sleep (longer than STAGE_TIMEOUT_MS) would make the stage
 * watchdog wrongly abort the sync as "stalled" while it's just waiting out the intended retry. */
export const HEARTBEAT_TICK_MS = 5_000
