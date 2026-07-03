// Single source of truth for Meta Sync's timing/limit knobs — shared by meta-service.ts,
// app/api/meta/sync/route.ts and app/meta-sync/page.tsx so client/server never drift apart
// (they used to define GLOBAL_TIMEOUT_MS independently).

/** Global sync timeout — aborts the whole structure sync past this point. */
export const GLOBAL_TIMEOUT_MS = 90_000

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
