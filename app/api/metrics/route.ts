import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calculateMetrics } from '@/lib/calculators/metrics'
import { MetaCampaign } from '@/types/meta'
import { UtmifySession } from '@/types/utmify'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId obrigatório.' }, { status: 400 })
  }

  const supabase = createServerClient()

  const [{ data: metaData }, { data: utmifyData }] = await Promise.all([
    supabase.from('meta_rows').select('payload').eq('session_id', sessionId),
    supabase.from('utmify_rows').select('payload').eq('session_id', sessionId),
  ])

  const metaRows: MetaCampaign[] = (metaData ?? []).map(r => r.payload as MetaCampaign)
  const utmifyRows: UtmifySession[] = (utmifyData ?? []).map(r => r.payload as UtmifySession)

  const metrics = calculateMetrics(metaRows, utmifyRows, sessionId)

  // Upsert snapshot
  await supabase
    .from('metrics_snapshots')
    .upsert({ session_id: sessionId, payload: metrics }, { onConflict: 'session_id' })

  return NextResponse.json(metrics)
}
