import { NextRequest, NextResponse } from 'next/server'
import { getAds } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'

export async function GET(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const adAccountId = req.nextUrl.searchParams.get('adAccountId') ?? process.env.META_DEFAULT_AD_ACCOUNT_ID
  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? undefined
  const adsetId = req.nextUrl.searchParams.get('adsetId') ?? undefined

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }

  try {
    const ads = await getAds(adAccountId, campaignId, adsetId)
    return NextResponse.json({ ads })
  } catch (err) {
    return metaErrorResponse(err, 'ads')
  }
}
