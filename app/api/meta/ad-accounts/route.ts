import { NextResponse } from 'next/server'
import { listAdAccounts } from '@/lib/meta/meta-service'
import { metaErrorResponse } from '@/lib/meta/meta-errors'

export async function GET() {
  try {
    const adAccounts = await listAdAccounts()
    // Not a secret (just an account id) — surfaced so the client can apply the
    // stored-selection → env-default → first-account fallback without a NEXT_PUBLIC_ duplicate.
    const defaultAdAccountId = process.env.META_DEFAULT_AD_ACCOUNT_ID ?? null
    return NextResponse.json({ adAccounts, defaultAdAccountId })
  } catch (err) {
    return metaErrorResponse(err, 'ad-accounts')
  }
}
