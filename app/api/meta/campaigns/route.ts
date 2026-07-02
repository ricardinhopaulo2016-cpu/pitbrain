import { NextRequest, NextResponse } from 'next/server'
import { getCampaigns } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'

export async function GET(req: NextRequest) {
  const adAccountId = req.nextUrl.searchParams.get('adAccountId') ?? process.env.META_DEFAULT_AD_ACCOUNT_ID

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }

  try {
    const campaigns = await getCampaigns(adAccountId)
    return NextResponse.json({ campaigns })
  } catch (err) {
    return metaErrorResponse(err, 'campaigns')
  }
}
