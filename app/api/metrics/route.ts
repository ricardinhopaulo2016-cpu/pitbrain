import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { calculateMetrics } from '@/lib/calculators/metrics'
import { MetaCampaign } from '@/types/meta'
import { UtmifySession } from '@/types/utmify'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'Supabase não configurado. Configure as variáveis de ambiente ou use o modo local.' },
        { status: 503 }
      )
    }

    const [{ data: metaData, error: metaErr }, { data: utmifyData, error: utmErr }] = await Promise.all([
      supabase.from('meta_rows').select('payload').eq('session_id', sessionId),
      supabase.from('utmify_rows').select('payload').eq('session_id', sessionId),
    ])

    if (metaErr || utmErr) {
      const detail = metaErr?.message ?? utmErr?.message
      if (process.env.NODE_ENV === 'development') {
        console.error('[pitbrain:metrics] db fetch error:', detail)
      }
      return NextResponse.json({ error: 'Erro ao buscar dados da sessão.', detail }, { status: 500 })
    }

    const metaRows: MetaCampaign[] = (metaData ?? []).map(r => r.payload as MetaCampaign)
    // utmifyRows may actually hold UtmifyDailyRow[] — calculateMetrics handles both safely
    const utmifyRows: UtmifySession[] = (utmifyData ?? []).map(r => r.payload as UtmifySession)

    const metrics = calculateMetrics(metaRows, utmifyRows, sessionId)

    // Upsert snapshot
    await supabase
      .from('metrics_snapshots')
      .upsert({ session_id: sessionId, payload: metrics }, { onConflict: 'session_id' })

    return NextResponse.json(metrics)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (process.env.NODE_ENV === 'development') {
      console.error('[pitbrain:metrics] unhandled error:', msg)
    }
    return NextResponse.json({ error: 'Erro interno ao calcular métricas.', detail: msg }, { status: 500 })
  }
}
