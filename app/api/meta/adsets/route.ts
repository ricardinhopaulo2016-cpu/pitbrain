import { NextRequest, NextResponse } from 'next/server'
import { getAdsets } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'

export async function GET(req: NextRequest) {
  const adAccountId = req.nextUrl.searchParams.get('adAccountId') ?? process.env.META_DEFAULT_AD_ACCOUNT_ID
  const campaignId = req.nextUrl.searchParams.get('campaignId') ?? undefined

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }

  try {
    const adsets = await getAdsets(adAccountId, campaignId)
    return NextResponse.json({ adsets })
  } catch (err) {
    return metaErrorResponse(err, 'adsets')
  }
}
