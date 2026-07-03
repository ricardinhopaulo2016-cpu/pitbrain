import { NextRequest, NextResponse } from 'next/server'
import {
  runMetaSync,
  DEFAULT_SYNC_SCOPE,
  type MetaSyncScope,
  type MetaSyncCounts,
  type MetaSyncCheckpointData,
} from '@/lib/meta/meta-service'
import { buildMetaSyncErrorInfo } from '@/lib/meta/meta-errors'
import { guardAuthorizedAccess, requireWorkspace } from '@/lib/auth/get-current-user'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { createCachingCreativeFetcher } from '@/lib/meta/meta-creative-cache'
import { GLOBAL_TIMEOUT_MS } from '@/lib/meta/meta-sync-constants'

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
      const { data: existing } = await admin
        .from('pitbrain_meta_syncs')
        .select('status')
        .eq('workspace_id', workspaceId)
        .eq('ad_account_id', adAccountId)
        .maybeSingle()
      hadCompletedSnapshot = existing?.status === 'completed'
    } catch {
      // best-effort — if this read fails, checkpoint() just falls back to always overwriting
    }
  }

  async function checkpoint(status: CheckpointStatus, data: MetaSyncCheckpointData, counts: Partial<MetaSyncCounts>, error?: string) {
    if (!admin || !workspaceId) return
    const now = new Date().toISOString()
    try {
      // A completed sync always becomes the new protected snapshot. Any other status only
      // overwrites the snapshot columns (campaigns/adsets/ads/creatives/dark_posts/counts/
      // status/error) when there's no completed sync yet to protect — a retry that hits a
      // rate limit/timeout partway through must never downgrade an already-valid dataset.
      // The attempt's own outcome is still recorded via last_attempt_* either way, so the UI
      // can distinguish "last valid sync" from "most recent attempt."
      if (status !== 'completed' && hadCompletedSnapshot) {
        await admin
          .from('pitbrain_meta_syncs')
          .update({ last_attempt_status: status, last_attempt_error: error ?? null, last_attempt_at: now })
          .eq('workspace_id', workspaceId)
          .eq('ad_account_id', adAccountId)
        return
      }

      await admin.from('pitbrain_meta_syncs').upsert(
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
      if (status === 'completed') hadCompletedSnapshot = true
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[pitbrain:meta:sync] checkpoint upsert failed:', err instanceof Error ? err.message : err)
      }
    }
  }

  const dev = process.env.NODE_ENV === 'development'
  const startedAt = Date.now()
  const controller = new AbortController()
  let abortReason: 'timeout' | 'cancelled' | undefined

  const timeoutTimer = setTimeout(() => {
    abortReason = 'timeout'
    controller.abort()
  }, GLOBAL_TIMEOUT_MS)

  const onClientAbort = () => {
    abortReason = 'cancelled'
    controller.abort()
  }
  req.signal.addEventListener('abort', onClientAbort)

  const encoder = new TextEncoder()
  let lastCounts: Partial<MetaSyncCounts> = {}
  const accumulated: MetaSyncCheckpointData = {}

  const stream = new ReadableStream({
    async start(streamController) {
      function send(obj: unknown) {
        try {
          streamController.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          // stream already closed (client disconnected) — nothing to do
        }
      }

      const fetchCreatives = workspaceId
        ? createCachingCreativeFetcher(workspaceId, forceRefreshCreatives)
        : undefined

      try {
        const gen = runMetaSync(adAccountId!, scope, controller.signal, { fetchCreatives })
        let final
        while (true) {
          const step = await gen.next()
          if (step.done) {
            final = step.value
            break
          }
          lastCounts = { ...lastCounts, ...step.value.counts }
          send(step.value)
          if (step.value.data) {
            Object.assign(accumulated, step.value.data)
            await checkpoint('in_progress', accumulated, lastCounts)
          }
        }
        send({ type: 'done', result: final })
        await checkpoint('completed', final, final.counts)
      } catch (err) {
        const info = buildMetaSyncErrorInfo(err, abortReason)
        if (dev) console.error('[pitbrain:meta:sync] erro', adAccountId, info.kind, info.message)
        send({ type: 'error', ...info, partial: lastCounts })
        const status: CheckpointStatus =
          info.kind === 'cancelled' ? 'cancelled' : info.kind === 'timeout' || info.kind === 'rate_limit' ? 'incomplete' : 'failed'
        await checkpoint(status, accumulated, lastCounts, info.message)
      } finally {
        clearTimeout(timeoutTimer)
        req.signal.removeEventListener('abort', onClientAbort)
        if (dev) console.log('[pitbrain:meta:sync] tempo total', adAccountId, `${Date.now() - startedAt}ms`)
        streamController.close()
      }
    },
    cancel() {
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
