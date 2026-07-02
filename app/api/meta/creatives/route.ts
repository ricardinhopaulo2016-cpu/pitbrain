import { NextRequest, NextResponse } from 'next/server'
import { getAdCreatives } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'

export async function GET(req: NextRequest) {
  const adAccountId = req.nextUrl.searchParams.get('adAccountId') ?? process.env.META_DEFAULT_AD_ACCOUNT_ID
  const idsParam = req.nextUrl.searchParams.get('ids')

  if (!adAccountId) {
    return NextResponse.json(
      { error: 'adAccountId obrigatório (ou configure META_DEFAULT_AD_ACCOUNT_ID).' },
      { status: 400 }
    )
  }
  if (!idsParam) {
    return NextResponse.json({ error: 'ids (creative ids separados por vírgula) é obrigatório.' }, { status: 400 })
  }

  const creativeIds = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  try {
    const creatives = await getAdCreatives(adAccountId, creativeIds)
    return NextResponse.json({ creatives })
  } catch (err) {
    return metaErrorResponse(err, 'creatives')
  }
}
