import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { fetchCreativesSerial } from './meta-service'
import type { CreativeFetcher } from './meta-service'
import type { MetaCreative } from './meta-types'
import { CHECKPOINT_TIMEOUT_MS } from './meta-sync-constants'

// Server-only, workspace-scoped cache for Meta creatives — avoids re-fetching the same creative
// from the Graph API on every sync. Every function here is best-effort: a cache read/write
// failure never throws into the sync, it just falls back to fetching from Meta as if there were
// no cache at all.

interface CachedCreativeRow {
  creative_id: string
  creative: MetaCreative
}

export async function getCachedCreatives(workspaceId: string, creativeIds: string[]): Promise<Map<string, MetaCreative>> {
  const cached = new Map<string, MetaCreative>()
  if (!isSupabaseConfigured() || creativeIds.length === 0) return cached

  const admin = getSupabaseAdminClient()
  if (!admin) return cached

  const { data, error } = await admin
    .from('pitbrain_meta_creative_cache')
    .select('creative_id, creative')
    .eq('workspace_id', workspaceId)
    .in('creative_id', creativeIds)
    .abortSignal(AbortSignal.timeout(CHECKPOINT_TIMEOUT_MS))

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('[pitbrain:meta:creative-cache] read failed:', error.message)
    return cached
  }

  for (const row of (data ?? []) as CachedCreativeRow[]) {
    cached.set(row.creative_id, row.creative)
  }
  return cached
}

export async function upsertCreativeCache(workspaceId: string, creatives: MetaCreative[]): Promise<void> {
  if (!isSupabaseConfigured() || creatives.length === 0) return
  const admin = getSupabaseAdminClient()
  if (!admin) return

  const rows = creatives.map(c => ({
    workspace_id: workspaceId,
    creative_id: c.id,
    creative: c,
    object_story_id: c.objectStoryId ?? null,
    effective_object_story_id: c.effectiveObjectStoryId ?? null,
    video_id: c.videoId ?? null,
    permalink: c.instagramPermalinkUrl ?? null,
  }))

  const { error } = await admin
    .from('pitbrain_meta_creative_cache')
    .upsert(rows, { onConflict: 'workspace_id,creative_id' })
    .abortSignal(AbortSignal.timeout(CHECKPOINT_TIMEOUT_MS))

  if (error && process.env.NODE_ENV === 'development') {
    console.error('[pitbrain:meta:creative-cache] upsert failed:', error.message)
  }
}

/**
 * Drop-in replacement for `fetchCreativesSerial` with the same generator signature — checks the
 * Supabase cache first, only hits the Meta API for ids that aren't cached (or for all of them, if
 * `forceRefresh` is set), and writes newly-fetched creatives back to the cache once they're in.
 * Falls back to the plain `fetchCreativesSerial`, untouched, when there's no workspace, Supabase
 * isn't configured, or the caller asked to force a refresh.
 */
export function createCachingCreativeFetcher(workspaceId: string | null, forceRefresh: boolean): CreativeFetcher {
  return async function* cachingCreativeFetcher(creativeIds, signal, retryState, onHeartbeat) {
    if (!workspaceId || forceRefresh || !isSupabaseConfigured() || creativeIds.length === 0) {
      return yield* fetchCreativesSerial(creativeIds, signal, retryState, onHeartbeat)
    }

    const unique = Array.from(new Set(creativeIds))
    const cached = await getCachedCreatives(workspaceId, unique)
    const missingIds = unique.filter(id => !cached.has(id))

    if (cached.size > 0) yield cached.size

    if (missingIds.length === 0) {
      return Array.from(cached.values())
    }

    const gen = fetchCreativesSerial(missingIds, signal, retryState, onHeartbeat)
    let fetched: MetaCreative[] = []
    while (true) {
      const step = await gen.next()
      if (step.done) {
        fetched = step.value
        break
      }
      yield cached.size + step.value
    }

    if (fetched.length > 0) await upsertCreativeCache(workspaceId, fetched)

    return [...cached.values(), ...fetched]
  }
}
