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
