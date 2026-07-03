import { NextRequest, NextResponse } from 'next/server'
import { runMetaSync, DEFAULT_SYNC_SCOPE, type MetaSyncScope, type MetaSyncCounts } from '@/lib/meta/meta-service'
import { buildMetaSyncErrorInfo } from '@/lib/meta/meta-errors'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'

const GLOBAL_TIMEOUT_MS = 60_000

function parseScope(input: unknown): MetaSyncScope {
  const body = (input ?? {}) as Partial<MetaSyncScope>
  return {
    status: body.status === 'all' ? 'all' : DEFAULT_SYNC_SCOPE.status,
    campaignLimit: Number.isFinite(body.campaignLimit) ? Number(body.campaignLimit) : DEFAULT_SYNC_SCOPE.campaignLimit,
    adLimit: Number.isFinite(body.adLimit) ? Number(body.adLimit) : DEFAULT_SYNC_SCOPE.adLimit,
    nameContains: typeof body.nameContains === 'string' ? body.nameContains : undefined,
    includeInsights: Boolean(body.includeInsights),
  }
}

export async function POST(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  let adAccountId: string | undefined
  let scope: MetaSyncScope = DEFAULT_SYNC_SCOPE

  try {
    const body = (await req.json().catch(() => ({}))) as { adAccountId?: string; scope?: unknown }
    adAccountId = body.adAccountId
    scope = parseScope(body.scope)
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
  let lastCounts: Partial<MetaSyncCounts> | undefined

  const stream = new ReadableStream({
    async start(streamController) {
      function send(obj: unknown) {
        try {
          streamController.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          // stream already closed (client disconnected) — nothing to do
        }
      }

      try {
        const gen = runMetaSync(adAccountId!, scope, controller.signal)
        let final
        while (true) {
          const step = await gen.next()
          if (step.done) {
            final = step.value
            break
          }
          lastCounts = { ...lastCounts, ...step.value.counts }
          send(step.value)
        }
        send({ type: 'done', result: final })
      } catch (err) {
        const info = buildMetaSyncErrorInfo(err, abortReason)
        if (dev) console.error('[pitbrain:meta:sync] erro', adAccountId, info.kind, info.message)
        send({ type: 'error', ...info, partial: lastCounts })
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
