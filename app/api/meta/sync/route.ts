import { NextRequest, NextResponse } from 'next/server'
import {
  runMetaSync,
  DEFAULT_SYNC_SCOPE,
  type MetaSyncScope,
  type MetaSyncCounts,
  type MetaSyncCheckpointData,
} from '@/lib/meta/meta-service'
import { buildMetaSyncErrorInfo, SyncAbortedError } from '@/lib/meta/meta-errors'
import { guardAuthorizedAccess, requireWorkspace } from '@/lib/auth/get-current-user'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { createCachingCreativeFetcher } from '@/lib/meta/meta-creative-cache'
import { GLOBAL_TIMEOUT_MS, CHECKPOINT_TIMEOUT_MS, STAGE_TIMEOUT_MS, STALL_FORCE_CLOSE_GRACE_MS } from '@/lib/meta/meta-sync-constants'

// If deployed on a platform with its own function execution limit (e.g. Vercel), this must stay
// comfortably above GLOBAL_TIMEOUT_MS — otherwise the platform could kill the function before our
// own timeout/watchdog logic gets to send a clean error frame, which looks like an indefinite hang
// even though the app-level timeouts below are working correctly.
export const maxDuration = 120

function parseScope(input: unknown): MetaSyncScope {
  const body = (input ?? {}) as Partial<MetaSyncScope>
  return {
    status: body.status === 'all' ? 'all' : DEFAULT_SYNC_SCOPE.status,
    campaignLimit: Number.isFinite(body.campaignLimit) ? Number(body.campaignLimit) : DEFAULT_SYNC_SCOPE.campaignLimit,
    adLimit: Number.isFinite(body.adLimit) ? Number(body.adLimit) : DEFAULT_SYNC_SCOPE.adLimit,
    nameContains: typeof body.nameContains === 'string' ? body.nameContains : undefined,
  }
}

const EMPTY_COUNTS: MetaSyncCounts = { campaigns: 0, adsets: 0, ads: 0, creatives: 0, darkPosts: 0 }

type CheckpointStatus = 'in_progress' | 'completed' | 'incomplete' | 'failed' | 'cancelled'

