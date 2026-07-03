import { NextRequest, NextResponse } from 'next/server'
import { getInsights } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import type { MetaInsightLevel } from '@/lib/meta/meta-types'

const VALID_LEVELS: MetaInsightLevel[] = ['campaign', 'adset', 'ad']

export async function GET(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const params = req.nextUrl.searchParams
  const adAccountId = params.get('adAccountId') ?? process.env.META_DEFAULT_AD_ACCOUNT_ID
  const level = (params.get('level') ?? 'campaign') as MetaInsightLevel
  const datePreset = params.get('datePreset') ?? undefined
  const since = params.get('since') ?? undefined
  const until = params.get('until') ?? undefined

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }
  if (!VALID_LEVELS.includes(level)) {
    return NextResponse.json({ error: `level deve ser um de: ${VALID_LEVELS.join(', ')}.` }, { status: 400 })
  }

  try {
    const insights = await getInsights(adAccountId, level, { datePreset, since, until })
    return NextResponse.json({ insights })
  } catch (err) {
    return metaErrorResponse(err, 'insights')
  }
}