export async function POST(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  let adAccountId: string | undefined
  let adAccountName: string | undefined
  let scope: MetaSyncScope = DEFAULT_SYNC_SCOPE
  let forceRefreshCreatives = false

  try {
    const body = (await req.json().catch(() => ({}))) as {
      adAccountId?: string
      adAccountName?: string
      scope?: unknown
      forceRefreshCreatives?: boolean
    }
    adAccountId = body.adAccountId
    adAccountName = body.adAccountName
    scope = parseScope(body.scope)
    forceRefreshCreatives = Boolean(body.forceRefreshCreatives)
  } catch {
    adAccountId = undefined
  }

  adAccountId = adAccountId ?? process.env.META_DEFAULT_AD_ACCOUNT_ID

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }

  const dev = process.env.NODE_ENV === 'development'

  // Checkpointing/creative-cache is best-effort — a missing workspace (local mode, or an edge
  // case in provisioning) just means checkpoints are skipped, never blocks the sync itself.
  let workspaceId: string | null = null
  let userId: string | null = null
  const admin = isSupabaseConfigured() ? getSupabaseAdminClient() : null
  if (admin) {
    try {
      const ctx = await requireWorkspace()
      workspaceId = ctx.workspaceId
      userId = ctx.user.id
    } catch {
      // no workspace — proceed without checkpointing
    }
  }

  // Whether this account already has a completed (i.e. valid/usable) sync on record — if so,
  // checkpoint() below must protect it from being downgraded by a retry that fails partway.
  let hadCompletedSnapshot = false
  if (admin && workspaceId) {
    try {
      const { data: existing, error: existingError } = await admin
        .from('pitbrain_meta_syncs')
        .select('status')
        .eq('workspace_id', workspaceId)
        .eq('ad_account_id', adAccountId)
        .abortSignal(AbortSignal.timeout(CHECKPOINT_TIMEOUT_MS))
        .maybeSingle()
      if (!existingError) hadCompletedSnapshot = existing?.status === 'completed'
    } catch {
      // best-effort — if this read fails, checkpoint() just falls back to always overwriting
    }
  }

  // checkpoint() must never be able to hang the sync's drain loop: every Supabase call below
  // carries its own abort timeout (CHECKPOINT_TIMEOUT_MS), and — since Postgrest resolves with
  // `{ data, error }` instead of throwing on a query/timeout failure — success is only assumed
  // when `error` is explicitly falsy, not just because the call didn't throw.
  async function checkpoint(status: CheckpointStatus, data: MetaSyncCheckpointData, counts: Partial<MetaSyncCounts>, error?: string) {
    if (!admin || !workspaceId) return
    const now = new Date().toISOString()
    try {
      // A completed sync always becomes the new protected snapshot. Any other status only
      // overwrites the snapshot columns (campaigns/adsets/ads/creatives/dark_posts/counts/
      // status/error) when there's no completed sync yet to protect — a retry that hits a
      // rate limit/timeout/stall partway through must never downgrade an already-valid dataset.
      // The attempt's own outcome is still recorded via last_attempt_* either way, so the UI
      // can distinguish "last valid sync" from "most recent attempt."
      if (status !== 'completed' && hadCompletedSnapshot) {
        const { error: dbError } = await admin
          .from('pitbrain_meta_syncs')
          .update({ last_attempt_status: status, last_attempt_error: error ?? null, last_attempt_at: now })
          .eq('workspace_id', workspaceId)
          .eq('ad_account_id', adAccountId)
          .abortSignal(AbortSignal.timeout(CHECKPOINT_TIMEOUT_MS))
        if (dbError && dev) console.warn('[pitbrain:meta:sync] checkpoint update failed:', dbError.message)
        return
      }

      const { error: dbError } = await admin
        .from('pitbrain_meta_syncs')
        .upsert(
          {
            workspace_id: workspaceId,
            created_by: userId,
            ad_account_id: adAccountId,
            ad_account_name: adAccountName ?? null,
            campaigns: data.campaigns ?? [],
            adsets: data.adsets ?? [],
            ads: data.ads ?? [],
            creatives: data.creatives ?? [],
            dark_posts: data.darkPosts ?? [],
            counts: { ...EMPTY_COUNTS, ...counts },
            status,
            error: error ?? null,
            last_attempt_status: status,
            last_attempt_error: error ?? null,
            last_attempt_at: now,
          },
          { onConflict: 'workspace_id,ad_account_id' }
        )
        .abortSignal(AbortSignal.timeout(CHECKPOINT_TIMEOUT_MS))

      if (dbError) {
        if (dev) console.warn('[pitbrain:meta:sync] checkpoint upsert failed:', dbError.message)
        return
      }
      if (status === 'completed') hadCompletedSnapshot = true
    } catch (err) {
      if (dev) console.warn('[pitbrain:meta:sync] checkpoint threw:', err instanceof Error ? err.message : err)
    }
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  let abortReason: 'timeout' | 'cancelled' | 'stalled' | undefined

  // `settled` is the single source of truth for "has a terminal frame already been sent" — the
  // normal completion path, the normal error path, and the stall watchdog's forced-close path all
  // check-and-claim it (synchronously, no `await` between check and set) before doing anything, so
  // whichever gets there first wins and the others become no-ops instead of double-sending/
  // double-checkpointing/double-closing the stream.
  let settled = false
  function claim(): boolean {
    if (settled) return false
    settled = true
    return true
  }

  const timeoutTimer = setTimeout(() => {
    if (settled) return
    abortReason = 'timeout'
    controller.abort()
  }, GLOBAL_TIMEOUT_MS)

  const onClientAbort = () => {
    if (settled) return
    abortReason = 'cancelled'
    controller.abort()
  }
  req.signal.addEventListener('abort', onClientAbort)

  const encoder = new TextEncoder()
  let lastCounts: Partial<MetaSyncCounts> = {}
  let lastStage = 'campaigns'
  const accumulated: MetaSyncCheckpointData = {}

  // Heartbeat: touched on every real Meta request attempt (via deps.onHeartbeat, threaded down
  // into every paginate() page) and on every stage-boundary progress event — the watchdog below
  // treats a long enough silence on this timestamp as a stall, regardless of *why* nothing moved
  // (stuck Meta pagination, a hung Supabase checkpoint call before its own timeout fires, etc).
  let lastHeartbeatAt = Date.now()
  function touchHeartbeat() {
    lastHeartbeatAt = Date.now()
  }

  const stream = new ReadableStream({
    async start(streamController) {
      function send(obj: unknown) {
        try {
          streamController.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          // stream already closed (client disconnected) — nothing to do
        }
      }

      function closeStream() {
        try {
          streamController.close()
        } catch {
          // already closed by another settled path — fine
        }
      }

      const fetchCreatives = workspaceId
        ? createCachingCreativeFetcher(workspaceId, forceRefreshCreatives)
        : undefined

      const watchdog = setInterval(() => {
        if (settled) return
        if (Date.now() - lastHeartbeatAt < STAGE_TIMEOUT_MS) return
        clearInterval(watchdog)
        void forceStall()
      }, 2000)

      async function forceStall() {
        if (!claim()) return
        abortReason = 'stalled'
        controller.abort()
        // Give the abandoned gen.next()/checkpoint() call a short grace window to unwind on its
        // own (via the abort signal, or the checkpoint's own CHECKPOINT_TIMEOUT_MS) before we
        // force the response closed regardless — this is what makes "never hangs indefinitely" an
        // actual guarantee instead of "hangs until every downstream call happens to be abort-aware."
        await new Promise(resolve => setTimeout(resolve, STALL_FORCE_CLOSE_GRACE_MS))
        const info = buildMetaSyncErrorInfo(new SyncAbortedError('stalled'), 'stalled', lastStage)
        if (dev) console.error('[pitbrain:meta:sync] sync travado', adAccountId, lastStage)
        send({ type: 'error', ...info, partial: lastCounts })
        await checkpoint('incomplete', accumulated, lastCounts, info.message)
        clearTimeout(timeoutTimer)
        req.signal.removeEventListener('abort', onClientAbort)
        closeStream()
      }

      try {
        const gen = runMetaSync(adAccountId!, scope, controller.signal, { fetchCreatives, onHeartbeat: touchHeartbeat })
        let final
        while (true) {
          const step = await gen.next()
          if (settled) return // watchdog already claimed and closed the stream — stop here
          if (step.done) {
            final = step.value
            break
          }
          lastCounts = { ...lastCounts, ...step.value.counts }
          lastStage = step.value.stage
          touchHeartbeat()
          send(step.value)
          if (step.value.data) {
            Object.assign(accumulated, step.value.data)
            await checkpoint('in_progress', accumulated, lastCounts)
          }
        }
        if (!claim()) return
        clearInterval(watchdog)
        send({ type: 'done', result: final })
        await checkpoint('completed', final, final.counts)
      } catch (err) {
        if (!claim()) return
        clearInterval(watchdog)
        const info = buildMetaSyncErrorInfo(err, abortReason, lastStage)
        if (dev) console.error('[pitbrain:meta:sync] erro', adAccountId, info.kind, info.message)
        send({ type: 'error', ...info, partial: lastCounts })
        const status: CheckpointStatus =
          info.kind === 'cancelled'
            ? 'cancelled'
            : info.kind === 'timeout' || info.kind === 'rate_limit' || info.kind === 'stalled'
              ? 'incomplete'
              : 'failed'
        await checkpoint(status, accumulated, lastCounts, info.message)
      } finally {
        clearInterval(watchdog)
        clearTimeout(timeoutTimer)
        req.signal.removeEventListener('abort', onClientAbort)
        if (dev) console.log('[pitbrain:meta:sync] tempo total', adAccountId, `${Date.now() - startedAt}ms`)
        closeStream()
      }
    },
    cancel() {
      if (settled) return
      abortReason = abortReason ?? 'cancelled'
      controller.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
